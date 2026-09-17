import { assert } from "./domain.js";
import { bucket, seededRandom } from "./corpus.js";
const median = (values) => {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y),
    i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
};
const percent = (n, d) => (d ? (100 * n) / d : null);
export function metrics(finals, attempts = []) {
  const eligible = finals.filter((r) => r.killed || !r.inconclusive),
    kills = finals.filter((r) => r.killed),
    first = eligible.filter((r) => r.kill_at_1).length;
  const kills3 = kills.filter((r) => (r.attempts_used ?? 3) <= 3).length;
  const kill1 = percent(first, eligible.length),
    kill3 = percent(kills3, eligible.length);
  return {
    pairs: finals.length,
    eligible_pairs: eligible.length,
    excluded_inconclusive: finals.length - eligible.length,
    kill_at_1: kill1,
    kill_at_3: kill3,
    kill_at_50: finals.every((r) => r.method === "random50")
      ? percent(kills.length, eligible.length)
      : null,
    kill_at_budget: percent(kills.length, eligible.length),
    delta_pp: kill1 === null ? null : kill3 - kill1,
    all_pair_kill_at_50: finals.every((r) => r.method === "random50")
      ? percent(kills.length, finals.length)
      : null,
    all_pair_kill_at_1: percent(first, finals.length),
    all_pair_kill_at_3: percent(kills3, finals.length),
    invalid_rate: percent(
      attempts.filter((r) => r.verdict === "invalid").length,
      attempts.length,
    ),
    unusable_rate: percent(
      attempts.filter((r) => r.verdict === "unusable").length,
      attempts.length,
    ),
    reference_disagreement_rate: percent(
      attempts.filter((r) => r.detail === "reference_disagreement").length,
      attempts.length,
    ),
    inconclusive_rate: percent(
      attempts.filter((r) => r.verdict === "inconclusive").length,
      attempts.length,
    ),
    gen_failed_rate: percent(
      attempts.filter((r) => r.verdict === "gen_failed").length,
      attempts.length,
    ),
    median_input_bytes: median(
      kills.map((r) => r.min_input_size).filter(Number.isFinite),
    ),
    median_semantic_size: median(
      kills.map((r) => r.semantic_size).filter(Number.isFinite),
    ),
    cost_per_kill: kills.length
      ? finals.reduce((s, r) => s + r.total_cost_usd, 0) / kills.length
      : null,
  };
}
export function problemBootstrap(
  finals,
  { seed = 12345, repetitions = 2000 } = {},
) {
  assert(
    Number.isInteger(repetitions) && repetitions >= 1,
    "Positive bootstrap repetitions required",
  );
  const groups = new Map();
  for (const r of finals) {
    if (!groups.has(r.problem_id)) groups.set(r.problem_id, []);
    groups.get(r.problem_id).push(r);
  }
  const ids = [...groups.keys()].sort(),
    rng = seededRandom(seed),
    draws = [];
  if (ids.length < 2)
    return {
      seed,
      repetitions,
      clusters: ids.length,
      ci95: null,
      unit: "problem",
      metric: "all_pair_kill_at_3",
      limitation:
        "At least two problem clusters are required; no defensible uncertainty estimate with one cluster.",
    };
  for (let i = 0; i < repetitions; i++) {
    const sample = [];
    for (let j = 0; j < ids.length; j++)
      sample.push(...groups.get(ids[Math.floor(rng() * ids.length)]));
    const m = metrics(sample);
    if (m.all_pair_kill_at_3 !== null) draws.push(m.all_pair_kill_at_3);
  }
  draws.sort((a, b) => a - b);
  return {
    seed,
    repetitions,
    clusters: ids.length,
    ci95: draws.length
      ? [
          draws[Math.floor((draws.length - 1) * 0.025)],
          draws[Math.ceil((draws.length - 1) * 0.975)],
        ]
      : null,
    unit: "problem",
    metric: "all_pair_kill_at_3",
    method: "percentile cluster bootstrap; ratio of pooled pair counts",
    valid_draws: draws.length,
    limitation:
      "Effective information is closer to the number of problems than the number of submissions.",
  };
}
export function analyze(finals, attempts, options = {}) {
  const identity = (r) => `${r.run_id}|${r.method}|${r.origin}`;
  const groups = {};
  for (const key of new Set(finals.map(identity))) {
    const f = finals.filter((r) => identity(r) === key),
      a = attempts.filter((r) => identity(r) === key),
      breakdowns = {};
    for (const dimension of [
      "passed_test_count",
      "division",
      "bug_type",
      "contamination_group",
    ]) {
      const value = (r) =>
        dimension === "passed_test_count"
          ? bucket(r[dimension])
          : (r[dimension] ?? "unlabeled");
      breakdowns[dimension] = Object.fromEntries(
        [...new Set(f.map(value))].map((v) => [
          v,
          metrics(
            f.filter((r) => value(r) === v),
            a.filter((r) => value(r) === v),
          ),
        ]),
      );
    }
    groups[key] = {
      ...metrics(f, a),
      bootstrap: problemBootstrap(f, options),
      breakdowns,
      survivors: f
        .filter((r) => !r.killed)
        .map((r) => ({
          problem_id: r.problem_id,
          submission_id: r.submission_id,
          bug_type: r.bug_type ?? null,
          inconclusive: r.inconclusive,
        })),
    };
  }
  return { status: finals.length ? "MEASURED" : "NOT RUN", groups };
}

// Matched experimental pairs, resampled as whole problems. Caller must additionally
// establish compatible corpus/configuration and information/cost allocations.
export function pairedProblemBootstrap(
  left,
  right,
  { seed = 12345, repetitions = 2000 } = {},
) {
  assert(
    Number.isInteger(repetitions) && repetitions > 0,
    "Positive bootstrap repetitions required",
  );
  const key = (r) => JSON.stringify([r.problem_id, r.submission_id]);
  const l = new Map(left.map((r) => [key(r), r])),
    r = new Map(right.map((r) => [key(r), r]));
  assert(
    l.size === left.length && r.size === right.length,
    "Duplicate experimental pair",
  );
  assert(
    l.size > 0 && l.size === r.size && [...l.keys()].every((k) => r.has(k)),
    "Comparisons require the same assigned pairs",
  );
  const groups = new Map();
  for (const row of left) {
    if (!groups.has(row.problem_id)) groups.set(row.problem_id, []);
    groups.get(row.problem_id).push(key(row));
  }
  const ids = [...groups.keys()].sort(),
    rng = seededRandom(seed),
    draws = [];
  const effect = (keys) =>
    metrics(keys.map((k) => l.get(k))).all_pair_kill_at_3 -
    metrics(keys.map((k) => r.get(k))).all_pair_kill_at_3;
  const result = {
    seed,
    repetitions,
    clusters: ids.length,
    pairs: l.size,
    delta_pp: effect([...l.keys()]),
    metric: "all_pair_kill_at_3",
    unit: "problem",
    ci95: null,
    interpretation:
      "Paired percentile interval; no multiplicity correction or causal significance claim",
  };
  if (ids.length < 2) return result;
  for (let i = 0; i < repetitions; i++) {
    const keys = [];
    for (let j = 0; j < ids.length; j++)
      keys.push(...groups.get(ids[Math.floor(rng() * ids.length)]));
    draws.push(effect(keys));
  }
  draws.sort((a, b) => a - b);
  result.ci95 = [
    draws[Math.floor((draws.length - 1) * 0.025)],
    draws[Math.ceil((draws.length - 1) * 0.975)],
  ];
  return result;
}
