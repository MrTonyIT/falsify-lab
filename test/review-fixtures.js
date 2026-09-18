import { protocolBinding, digest } from "../src/protocol.js";
import { LIMITS } from "../src/domain.js";
import { freezeAnalysisPlan } from "../src/analysis-plan.js";
export function runtimeFixture(commit, imageId) {
  const r = {
    ...protocolBinding(),
    git_commit: commit,
    images: {
      python: { imageId, baseImage: "python@sha256:" + "c".repeat(64) },
      multilang: {
        imageId: "sha256:" + "d".repeat(64),
        baseImage: "debian@sha256:" + "e".repeat(64),
      },
    },
    docker_version: "TEST DOUBLE",
    versions: { python: "TEST DOUBLE", multilang: { gcc: "TEST DOUBLE" } },
    test_results: { passed: 2, failed: 0, skipped: 0, cancelled: 0 },
    timestamp: new Date().toISOString(),
  };
  return { ...r, sha: digest(r) };
}
export function planFixture(binding) {
  return freezeAnalysisPlan(
    {
      hypotheses: ["UNIT TEST ONLY"],
      primary_endpoint: "all_pair_kill_at_3",
      secondary_endpoints: ["eligible_pair_kill_at_3"],
      denominator_policy: "all-assigned-pairs",
      bootstrap: {
        method: "problem-cluster-percentile",
        repetitions: 100,
        seed: LIMITS.seed,
      },
      planned_comparisons: ["random3", "random50"],
      multiplicity_interpretation: "Descriptive; no adjusted inference",
      exclusions: "None",
      stopping_policy: "first-confirmed-kill-or-budget",
      attempt_budget: LIMITS.attempts,
      reviewer: "TEST DOUBLE",
    },
    binding,
  );
}
