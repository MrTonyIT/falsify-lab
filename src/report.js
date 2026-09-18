import { verifyPrerequisite } from "./prerequisites.js";
import { SCIENTIFIC_LIMITS as SCI_LIMITS } from "./protocol.js";
import { inspectEvidence } from "./evidence.js";
import { readJsonl } from "./logging.js";
import { analyze } from "./metrics.js";
import { join } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import { assert } from "./domain.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) =>
  n === null || n === undefined ? "N/A" : Number(n).toFixed(2);
export async function report(
  directory,
  {
    seed = SCI_LIMITS.seed,
    repetitions = 2000,
    labels = [],
    comparisonDirectories = [],
    includeScripts = false,
  } = {},
) {
  const evidence = await Promise.all(
    [directory, ...comparisonDirectories].map(inspectEvidence),
  );
  verifyReportComparisons(evidence);
  if (evidence[0].official) {
    const plan = JSON.parse(
      await readFile(join(directory, "analysis-plan.json"), "utf8"),
    );
    seed = plan.bootstrap.seed;
    repetitions = plan.bootstrap.repetitions;
  }
  const attempts = [],
    finals = [],
    events = [],
    track2 = [];
  for (const dir of [directory, ...comparisonDirectories]) {
    attempts.push(...(await readJsonl(join(dir, "attempts.jsonl"))));
    finals.push(...(await readJsonl(join(dir, "finals.jsonl"))));
    events.push(...(await readJsonl(join(dir, "events.jsonl"))));
    track2.push(
      ...(await readJsonl(join(dir, "track2.jsonl"))).map((r) =>
        includeScripts ? r : redactScripts(r),
      ),
    );
  }
  const seen = new Set();
  for (const f of finals) {
    const key = JSON.stringify([
      f.run_id,
      f.method,
      f.problem_id,
      f.submission_id,
    ]);
    assert(
      !seen.has(key),
      "Duplicate final records: do not silently double-count",
    );
    seen.add(key);
    const a = attempts.filter(
      (a) =>
        a.run_id === f.run_id &&
        a.method === f.method &&
        a.problem_id === f.problem_id &&
        a.submission_id === f.submission_id,
    );
    assert(a.length === f.attempts_used, "Final/attempt mismatch");
    const label = labels.find(
      (l) =>
        l.problem_id === f.problem_id && l.submission_id === f.submission_id,
    );
    if (label) f.bug_type = label.bug_type;
  }
  const summary = analyze(finals, attempts, { seed, repetitions });
  const starts = events.filter((e) => e.event === "run_started");
  const completed =
    starts.length > 0 &&
    starts.every((s) =>
      events.some((e) => e.event === "run_complete" && e.run_id === s.run_id),
    );
  const official = evidence[0].official;
  for (const [key, group] of Object.entries(summary.groups)) {
    const row = finals.find(
      (f) => key === `${f.run_id}|${f.method}|${f.origin}`,
    );
    const item = evidence.find((e) => e.metadata?.run_id === row?.run_id);
    group.evidence_status = item?.status ?? "INCOMPLETE";
    group.official_status = item?.official ? "MEASURED" : "NOT RUN";
  }
  const result = {
    ...summary,
    evidence,
    official_status: official ? "MEASURED" : "NOT RUN",
    run_complete: completed,
    attempt_count: attempts.length,
    observed_cost_usd: attempts.reduce((s, a) => s + a.cost_usd, 0),
    track2,
  };
  const rows = Object.entries(summary.groups)
    .map(
      ([key, m]) =>
        `<tr><td>${esc(key)}</td><td>${m.pairs}</td><td>${fmt(m.kill_at_1)}</td><td>${fmt(m.kill_at_3)}</td><td>${fmt(m.kill_at_50)}</td><td>${fmt(m.delta_pp)}</td><td>${fmt(m.invalid_rate)}</td><td>${fmt(m.unusable_rate)}</td><td>${fmt(m.inconclusive_rate)}</td><td>${fmt(m.median_semantic_size)}</td><td>${fmt(m.median_input_bytes)}</td><td>${fmt(m.cost_per_kill)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>AI Falsifier results</title><style>body{font:16px system-ui;max-width:1200px;margin:40px auto;padding:0 20px;color:#182433}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:10px;border:1px solid #ccd3db;text-align:left}th{background:#edf1f5}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>AI Falsifier</h1><p>Official benchmark: <strong>${result.official_status}</strong>. Run complete: ${completed ? "yes" : "no"}. ${official ? "" : "Any measurements below are development/pilot data, not official findings."}</p><p>JSONL is authoritative. Primary metric is all_pair_kill_at_3 with the full denominator. Displayed eligible-pair kill rates are secondary and exclude un-killed pairs with an inconclusive attempt; full-denominator rates and excluded counts are included in report.json. Minimality is problem-defined semantic size, separately from input bytes.</p><table><thead><tr><th>Run / method / origin</th><th>Pairs</th><th>Kill@1 %</th><th>Kill@3 %</th><th>Kill@50 %</th><th>Gain pp</th><th>Invalid %</th><th>Unusable %</th><th>Inconclusive %</th><th>Median size</th><th>Median bytes</th><th>$/kill</th></tr></thead><tbody>${rows || '<tr><td colspan="12">NOT RUN</td></tr>'}</tbody></table><p>Random3 uses the same three-test budget; random50 is the extended comparison. Official Codeforces tests are a conceptual upper bound and are never acquired. Effective sample size is closer to problem count than submission count.</p><h2>Strata, confidence intervals and survivors</h2><pre>${esc(JSON.stringify(summary.groups, null, 2))}</pre><h2>Frozen-suite held-out evaluation</h2><pre>${esc(JSON.stringify(track2, null, 2))}</pre></html>`;
  await writeFile(
    join(directory, "report.json"),
    JSON.stringify(result, null, 2),
  );
  await writeFile(join(directory, "report.html"), html);
  return result;
}

export function verifyReportComparisons(evidence) {
  const primary = evidence[0];
  if (evidence.length > 1)
    for (const other of evidence.slice(1)) {
      assert(
        ["VERIFIED", "DEMO"].includes(primary.status) &&
          ["VERIFIED", "DEMO"].includes(other.status),
        "Comparison evidence must be complete and current",
      );
      for (const key of [
        "protocol_id",
        "protocol_version",
        "evidence_schema",
        "resource_policy_id",
        "corpus_id",
      ])
        assert(
          primary.metadata?.[key] !== undefined &&
            primary.metadata[key] === other.metadata?.[key],
          "Incompatible comparison " + key,
        );
      const official = primary.official
          ? primary
          : other.official
            ? other
            : null,
        baseline =
          primary.metadata.kind === "baseline"
            ? primary
            : other.metadata.kind === "baseline"
              ? other
              : null;
      if (official && baseline) {
        verifyPrerequisite(baseline.metadata, official.metadata);
        assert(
          official.metadata.preflight?.baseline_sha ===
            baseline.metadata.baseline_sha &&
            typeof baseline.metadata.baseline_sha === "string",
          "Official comparison requires exact expected baseline",
        );
      }
    }
  return primary.official;
}
export function redactScripts(value) {
  if (Array.isArray(value)) return value.map(redactScripts);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) => !["script", "generator_script", "raw_response"].includes(k),
        )
        .map(([k, v]) => [k, redactScripts(v)]),
    );
  return value;
}
