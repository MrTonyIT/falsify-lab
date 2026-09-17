import {
  devTarget,
  publicProblem,
  Verdict as V,
  LIMITS,
  sha256,
  assert,
} from "./domain.js";
import { protocolBinding } from "./protocol.js";
import { assessOracle } from "./oracle.js";
import { build_falsify_prompt, parseResponse, feedbackFor } from "./prompt.js";

export async function runPair({
  problem,
  target,
  evaluator,
  llm,
  log,
  metadata,
  scripts = null,
  method = "ai",
  budget = 3,
  knownWrong = true,
  feedback = true,
  onEvent = async () => {},
  onEvaluation = async () => {},
}) {
  devTarget(target);
  publicProblem(problem);
  assert(
    !problem.heldOut?.some(
      (s) =>
        String(s.id) === String(target.id) ||
        sha256(s.code) === sha256(target.code),
    ),
    "Held-out identity/source cannot be relabeled for generation",
  );
  if (metadata.kind === "official")
    assert(
      problem.dev.some(
        (s) =>
          String(s.id) === String(target.id) &&
          sha256(s.code) === sha256(target.code),
      ),
      "Official target must match frozen DEV assignment",
    );
  assert(
    scripts
      ? budget === 3 || budget === 50
      : budget === 3 || (method === "ai-one-shot" && budget === 1),
    "AI budget 3 (one-shot 1); random budgets 3/50",
  );
  assert(
    [
      "ai",
      "ai-one-shot",
      "ai-no-feedback",
      "random3",
      "random50",
      "demo",
    ].includes(method),
    "Unsupported method",
  );
  assert(
    method !== "ai-no-feedback" || feedback === false,
    "No-feedback ablation must disable feedback",
  );
  assert(
    metadata.kind !== "official" ||
      (method === "ai" && feedback === true && budget === 3),
    "Ablations cannot silently alter the official protocol",
  );
  const history = [],
    attemptRecords = [];
  let killerScript = null;
  for (let attempt = 1; attempt <= budget; attempt++) {
    await onEvent("attempt_started", { attempt });
    const attemptStarted = Date.now(),
      executionStart = evaluator.executions ?? 0;
    let response;
    try {
      await onEvent("llm_started", { attempt });
      response = scripts
        ? {
            text: "```python\n" + scripts[attempt - 1] + "\n```",
            tokensIn: 0,
            tokensOut: 0,
            cachedTokens: 0,
            costUsd: 0,
            latencyMs: 0,
          }
        : await llm.call(
            build_falsify_prompt(problem, target, feedback ? history : [], {
              knownWrong,
            }),
          );
    } catch (e) {
      await log.append("events", {
        run_id: metadata.run_id,
        problem_id: problem.id,
        submission_id: target.id,
        attempt,
        event: "infrastructure_abort",
        message: e.message,
      });
      throw e;
    }
    if (
      !scripts &&
      metadata.snapshot_pinned &&
      response.providerModel !== metadata.model
    ) {
      await log.append("events", {
        run_id: metadata.run_id,
        event: "provider_snapshot_changed",
        expected_model: metadata.model,
        provider_model: response.providerModel,
        tokens_in: response.tokensIn,
        tokens_out: response.tokensOut,
        cost_usd: response.costUsd,
      });
      throw new Error(
        "Provider snapshot changed; billing preserved and execution aborted",
      );
    }
    const parsed = parseResponse(response.text);
    await onEvent("generator_created", {
      attempt,
      generator_script: parsed.script,
    });
    let evaluation;
    try {
      evaluation = await evaluator.evaluate(problem, target, parsed.script);
    } catch (e) {
      await log.append("events", {
        run_id: metadata.run_id,
        event: "evaluation_abort",
        problem_id: problem.id,
        submission_id: target.id,
        attempt,
        generator_script: parsed.script,
        tokens_in: response.tokensIn,
        tokens_out: response.tokensOut,
        cost_usd: response.costUsd,
      });
      throw e;
    }
    if (parsed.error) evaluation.detail = parsed.error;
    await onEvent("verdict", {
      attempt,
      verdict: evaluation.verdict,
      detail: evaluation.detail,
    });
    const record = {
      ...protocolBinding(),
      corpus_id: metadata.corpus_id,
      config_id: metadata.config_id,
      oracle_kind: assessOracle(problem).kind,
      execution_kind: evaluator.sandbox?.kind ?? "unverified",
      provider_kind: scripts ? "none" : (llm?.kind ?? "unverified"),
      run_id: metadata.run_id,
      git_commit: metadata.git_commit,
      problem_id: problem.id,
      submission_id: target.id,
      target_language: target.language ?? "python",
      sub_hash: sha256(target.code),
      passed_test_count: target.passedTestCount,
      attempt,
      model: scripts ? "manual-random" : metadata.model,
      reasoning_effort: scripts ? "none" : metadata.reasoning_effort,
      generator_script: parsed.script,
      verdict: evaluation.verdict,
      detail: evaluation.detail,
      input_size: evaluation.data.length,
      semantic_size: evaluation.semanticSize ?? null,
      input_sha: sha256(evaluation.data),
      seed: scripts ? LIMITS.seed + attempt - 1 : LIMITS.seed,
      tokens_in: response.tokensIn,
      tokens_out: response.tokensOut,
      cached_tokens: response.cachedTokens ?? 0,
      cost_usd: response.costUsd,
      latency_ms: response.latencyMs,
      sandbox_executions: (evaluator.executions ?? 0) - executionStart,
      model_calls: scripts ? 0 : 1,
      wall_ms: Date.now() - attemptStarted,
      provider_model: response.providerModel ?? null,
      finish_reason: response.finishReason ?? null,
      method,
      division: problem.division,
      origin: target.origin ?? "unknown",
      contamination_group: problem.contaminationGroup ?? "unverified",
    };
    await log.append("attempts", record);
    attemptRecords.push(record);
    await onEvaluation(evaluation, record);
    await onEvent("attempt_finished", {
      attempt,
      verdict: record.verdict,
      elapsed_ms: Date.now() - attemptStarted,
    });
    if (evaluation.verdict === V.KILL) {
      killerScript = parsed.script;
      break;
    }
    history.push(feedbackFor(evaluation, attempt));
  }
  const killed = killerScript !== null,
    first = attemptRecords[0],
    last = attemptRecords.at(-1);
  const final = {
    ...protocolBinding(),
    corpus_id: metadata.corpus_id,
    config_id: metadata.config_id,
    run_id: metadata.run_id,
    problem_id: problem.id,
    submission_id: target.id,
    killed,
    kill_at_1: killed && last.attempt === 1,
    attempts_used: attemptRecords.length,
    killer_script_sha: killed ? sha256(killerScript) : null,
    min_input_size: killed ? last.input_size : null,
    semantic_size: killed ? last.semantic_size : null,
    total_cost_usd: attemptRecords.reduce((a, r) => a + r.cost_usd, 0),
    inconclusive:
      !killed && attemptRecords.some((r) => r.verdict === V.INCONCLUSIVE),
    method,
    division: problem.division,
    passed_test_count: first.passed_test_count,
    contamination_group: first.contamination_group,
    origin: first.origin,
    bug_type: null,
  };
  await log.append("finals", final);
  return { ...final, killer_script: killerScript };
}
