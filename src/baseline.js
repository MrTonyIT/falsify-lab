import { assert, sha256, LIMITS } from "./domain.js";
import { corpusIdentity } from "./corpus.js";
import { runPair } from "./falsify.js";
import {
  protocolBinding,
  currentProtocol,
  digest,
  deepFreeze,
} from "./protocol.js";
export function freezeBaseline(problems) {
  const generators = problems.map((p) => {
    assert(
      typeof p.randomGenerator === "function",
      "Manual random generator required for every problem",
    );
    return {
      problem_id: p.id,
      scripts: Array.from(
        { length: Math.max(...LIMITS.baselineBudgets) },
        (_, i) => p.randomGenerator(LIMITS.seed + i),
      ),
      plugin_hash: p.randomHash,
    };
  });
  const protocol = {
    ...protocolBinding(),
    generator_family:
      "operator-authored structured random; not uniform over valid inputs",
    corpus_id: corpusIdentity(problems),
    seed: LIMITS.seed,
    budgets: LIMITS.baselineBudgets,
    generators,
  };
  return deepFreeze({
    ...protocol,
    sha: digest(protocol),
    frozen_at: new Date().toISOString(),
  });
}
export function verifyBaseline(frozen, problems) {
  const { sha, frozen_at, ...protocol } = frozen;
  assert(currentProtocol(frozen), "Baseline protocol is incompatible");
  assert(digest(protocol) === sha, "Frozen baseline contents were modified");
  const current = freezeBaseline(problems);
  assert(
    current.sha === frozen.sha,
    "Random baseline or corpus changed after freezing",
  );
  return true;
}
export async function runBaselines({
  problems,
  frozen,
  evaluator,
  log,
  metadata,
}) {
  verifyBaseline(frozen, problems);
  for (const p of problems)
    for (const target of p.dev)
      for (const k of LIMITS.baselineBudgets)
        await runPair({
          problem: p,
          target,
          evaluator,
          log,
          metadata,
          scripts: frozen.generators.find((g) => g.problem_id === p.id).scripts,
          method: "random" + k,
          budget: k,
        });
  await log.append("events", {
    run_id: metadata.run_id,
    event: "baseline_complete",
    baseline_sha: frozen.sha,
    completed_at: new Date().toISOString(),
  });
}
