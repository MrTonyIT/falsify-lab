import { readFile, writeFile } from "node:fs/promises";
import { assert, LIMITS } from "./domain.js";
import {
  protocolBinding,
  currentProtocol,
  digest,
  deepFreeze,
} from "./protocol.js";

export function freezeAnalysisPlan(content, binding) {
  for (const key of ["git_commit", "corpus_id", "config_id"])
    assert(
      typeof binding[key] === "string" && binding[key].length > 0,
      `Analysis plan ${key} required`,
    );
  const plan = {
    ...content,
    ...binding,
    ...protocolBinding(),
    plan_version: 1,
  };
  assert(
    Array.isArray(plan.hypotheses) &&
      plan.hypotheses.length &&
      plan.hypotheses.every((s) => typeof s === "string" && s.trim()),
    "Actual hypotheses required",
  );
  assert(
    plan.primary_endpoint === "all_pair_kill_at_3",
    "Primary endpoint must match protocol",
  );
  assert(
    Array.isArray(plan.secondary_endpoints) &&
      plan.secondary_endpoints.length &&
      plan.secondary_endpoints.every((s) => typeof s === "string" && s.trim()),
    "Secondary endpoints required",
  );
  assert(
    plan.denominator_policy === "all-assigned-pairs",
    "Full denominator policy required",
  );
  assert(
    plan.bootstrap?.method === "problem-cluster-percentile" &&
      Number.isSafeInteger(plan.bootstrap.repetitions) &&
      plan.bootstrap.repetitions >= 100 &&
      Number.isSafeInteger(plan.bootstrap.seed),
    "Explicit cluster bootstrap settings required",
  );
  assert(
    Array.isArray(plan.planned_comparisons) &&
      plan.planned_comparisons.length &&
      plan.planned_comparisons.every((s) => typeof s === "string" && s.trim()),
    "Planned comparisons required",
  );
  assert(
    [
      "multiplicity_interpretation",
      "exclusions",
      "stopping_policy",
      "reviewer",
    ].every((k) => typeof plan[k] === "string" && plan[k].trim()),
    "Interpretation, exclusions, stopping policy and operator identity required",
  );
  assert(
    plan.attempt_budget === LIMITS.attempts &&
      plan.stopping_policy === "first-confirmed-kill-or-budget",
    "Stopping policy must match protocol",
  );
  const frozen = { ...plan, frozen_at: new Date().toISOString() };
  return deepFreeze({ ...frozen, sha: digest(frozen) });
}
export function verifyAnalysisPlan(plan, binding) {
  assert(
    plan && currentProtocol(plan) && plan.plan_version === 1,
    "Frozen analysis plan is missing or incompatible",
  );
  const { sha, ...content } = plan;
  assert(sha === digest(content), "Analysis plan changed after freezing");
  for (const key of ["git_commit", "corpus_id", "config_id"])
    assert(plan[key] === binding[key], `Analysis plan ${key} mismatch`);
  const checked = freezeAnalysisPlan(content, binding); // Validate contents, not its new timestamp.
  assert(
    checked.primary_endpoint === plan.primary_endpoint,
    "Invalid analysis plan",
  );
  assert(
    Number.isFinite(Date.parse(plan.frozen_at)) &&
      Date.parse(plan.frozen_at) <= Date.now(),
    "Invalid analysis-plan freeze time",
  );
  return plan.sha;
}
export async function writeAnalysisPlan(input, output, binding) {
  const content = JSON.parse(await readFile(input, "utf8"));
  const plan = freezeAnalysisPlan(content, binding);
  await writeFile(output, JSON.stringify(plan, null, 2), { flag: "wx" });
  return plan;
}
