import { PROTOCOL as CURRENT_PROTOCOL } from "./protocol.js";
import { verifyAnalysisPlan } from "./analysis-plan.js";
import {
  verifyPrerequisite,
  verifyRuntimeValidation,
} from "./prerequisites.js";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { readJsonl } from "./logging.js";
import { sha256, assert, Verdict, LIMITS } from "./domain.js";
import { currentProtocol, protocolBinding, digest } from "./protocol.js";
import { greedySetCover } from "./track2.js";

const files = [
  "run.json",
  "attempts.jsonl",
  "finals.jsonl",
  "events.jsonl",
  "track2.jsonl",
  "blackbox.jsonl",
  "baseline.json",
  "responses.jsonl",
  "analysis-plan.json",
  "runtime-validation.json",
];
async function hashes(directory) {
  const result = {};
  for (const file of files) {
    try {
      assert(
        (await stat(join(directory, file))).size <= 128 * 1024 * 1024,
        "Evidence artifact exceeds supported 128 MiB limit",
      );
      result[file] = sha256(await readFile(join(directory, file)));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      result[file] = null;
    }
  }
  return result;
}
export async function sealEvidence(directory) {
  const content = { ...protocolBinding(), files: await hashes(directory) };
  await writeFile(
    join(directory, "seal.json"),
    JSON.stringify({ ...content, sha: digest(content) }, null, 2),
    { flag: "wx" },
  );
}
export function validatePairs(metadata, attempts, finals) {
  const seen = new Set();
  for (const f of finals) {
    const key = JSON.stringify([f.problem_id, f.submission_id, f.method]);
    assert(!seen.has(key), "Duplicate final pair");
    seen.add(key);
    assert(
      f.run_id === metadata.run_id && currentProtocol(f),
      "Stale final identity",
    );
    const a = attempts.filter(
      (a) =>
        a.problem_id === f.problem_id &&
        a.submission_id === f.submission_id &&
        a.method === f.method,
    );
    assert(
      a.length === f.attempts_used && a.length > 0,
      "Final/attempt mismatch",
    );
    const budget =
      f.method === "random50"
        ? Math.max(...LIMITS.baselineBudgets)
        : f.method === "ai-one-shot"
          ? 1
          : LIMITS.attempts;
    assert(
      a.length <= budget &&
        a.every(
          (r, i) =>
            r.attempt === i + 1 &&
            r.run_id === metadata.run_id &&
            currentProtocol(r) &&
            r.corpus_id === metadata.corpus_id &&
            r.config_id === metadata.config_id &&
            Object.values(Verdict).includes(r.verdict),
        ),
      "Invalid attempt binding or sequence",
    );
    const killed = a.at(-1).verdict === Verdict.KILL;
    assert(
      !a.slice(0, -1).some((r) => r.verdict === Verdict.KILL),
      "Attempts continued after stopping rule",
    );
    assert(
      f.killed === killed && f.kill_at_1 === (killed && a.length === 1),
      "Final verdict mismatch",
    );
    assert(
      f.killer_script_sha ===
        (killed ? sha256(a.at(-1).generator_script) : null),
      "Killer provenance mismatch",
    );
    assert(
      a.every((r) => r.sub_hash === a[0].sub_hash),
      "Target changed within pair",
    );
    assert(killed || a.length === budget, "Incomplete pair");
    assert(
      f.inconclusive ===
        (!killed && a.some((r) => r.verdict === Verdict.INCONCLUSIVE)),
      "Inconclusive flag mismatch",
    );
    assert(
      a.every((r) => Number.isFinite(r.cost_usd) && r.cost_usd >= 0) &&
        Math.abs(f.total_cost_usd - a.reduce((n, r) => n + r.cost_usd, 0)) <
          1e-9,
      "Cost mismatch",
    );
  }
  assert(
    attempts.length === finals.reduce((n, f) => n + f.attempts_used, 0),
    "Orphan attempts",
  );
}
// Integrity, not cryptographic attestation: a privileged local operator can rewrite
// artifacts and seals together. Human review and external runtime evidence remain gates.
export async function inspectEvidence(directory) {
  try {
    const metadata = JSON.parse(
      await readFile(join(directory, "run.json"), "utf8"),
    );
    if (!currentProtocol(metadata))
      return {
        official: false,
        status: "LEGACY",
        reason: "Incompatible or absent protocol binding",
        metadata,
      };
    const seal = JSON.parse(
        await readFile(join(directory, "seal.json"), "utf8"),
      ),
      { sha, ...content } = seal;
    assert(
      currentProtocol(seal) &&
        sha === digest(content) &&
        digest(seal.files) === digest(await hashes(directory)),
      "Evidence seal mismatch",
    );
    const [attempts, finals, events, track2] = await Promise.all(
      ["attempts", "finals", "events", "track2"].map((n) =>
        readJsonl(join(directory, n + ".jsonl")),
      ),
    );
    assert(
      events.filter(
        (e) => e.event === "run_started" && e.run_id === metadata.run_id,
      ).length === 1 &&
        events.filter(
          (e) => e.event === "run_complete" && e.run_id === metadata.run_id,
        ).length === 1,
      "Run not uniquely completed",
    );
    validatePairs(metadata, attempts, finals);
    // The same integrity rules apply to development suites shown in the UI.
    for (const frozen of track2.filter((t) => t.suite)) {
      const s = frozen.suite,
        { sha: hash, ...body } = s;
      assert(
        currentProtocol(s) &&
          digest(body) === hash &&
          s.corpus_id === metadata.corpus_id &&
          digest(frozen.matrix) === s.matrix_sha,
        "Frozen suite integrity failed",
      );
      assert(
        digest(greedySetCover(frozen.matrix)) === digest(s.selection),
        "Frozen selection differs from DEV matrix",
      );
      assert(
        s.tests.length === s.selection.suite_size &&
          s.tests.every(
            (t, i) =>
              t.id === sha256(t.script) &&
              t.id === s.selection.selected[i].test_id,
          ),
        "Selected generator identity mismatch",
      );
      const evaluations = track2.filter((t) => t.suite_sha === hash);
      assert(
        evaluations.length === 1 &&
          track2.indexOf(frozen) < track2.indexOf(evaluations[0]),
        "Held-out result missing, duplicated or precedes freeze",
      );
      const held = evaluations[0];
      assert(
        held.run_id === metadata.run_id &&
          held.problem_id === s.problem_id &&
          held.suite_size === s.tests.length,
        "Held-out binding mismatch",
      );
      assert(
        held.results.every(
          (r) =>
            r.verdicts.length === s.tests.length &&
            r.verdicts.every((v) => Object.values(Verdict).includes(v)) &&
            r.killed === r.verdicts.includes(Verdict.KILL) &&
            r.inconclusive ===
              (!r.killed && r.verdicts.includes(Verdict.INCONCLUSIVE)),
        ),
        "Held-out verdict summary mismatch",
      );
    }
    assert(
      digest(metadata.limits) === digest(LIMITS),
      "Recorded resource limits mismatch",
    );
    if (metadata.kind === "baseline") {
      const baseline = JSON.parse(
        await readFile(join(directory, "baseline.json"), "utf8"),
      );
      const { sha, frozen_at, ...body } = baseline;
      assert(
        currentProtocol(baseline) &&
          digest(body) === sha &&
          sha === metadata.baseline_sha &&
          baseline.corpus_id === metadata.corpus_id,
        "Baseline artifact identity mismatch",
      );
    }
    if (metadata.kind !== "official")
      return {
        official: false,
        status:
          metadata.kind === "demo" || metadata.kind === "smoke"
            ? "DEMO"
            : "VERIFIED",
        metadata,
      };
    verifyPrerequisite(metadata.preflight, metadata);
    const runtime = JSON.parse(
      await readFile(join(directory, "runtime-validation.json"), "utf8"),
    );
    assert(
      verifyRuntimeValidation(runtime, metadata) ===
        metadata.runtime_validation_id,
      "Runtime validation identity mismatch",
    );
    const plan = JSON.parse(
      await readFile(join(directory, "analysis-plan.json"), "utf8"),
    );
    assert(
      verifyAnalysisPlan(plan, metadata) ===
        metadata.preflight.analysis_plan_sha &&
        Date.parse(plan.frozen_at) <= Date.parse(metadata.started_at),
      "Analysis plan binding/time mismatch",
    );
    const responses = await readJsonl(join(directory, "responses.jsonl"));
    assert(
      responses.length === attempts.length,
      "Private response evidence incomplete",
    );
    for (const a of attempts) {
      const matches = responses.filter(
        (r) =>
          r.run_id === a.run_id &&
          r.problem_id === a.problem_id &&
          r.submission_id === a.submission_id &&
          r.attempt === a.attempt,
      );
      assert(matches.length === 1, "Response identity missing/duplicated");
      const r = matches[0];
      assert(
        currentProtocol(r) &&
          r.config_id === metadata.config_id &&
          r.provider_model === a.provider_model &&
          r.tokens_in === a.tokens_in &&
          r.tokens_out === a.tokens_out &&
          r.cost_usd === a.cost_usd &&
          /^sha256:[a-f0-9]{64}$/.test(r.raw_response_sha) &&
          (r.raw_response === null ||
            sha256(r.raw_response) === r.raw_response_sha),
        "Response provenance mismatch",
      );
    }
    assert(
      metadata.preflight?.ok === true &&
        currentProtocol(metadata.preflight) &&
        metadata.preflight.corpus_id === metadata.corpus_id &&
        metadata.preflight.config_id === metadata.config_id,
      "Bound official preflight absent",
    );
    assert(
      metadata.source_clean === true &&
        /^[a-f0-9]{40}$/.test(metadata.git_commit) &&
        metadata.sandbox?.kind === "docker" &&
        metadata.image_id === metadata.sandbox.imageId &&
        /^sha256:[a-f0-9]{64}$/.test(metadata.sandbox.imageId),
      "Revision or runtime identity missing",
    );
    assert(
      finals.length ===
        CURRENT_PROTOCOL.population.problems *
          CURRENT_PROTOCOL.population.devPerProblem &&
        new Set(finals.map((f) => f.problem_id)).size ===
          CURRENT_PROTOCOL.population.problems,
      "Official pair count mismatch",
    );
    assert(
      metadata.expected_pairs?.length ===
        CURRENT_PROTOCOL.population.problems *
          CURRENT_PROTOCOL.population.devPerProblem &&
        metadata.expected_pairs.every(
          (p) =>
            finals.filter(
              (f) =>
                f.problem_id === p.problem_id &&
                f.submission_id === p.submission_id,
            ).length === 1 &&
            attempts
              .filter(
                (a) =>
                  a.problem_id === p.problem_id &&
                  a.submission_id === p.submission_id,
              )
              .every((a) => a.sub_hash === p.source_hash),
        ),
      "Official pairs differ from frozen corpus assignment",
    );
    assert(
      finals.every((f) => f.method === "ai" && f.origin === "human") &&
        attempts.every(
          (a) =>
            a.oracle_kind === "reviewed" &&
            a.execution_kind === "docker" &&
            a.provider_kind === "live" &&
            a.provider_model === metadata.model,
        ),
      "Synthetic, unreviewed or provider-drift evidence",
    );
    for (const id of new Set(finals.map((f) => f.problem_id))) {
      assert(
        finals.filter((f) => f.problem_id === id).length ===
          CURRENT_PROTOCOL.population.devPerProblem,
        "Official per-problem count mismatch",
      );
      const frozen = track2.filter(
          (t) => t.problem_id === id && t.event === "suite_frozen",
        ),
        held = track2.filter(
          (t) => t.problem_id === id && t.event === "held_out_evaluated",
        );
      assert(
        frozen.length === 1 &&
          held.length === 1 &&
          track2.indexOf(frozen[0]) < track2.indexOf(held[0]),
        "Frozen/held-out ordering invalid",
      );
      const s = frozen[0].suite,
        { sha: hs, ...body } = s;
      assert(
        currentProtocol(s) &&
          digest(body) === hs &&
          s.corpus_id === metadata.corpus_id &&
          digest(frozen[0].matrix) === s.matrix_sha &&
          held[0].suite_sha === hs,
        "Held-out suite binding mismatch",
      );
      assert(
        held[0].results.length ===
          CURRENT_PROTOCOL.population.heldOutPerProblem &&
          new Set(held[0].results.map((r) => r.submission_id)).size ===
            CURRENT_PROTOCOL.population.heldOutPerProblem,
        "Held-out denominator mismatch",
      );
    }
    return { official: true, status: "VERIFIED", metadata };
  } catch (e) {
    return {
      official: false,
      status: "INCOMPLETE",
      reason:
        e.code === "ENOENT"
          ? "Required evidence artifact is absent"
          : e.message,
    };
  }
}
