import { writeFile, mkdir } from "node:fs/promises";
import { languageFor } from "../src/languages.js";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sha256, assert, LIMITS } from "../src/domain.js";
import { protocolBinding, digest, currentProtocol } from "../src/protocol.js";
import { oracleBinding, assessOracle } from "../src/oracle.js";
import { inspectEvidence } from "../src/evidence.js";
import { readJsonl } from "../src/logging.js";
import { Evaluator } from "../src/evaluator.js";
import { MockSandbox } from "../src/sandbox.js";
import { smokeProblem } from "../fixtures/sum-problem.js";
const fail = (status, code, message) => {
  throw Object.assign(new Error(message), { status, code });
};
const text = (b) => b.subarray(0, 65536).toString("utf8");

export async function preserveReplay(
  log,
  problem,
  target,
  evaluation,
  record,
  sandbox,
) {
  const input = evaluation.data ?? Buffer.alloc(0),
    expected = evaluation.expected ?? Buffer.alloc(0),
    actual = evaluation.got ?? Buffer.alloc(0);
  await log.append("replay", {
    ...protocolBinding(),
    run_id: record.run_id,
    attempt: record.attempt,
    problem_id: problem.id,
    oracle_binding: oracleBinding(problem),
    oracle_kind: record.oracle_kind,
    source_hash: sha256(target.code),
    language: languageFor(target.language ?? "python").id,
    input_b64: input.toString("base64"),
    expected_b64: expected.toString("base64"),
    actual_b64: actual.toString("base64"),
    input_sha: sha256(input),
    expected_sha: sha256(expected),
    actual_sha: sha256(actual),
    verdict: record.verdict,
    detail: record.detail,
    execution_kind: record.execution_kind,
    image_id: sandbox?.imageId ?? null,
    git_commit: record.git_commit,
  });
}
export async function evidenceFor(service, id, attempt) {
  const job = service.get(id);
  if (job.status !== "finished")
    fail(
      409,
      "EVIDENCE_NOT_COMPLETE",
      "Wait for a successfully completed run before exporting or replaying evidence.",
    );
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > LIMITS.attempts)
    fail(400, "INVALID_ATTEMPT", "Invalid attempt.");
  const directory = join(service.root, id),
    status = await inspectEvidence(directory);
  if (!["DEMO", "VERIFIED"].includes(status.status))
    fail(
      409,
      "EVIDENCE_UNVERIFIED",
      "Stored evidence is missing, legacy or changed. Start a new run.",
    );
  const rows = await readJsonl(join(directory, "replay.jsonl")),
    matches = rows.filter((r) => r.attempt === attempt),
    original = job.attempts.find((a) => a.attempt === attempt);
  if (matches.length !== 1 || !original)
    fail(
      404,
      "REPLAY_UNAVAILABLE",
      "This older run has no complete replay artifact. Start a new run.",
    );
  const row = matches[0];
  assert(
    currentProtocol(row) &&
      row.run_id === id &&
      row.source_hash === original.sub_hash &&
      row.input_sha === original.input_sha &&
      row.verdict === original.verdict,
    "Replay identity mismatch",
  );
  for (const [name, max] of [
    ["input", LIMITS.inputBytes],
    ["expected", LIMITS.outputBytes],
    ["actual", LIMITS.outputBytes],
  ]) {
    assert(typeof row[name + "_b64"] === "string", "Replay bytes missing");
    const bytes = Buffer.from(row[name + "_b64"], "base64");
    assert(
      bytes.length <= max && sha256(bytes) === row[name + "_sha"],
      "Replay bytes changed",
    );
  }
  return row;
}
export async function exportEvidence(service, id, attempt) {
  const row = await evidenceFor(service, id, attempt);
  return {
    ...row,
    artifact_type: "learner-counterexample",
    official: false,
    source_included: false,
    raw_provider_response_included: false,
    notice:
      "Private input/output export. Review before sharing. Matching one test does not prove correctness.",
    reproduction:
      row.language === "python"
        ? "Decode input_b64 to input.txt. In your own isolated Python environment: python solution.py < input.txt. Compare using the problem checker, not arbitrary text formatting."
        : "Decode input_b64 to input.txt. Compile/run your source with the recorded language and runtime in an isolated environment, passing input.txt as stdin. Compare using the problem checker. Revision replay in this UI supports Python only.",
  };
}
export async function replayRevision(service, id, attempt, payload, examples) {
  if (
    !payload ||
    typeof payload.code !== "string" ||
    !payload.code.trim() ||
    payload.code.length > 100000
  )
    fail(
      400,
      "INVALID_SOURCE",
      "Paste a single-file Python revision (up to 100,000 characters).",
    );
  if (service.active || service.starting)
    fail(409, "RUN_ACTIVE", "Wait for the active execution to finish.");
  service.starting = true;
  try {
    const row = await evidenceFor(service, id, attempt),
      job = service.get(id);
    if (row.language !== "python")
      fail(
        422,
        "PYTHON_REPLAY_ONLY",
        "Revision replay currently supports Python only.",
      );
    if (!["kill", "survived"].includes(row.verdict))
      fail(
        422,
        "REPLAY_UNUSABLE",
        "Replay requires a valid input with a successful checked original execution.",
      );
    let problem = service.problems.find((p) => p.id === row.problem_id);
    if (
      !problem &&
      row.problem_id === "synthetic-sum" &&
      row.oracle_kind === "synthetic"
    )
      problem = smokeProblem();
    if (
      !problem ||
      !assessOracle(problem).trusted ||
      oracleBinding(problem) !== row.oracle_binding
    )
      fail(
        422,
        "ORACLE_CHANGED",
        "The original reviewed oracle is unavailable or has changed.",
      );
    let sandbox,
      imageId = null;
    if (job.mode === "demo") {
      if (!examples.some((e) => e.code === payload.code))
        fail(
          422,
          "DEMO_REVISION_ONLY",
          "Demo replay only simulates the two bundled sources. Arbitrary code requires a live Docker run.",
        );
      sandbox = new MockSandbox((code, input, options) => {
        const values = input
          .toString()
          .trim()
          .split("\n")[2]
          .trim()
          .split(/\s+/)
          .map(Number);
        const result = values.reduce(
          (sum, v) =>
            sum +
            (options.role === "target" && code === examples[0].code
              ? Math.abs(v)
              : v),
          0,
        );
        return { stdout: Buffer.from(result + "\n") };
      });
    } else {
      try {
        imageId = (await service.sandbox.check()).imageId;
      } catch {
        fail(
          503,
          "SANDBOX_UNAVAILABLE",
          "Live replay requires the Python Docker sandbox. No provider call will be made.",
        );
      }
      sandbox = service.sandbox;
    }
    service.active = id;
    if (job.mode !== "demo") {
      const syntax = await sandbox.run(
        "compile(bytes.fromhex('" +
          Buffer.from(payload.code, "utf8").toString("hex") +
          "').decode('utf-8'), '<submission>', 'exec')",
        Buffer.alloc(0),
        { role: "syntax-check", seconds: LIMITS.syntaxSeconds },
      );
      if (syntax.timedOut || syntax.mle || syntax.overflow)
        fail(
          422,
          "REPLAY_RESOURCE_LIMIT",
          "Syntax check exceeded sandbox limits. No model call was made.",
        );
      if (syntax.crashed || syntax.compileFailed)
        fail(
          422,
          "COMPILE_FAILED",
          "Python syntax check failed. Fix the source before replaying. No model call was made.",
        );
    }
    const evaluator = new Evaluator(sandbox),
      input = Buffer.from(row.input_b64, "base64");
    const prepared = await evaluator.prepare(problem, input);
    if (prepared.verdict || sha256(prepared.expected) !== row.expected_sha)
      fail(
        422,
        "ORACLE_RECHECK_FAILED",
        "The oracle could not reproduce the saved expected output.",
      );
    const evaluation = await evaluator.judge(
        problem,
        { code: payload.code, language: "python" },
        prepared,
      ),
      actual = evaluation.got ?? Buffer.alloc(0);
    const record = {
      ...protocolBinding(),
      kind: "revision-check",
      official: false,
      original_run: id,
      original_attempt: attempt,
      original_source_hash: row.source_hash,
      revision_source_hash: sha256(payload.code),
      input_sha: row.input_sha,
      oracle_binding: row.oracle_binding,
      execution_kind: sandbox.kind,
      image_id: imageId,
      verdict: evaluation.verdict,
      detail: evaluation.detail,
      expected_sha: row.expected_sha,
      actual_sha: sha256(actual),
      actual_b64: actual.toString("base64"),
      created_at: new Date().toISOString(),
      model_calls: 0,
      provider_cost_usd: 0,
      scope: "One saved input only; not proof of correctness.",
    };
    const directory = join(service.root, "revision-checks");
    await mkdir(directory, { recursive: true });
    const revisionId = randomUUID();
    await writeFile(
      join(directory, revisionId + ".json"),
      JSON.stringify({ ...record, sha: digest(record) }),
      { flag: "wx", mode: 0o600 },
    );
    return {
      ...record,
      actual_b64: undefined,
      actual: text(actual),
      outputs_truncated: actual.length > 65536,
      revision_id: revisionId,
    };
  } finally {
    service.active = null;
    service.starting = false;
  }
}
