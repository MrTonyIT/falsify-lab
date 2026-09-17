import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, sha256, validateProblem } from "./domain.js";
import { checkerFor } from "./checkers.js";
import { testValidator } from "./validators.js";
import { digest, protocolBinding } from "./protocol.js";
import { checkerIdentity } from "./checkers.js";
export function bucket(n) {
  return n <= 5 ? "sample..5" : n <= 15 ? "6..15" : "16+";
}
export function seededRandom(seed = 12345) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function stratifiedSplit(
  candidates,
  { seed = 12345, devCount = 15, heldOutCount = 10 } = {},
) {
  assert(
    candidates.length >= devCount + heldOutCount,
    "Insufficient pool: replace problem, do not lower quality",
  );
  assert(
    candidates.every((s) => s.samplePassed === true),
    "Sample execution evidence required before splitting",
  );
  const rng = seededRandom(seed),
    groups = ["sample..5", "6..15", "16+"].map((b) =>
      candidates
        .filter((s) => bucket(s.passedTestCount) === b)
        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    );
  for (const g of groups)
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
  const ordered = [];
  while (groups.some((g) => g.length))
    for (const g of groups) if (g.length) ordered.push(g.pop());
  const selected = ordered.slice(0, devCount + heldOutCount),
    heldIndices = new Set();
  for (let i = 0; i < heldOutCount; i++)
    heldIndices.add(Math.floor(((i + 0.5) * selected.length) / heldOutCount));
  return {
    dev: selected
      .filter((_, i) => !heldIndices.has(i))
      .map((s) => ({ ...s, split: "dev" })),
    heldOut: selected
      .filter((_, i) => heldIndices.has(i))
      .map((s) => ({ ...s, split: "held-out" })),
    seed,
  };
}
export function corpusIdentity(problems) {
  const identify = (s) => ({
    ...s,
    code: undefined,
    sourceHash: sha256(s.code),
  });
  return digest({
    ...protocolBinding(),
    problems: problems.map((p) => ({
      ...p,
      validator: sha256(String(p.validator)),
      checker: checkerIdentity(p.checkerName),
      randomGenerator: sha256(String(p.randomGenerator)),
      exactOracle: p.exactOracle ? sha256(String(p.exactOracle)) : null,
      references: p.references.map(identify),
      dev: p.dev.map(identify),
      heldOut: p.heldOut.map(identify),
    })),
  });
}
export async function qualityAudit(problem, evaluator) {
  const validator = await testValidator(problem);
  assert(problem.samples?.length > 0, "Public samples required");
  const prepared = [];
  for (const sample of problem.samples) {
    const candidate = await evaluator.prepare(
      problem,
      Buffer.from(sample.input),
      { audit: true },
    );
    assert(
      !candidate.verdict,
      "Sample rejected or references failed/disagreed",
    );
    assert(
      checkerFor(problem.checkerName)(
        Buffer.from(sample.output),
        candidate.expected,
      ),
      "References disagree with published sample output",
    );
    prepared.push({
      ...candidate,
      oracle: { trusted: true, kind: "public-sample" },
      expected: Buffer.from(sample.output),
    });
  }
  const accepted = [],
    rejected = [];
  for (const target of [...problem.dev, ...problem.heldOut]) {
    let ok = target.passedTestCount >= problem.samples.length;
    // Always execute actual sample tests, including when metadata is insufficient.
    for (const sample of prepared)
      if (
        (await evaluator.judge(problem, target, sample)).verdict !== "survived"
      )
        ok = false;
    (ok ? accepted : rejected).push({
      id: target.id,
      hash: sha256(target.code),
      samplePassed: ok,
    });
  }
  return {
    problem_id: problem.id,
    validator,
    accepted,
    rejected,
    referenceSamplesAgree: true,
    referenceSamples: problem.references.map((r) => ({
      id: r.id,
      status: "passed",
      sourceHash: sha256(r.code),
      samplesHash: digest(problem.samples),
    })),
  };
}
export async function within(root, path) {
  assert(typeof path === "string", "Corpus path required");
  const base = await realpath(root),
    full = await realpath(resolve(base, path)),
    rel = relative(base, full);
  assert(
    rel && !rel.startsWith("..") && !isAbsolute(rel),
    "Corpus path escapes private root",
  );
  return full;
}
export async function loadCorpus(manifestPath, options = {}) {
  assert(typeof manifestPath === "string", "Corpus manifest path required");
  const root = resolve(manifestPath, "..");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(
    manifest &&
      Array.isArray(manifest.problems) &&
      manifest.problems.length <= 1000,
    "Malformed or oversized corpus manifest",
  );
  const problems = [];
  for (const entry of manifest.problems) {
    assert(
      entry &&
        Array.isArray(entry.references) &&
        Array.isArray(entry.dev) &&
        Array.isArray(entry.heldOut),
      "Problem partition arrays required",
    );
    const pluginPath = await within(root, entry.plugin),
      pluginBytes = await readFile(pluginPath);
    assert(
      entry.pluginReview?.status === "reviewed" &&
        entry.pluginReview.reviewer &&
        entry.pluginReview.sha256 === sha256(pluginBytes),
      "Trusted host plugin requires explicit hash-bound operator review before import",
    );
    // Plugins are trusted host code, never browser uploads. A hash is not a sandbox.
    assert(
      entry.pluginReview.dependenciesReviewed === true,
      "Operator must review plugin dependency closure as well as source",
    );
    assert(
      Array.isArray(entry.pluginReview.dependencies),
      "Reviewed plugin dependency manifest required, including an empty list for self-contained modules",
    );
    for (const dependency of entry.pluginReview.dependencies) {
      assert(
        sha256(await readFile(await within(root, dependency.path))) ===
          dependency.sha256,
        "Plugin dependency hash missing or stale",
      );
    }
    const plugin = await import(
      pathToFileURL(pluginPath).href + "?sha=" + sha256(pluginBytes).slice(7)
    );
    const load = async (s) => {
      const code = await readFile(await within(root, s.source), "utf8");
      assert(!s.sha256 || s.sha256 === sha256(code), "Source hash mismatch");
      return { ...s, code };
    };
    const p = {
      ...entry,
      validator: plugin.validate,
      exactOracle: plugin.exactOracle,
      randomGenerator: plugin.randomGenerator,
      validatorCases: plugin.validatorCases,
      validatorHash: sha256(pluginBytes),
      randomHash: sha256(String(plugin.randomGenerator)),
      checker: checkerFor(entry.checkerName),
      references: await Promise.all(entry.references.map(load)),
      dev: await Promise.all(entry.dev.map(load)),
      heldOut: await Promise.all(entry.heldOut.map(load)),
    };
    problems.push(validateProblem(p, options));
  }
  assert(
    new Set(problems.map((p) => p.id)).size === problems.length,
    "Duplicate problem IDs",
  );
  if (options.official)
    assert(
      problems.length === 30 &&
        ["A", "B", "C"].every(
          (d) => problems.filter((p) => p.division === d).length === 10,
        ),
      "Official corpus requires 10 A / 10 B / 10 C",
    );
  return problems;
}
export async function publicManifest(problems, path) {
  const project = (s) => ({
    id: s.id,
    verdict: s.verdict,
    passedTestCount: s.passedTestCount,
    language: s.language,
    sha256: sha256(s.code),
    split: s.split,
  });
  await writeFile(
    path,
    JSON.stringify(
      {
        corpus_id: corpusIdentity(problems),
        problems: problems.map((p) => ({
          id: p.id,
          division: p.division,
          publishedAt: p.publishedAt,
          dev: p.dev.map(project),
          heldOut: p.heldOut.map(project),
          references: p.references.map(project),
        })),
      },
      null,
      2,
    ),
  );
}
