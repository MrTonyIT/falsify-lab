import { preserveResponse } from "./responses.js";
import { assert, devTarget, sha256, Verdict as V, LIMITS } from "./domain.js";
import { corpusIdentity } from "./corpus.js";
import { protocolBinding, currentProtocol, digest } from "./protocol.js";
import { buildBlackboxPrompt, parseResponse } from "./prompt.js";
export function collectCandidates(problem, attempts, runId) {
  const dev = new Map(problem.dev.map((s) => [String(s.id), s]));
  const unique = new Map();
  for (const r of attempts.filter(
    (r) =>
      r.run_id === runId && r.problem_id === problem.id && r.method === "ai",
  )) {
    const target = dev.get(String(r.submission_id));
    assert(target, "Attempt source is not in DEV");
    devTarget(target);
    assert(r.sub_hash === sha256(target.code), "Attempt target hash mismatch");
    assert(currentProtocol(r), "Candidate evidence has incompatible protocol");
    if (
      r.generator_script &&
      ![V.GEN_FAILED, V.INVALID_INPUT, V.UNUSABLE].includes(r.verdict)
    )
      unique.set(sha256(r.generator_script), {
        id: sha256(r.generator_script),
        script: r.generator_script,
        input_sha: r.input_sha,
        seed: r.seed,
      });
  }
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export async function buildKillMatrix(problem, candidates, evaluator) {
  problem.dev.forEach(devTarget);
  const rows = [];
  for (const c of candidates) {
    const gen = await evaluator.generate(c.script);
    assert(!gen.error, "Candidate regeneration failed");
    assert(
      sha256(gen.data) === c.input_sha,
      "Generator not reproducible: input hash changed",
    );
    const prepared = await evaluator.prepare(problem, gen.data);
    assert(!prepared.verdict, "Previously usable candidate no longer usable");
    const verdicts = [];
    for (const s of problem.dev)
      verdicts.push((await evaluator.judge(problem, s, prepared)).verdict);
    rows.push({
      test_id: c.id,
      kills: verdicts.map((v) => (v === V.KILL ? 1 : 0)),
      verdicts,
    });
  }
  return {
    problem_id: problem.id,
    split: "dev",
    submission_ids: problem.dev.map((s) => s.id),
    rows,
  };
}
export function greedySetCover(matrix) {
  assert(matrix.split === "dev", "Selection must use DEV only");
  const n = matrix.submission_ids.length;
  const covered = new Set(),
    selected = [];
  let remaining = [...matrix.rows].sort((a, b) =>
    a.test_id.localeCompare(b.test_id),
  );
  assert(new Set(matrix.submission_ids).size === n, "Duplicate DEV columns");
  assert(
    new Set(remaining.map((r) => r.test_id)).size === remaining.length,
    "Duplicate tests",
  );
  assert(
    remaining.every(
      (r) =>
        !r.verdicts ||
        (r.verdicts.length === n &&
          r.verdicts.every(
            (v, i) =>
              Object.values(V).includes(v) &&
              r.kills[i] === Number(v === V.KILL),
          )),
    ),
    "Verdict/matrix mismatch",
  );
  assert(
    remaining.every(
      (r) => r.kills.length === n && r.kills.every((v) => v === 0 || v === 1),
    ),
    "Malformed matrix",
  );
  while (remaining.length) {
    const gains = (r) =>
      r.kills.flatMap((v, i) => (v && !covered.has(i) ? [i] : []));
    remaining.sort(
      (a, b) =>
        gains(b).length - gains(a).length || a.test_id.localeCompare(b.test_id),
    );
    const row = remaining.shift(),
      gain = gains(row);
    if (!gain.length) break;
    gain.forEach((i) => covered.add(i));
    selected.push({
      test_id: row.test_id,
      incremental_coverage: gain.length,
      total_coverage: covered.size,
    });
  }
  return {
    selected,
    suite_size: selected.length,
    dev_covered: covered.size,
    dev_total: n,
  };
}
export function freezeSuite(problem, candidates, matrix, corpusId) {
  assert(
    matrix.problem_id === problem.id &&
      JSON.stringify(matrix.submission_ids) ===
        JSON.stringify(problem.dev.map((s) => s.id)),
    "Matrix does not match DEV partition",
  );
  assert(
    !problem.dev.some((d) =>
      problem.heldOut.some(
        (h) =>
          String(d.id) === String(h.id) || sha256(d.code) === sha256(h.code),
      ),
    ),
    "DEV/held-out overlap",
  );
  assert(
    candidates.every((c) => c.id === sha256(c.script)),
    "Candidate source hash mismatch",
  );
  const selection = greedySetCover(matrix);
  const tests = selection.selected.map((s) => {
    const candidate = candidates.find((c) => c.id === s.test_id);
    assert(candidate, "Selected candidate missing");
    return { ...candidate };
  });
  const content = {
    ...protocolBinding(),
    problem_id: problem.id,
    problem_identity: corpusIdentity([problem]),
    corpus_id: corpusId,
    selection,
    matrix_sha: digest(matrix),
    tests,
    frozen_at: new Date().toISOString(),
  };
  const result = { ...content, sha: digest(content) };
  return deepFreeze(result);
}
function deepFreeze(obj) {
  Object.values(obj)
    .filter((v) => v && typeof v === "object")
    .forEach(deepFreeze);
  return Object.freeze(obj);
}
export function verifySuite(suite, problem, corpusId) {
  const { sha, ...content } = suite;
  assert(currentProtocol(suite), "Frozen suite protocol is incompatible");
  assert(digest(content) === sha, "Frozen suite hash mismatch");
  assert(
    suite.problem_identity === corpusIdentity([problem]),
    "Problem changed after suite freeze",
  );
  assert(
    suite.problem_id === problem.id && suite.corpus_id === corpusId,
    "Suite belongs to different corpus",
  );
  assert(
    suite.tests.length === suite.selection.suite_size,
    "Suite selection mismatch",
  );
  return deepFreeze(suite);
}
export async function evaluateHeldOut(problem, suite, evaluator, corpusId) {
  verifySuite(suite, problem, corpusId);
  assert(
    problem.heldOut.every((s) => s.split === "held-out"),
    "Held-out partition required",
  );
  const prepared = [];
  for (const test of suite.tests) {
    const gen = await evaluator.generate(test.script);
    assert(
      !gen.error && sha256(gen.data) === test.input_sha,
      "Frozen test changed",
    );
    const p = await evaluator.prepare(problem, gen.data);
    assert(!p.verdict, "Frozen test no longer usable");
    prepared.push(p);
  }
  const results = [];
  for (const target of problem.heldOut) {
    const verdicts = [];
    for (const p of prepared)
      verdicts.push((await evaluator.judge(problem, target, p)).verdict);
    results.push({
      submission_id: target.id,
      source_hash: sha256(target.code),
      killed: verdicts.includes(V.KILL),
      inconclusive:
        !verdicts.includes(V.KILL) && verdicts.includes(V.INCONCLUSIVE),
      verdicts,
    });
  }
  return {
    problem_id: problem.id,
    suite_sha: suite.sha,
    suite_size: suite.tests.length,
    selection: suite.selection,
    split: "held-out",
    results,
  };
}
export async function generateBlackbox({
  problem,
  k = LIMITS.attempts,
  llm,
  evaluator,
  log,
  metadata,
}) {
  assert(Number.isInteger(k) && k > 0, "Positive K required");
  const candidates = [];
  for (let i = 1; i <= k; i++) {
    const response = await llm.call(buildBlackboxPrompt(problem, i, k));
    await preserveResponse(log, response, metadata, {
      problem_id: problem.id,
      attempt: i,
      retainRaw: metadata.retain_raw_responses !== false,
    });
    if (metadata.snapshot_pinned && response.providerModel !== metadata.model) {
      await log.append("events", {
        run_id: metadata.run_id,
        event: "provider_snapshot_changed",
        tokens_in: response.tokensIn,
        tokens_out: response.tokensOut,
        cost_usd: response.costUsd,
        provider_model: response.providerModel,
      });
      throw Error("Provider snapshot changed");
    }
    const parsed = parseResponse(response.text),
      gen = await evaluator.generate(parsed.script);
    const prepared = gen.error
      ? { verdict: V.GEN_FAILED }
      : await evaluator.prepare(problem, gen.data);
    const record = {
      ...protocolBinding(),
      corpus_id: metadata.corpus_id,
      config_id: metadata.config_id,
      provider_model: response.providerModel,
      run_id: metadata.run_id,
      problem_id: problem.id,
      attempt: i,
      generator_script: parsed.script,
      verdict: prepared.verdict ?? "usable",
      input_sha: gen.data ? sha256(gen.data) : null,
      seed: LIMITS.seed,
      tokens_in: response.tokensIn,
      tokens_out: response.tokensOut,
      cost_usd: response.costUsd,
      latency_ms: response.latencyMs,
    };
    await log.append("blackbox", record);
    if (!prepared.verdict)
      candidates.push({
        id: sha256(parsed.script),
        script: parsed.script,
        input_sha: record.input_sha,
        seed: LIMITS.seed,
      });
  }
  return [...new Map(candidates.map((c) => [c.id, c])).values()];
}
