import { digest } from "../src/protocol.js";
import { Verdict } from "../src/domain.js";

const jobKeys =
  "id title mode language model status createdAt attempts events currentAttempt knownWrong elapsed_ms final error diagnostics".split(
    " ",
  );
const finalKeys =
  "protocol_version protocol_id evidence_schema corpus_id config_id run_id problem_id submission_id killed kill_at_1 attempts_used killer_script_sha min_input_size semantic_size total_cost_usd inconclusive method division passed_test_count contamination_group origin bug_type killer_script".split(
    " ",
  );
const attemptKeys =
  "protocol_version protocol_id evidence_schema corpus_id config_id oracle_kind execution_kind provider_kind run_id git_commit problem_id submission_id target_language sub_hash passed_test_count attempt model reasoning_effort generator_script verdict detail input_size semantic_size input_sha seed tokens_in tokens_out cached_tokens cost_usd latency_ms provider_model finish_reason method division origin contamination_group input expected actual input_truncated outputs_truncated sandbox_executions model_calls wall_ms".split(
    " ",
  );
const eventKeys =
  "id type at attempt mode generator_script verdict detail elapsed_ms ok bytes crashed timedOut mle error diagnostics".split(
    " ",
  );
const select = (value, keys) =>
  Object.fromEntries(
    keys
      .filter(
        (k) =>
          value?.[k] !== undefined &&
          (value[k] === null ||
            ["string", "number", "boolean"].includes(typeof value[k])),
      )
      .map((k) => [k, value[k]]),
  );
export function encodeHistory(job) {
  const record = { schema: 3, job };
  return { ...record, sha: digest(record) };
}
export function decodeHistory(record, directory) {
  const job = record.schema === 3 ? record.job : record;
  if (record.schema === 3 && record.sha !== digest({ schema: 3, job }))
    throw Error("History checksum mismatch");
  if (
    !job ||
    job.id !== directory ||
    !/^lab-[a-f0-9-]{12}$/.test(job.id) ||
    !["demo", "playground", "benchmark"].includes(job.mode) ||
    !Array.isArray(job.attempts) ||
    job.attempts.length > 3 ||
    !Array.isArray(job.events) ||
    job.events.length > 250 ||
    typeof job.createdAt !== "string" ||
    typeof job.title !== "string"
  )
    throw Error("Invalid persisted history");
  const clean = select(job, jobKeys);
  clean.final = job.final ? select(job.final, finalKeys) : null;
  clean.attempts = job.attempts.map((a) => select(a, attemptKeys));
  clean.events = job.events.map((e) => ({
    ...select(e, eventKeys),
    ...(e.result ? { result: select(e.result, attemptKeys) } : {}),
    ...(e.final ? { final: select(e.final, finalKeys) } : {}),
  }));
  // Unknown local artifact properties (including credentials) never reach browsers.
  if (
    clean.attempts.some(
      (a) =>
        typeof a.cost_usd !== "number" ||
        !Number.isFinite(a.cost_usd) ||
        a.cost_usd < 0,
    )
  )
    throw Error("Invalid history cost");
  if (
    clean.attempts.some(
      (a) =>
        !Object.values(Verdict).includes(a.verdict) ||
        typeof a.detail !== "string" ||
        !["input", "expected", "actual"].every(
          (k) => typeof a[k] === "string",
        ) ||
        !["tokens_in", "tokens_out", "latency_ms", "input_size"].every(
          (k) => Number.isFinite(a[k]) && a[k] >= 0,
        ),
    )
  )
    throw Error("Malformed history attempt");
  if (clean.final && typeof clean.final.killed !== "boolean")
    throw Error("Malformed history final");
  return clean;
}
