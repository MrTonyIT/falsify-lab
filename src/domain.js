import { createHash } from "node:crypto";
import { assessOracle } from "./oracle.js";
import { checkerProfile } from "./checkers.js";
import { digest } from "./protocol.js";

export const Verdict = Object.freeze({
  KILL: "kill",
  SURVIVED: "survived",
  INVALID_INPUT: "invalid",
  GEN_FAILED: "gen_failed",
  UNUSABLE: "unusable",
  INCONCLUSIVE: "inconclusive",
});
export const sha256 = (value) =>
  "sha256:" + createHash("sha256").update(value).digest("hex");
export const LIMITS = Object.freeze({
  attempts: 3,
  seed: 12345,
  generatorSeconds: 10,
  runSeconds: 30,
  memoryBytes: 1073741824,
  inputBytes: 8388608,
  outputBytes: 8388608,
  stderrBytes: 65536,
  pids: 64,
});
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
export function publicProblem(problem) {
  assert(
    typeof problem.statement === "string" &&
      typeof problem.constraints === "string",
    "Statement and constraints required",
  );
  return Object.freeze({
    id: problem.id,
    statement: problem.statement,
    constraints: problem.constraints,
  });
}
export function devTarget(submission) {
  assert(
    submission.split === "dev",
    "Only DEV submissions may be exposed to generation or selection",
  );
  assert(typeof submission.code === "string", "Target source required");
  return Object.freeze({
    id: submission.id,
    split: "dev",
    code: submission.code,
  });
}
export function validateProblem(
  p,
  { official = false, allowRuntimeError = false } = {},
) {
  publicProblem(p);
  assert(["A", "B", "C"].includes(p.division), "Div2 A/B/C required");
  assert(
    typeof p.validator === "function" && typeof p.checker === "function",
    "Validator/checker required",
  );
  checkerProfile(p.checkerName);
  assert(p.references?.length === 3, "Exactly three references required");
  assert(
    new Set(p.references.map((r) => r.author)).size === 3 &&
      p.references.every(
        (r) =>
          r.author && r.verdict === "ACCEPTED" && typeof r.code === "string",
      ),
    "References must be ACCEPTED from three named authors",
  );
  const subs = [...p.dev, ...p.heldOut];
  assert(
    new Set(subs.map((s) => String(s.id))).size === subs.length,
    "Submission IDs overlap",
  );
  assert(
    new Set(subs.map((s) => sha256(s.code))).size === subs.length,
    "Duplicate source across corpus partitions",
  );
  assert(
    !p.references.some((r) =>
      subs.some(
        (s) =>
          String(s.id) === String(r.id) || sha256(s.code) === sha256(r.code),
      ),
    ),
    "Reference/target identities or source overlap",
  );
  assert(
    p.dev.every((s) => s.split === "dev") &&
      p.heldOut.every((s) => s.split === "held-out"),
    "Incorrect split labels",
  );
  for (const s of subs) {
    assert(
      typeof s.code === "string" && /python|pypy/i.test(s.language),
      "Only Python sources supported",
    );
    assert(
      [
        "WRONG_ANSWER",
        ...(allowRuntimeError ? ["RUNTIME_ERROR"] : []),
      ].includes(s.verdict),
      "Ineligible target verdict",
    );
    assert(
      Number.isInteger(s.passedTestCount) && s.passedTestCount >= 0,
      "Missing passedTestCount",
    );
    if (official)
      assert(
        s.origin === "human",
        "Synthetic/mutant sources excluded from human corpus",
      );
  }
  if (official) {
    assert(
      assessOracle(p).kind === "reviewed" && assessOracle(p).trusted,
      "Reviewed, hash-bound oracle provenance required",
    );
    assert(
      !p.oracleKind || p.oracleKind !== "synthetic-fixture",
      "Synthetic oracle excluded from official evidence",
    );
    const duplicates = duplicateGroups(subs);
    if (duplicates.length)
      assert(
        p.duplicateReview?.status === "reviewed" &&
          p.duplicateReview.binding === digest(duplicates) &&
          p.duplicateReview.reviewer &&
          p.duplicateReview.rationale,
        "Normalized-source duplicate candidates require bound human review",
      );
    assert(
      p.dev.length === 15 && p.heldOut.length === 10,
      "Official split is 15 DEV / 10 held-out",
    );
    assert(
      p.publishedAt && p.semanticSizeDefinition && p.samples?.length,
      "Problem metadata incomplete",
    );
    assert(!p.exclusions?.length, "Unsupported problem category");
    assert(
      p.eligibilityReviewed === true,
      "Manual eligibility review required: no interactive, print-any, float output, file I/O or image-dependent statement",
    );
    assert(
      p.references.every((r) => /python|pypy/i.test(r.language)),
      "Python references required",
    );
  }
  return p;
}
// Conservative heuristic only; strings, algorithms and semantic equivalence are not inferred.
export function normalizedSource(code) {
  return code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trimEnd())
    .filter((s) => s.trim() && !s.trimStart().startsWith("#"))
    .join("\n");
}
export function duplicateGroups(submissions) {
  const groups = new Map();
  for (const s of submissions) {
    const key = sha256(normalizedSource(s.code));
    if (!groups.has(key)) groups.set(key, []);
    groups
      .get(key)
      .push({ id: s.id, split: s.split, sourceHash: sha256(s.code) });
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
export function validateConfig(c, official = false) {
  if (c.endpoint) {
    const u = new URL(c.endpoint);
    assert(
      u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !["key", "api_key", "apikey", "token", "access_token"].some((k) =>
          u.searchParams.has(k),
        ),
      "Endpoint must use HTTPS without embedded credentials",
    );
  }
  assert(
    c.model && c.reasoningEffort === "high" && c.maxCompletionTokens === 16000,
    "Model, high effort and 16000 completion tokens required",
  );
  assert(
    Number.isFinite(c.costLimitUsd) && c.costLimitUsd > 0,
    "Positive total cost guard required",
  );
  assert(c.responseCache === false, "Response reuse prohibited");
  for (const key of ["input", "cachedInput", "output"])
    assert(
      Number.isFinite(c.pricing?.[key]) && c.pricing[key] >= 0,
      "Explicit prices per million tokens required",
    );
  if (official) {
    assert(
      Number.isSafeInteger(c.maxInputTokens) && c.maxInputTokens > 0,
      "Explicit input-token reservation required",
    );
    assert(
      c.snapshotPinned === true &&
        !/latest/i.test(c.model) &&
        c.model !== "gpt-5.6-terra",
      "Concrete provider snapshot required",
    );
  }
  return c;
}
