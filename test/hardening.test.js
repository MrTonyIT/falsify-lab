import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smokeProblem } from "../fixtures/sum-problem.js";
import { assessOracle, oracleBinding } from "../src/oracle.js";
import {
  tokenChecker,
  yesNoChecker,
  lineChecker,
  checkerFor,
} from "../src/checkers.js";
import { sha256, LIMITS, validateProblem } from "../src/domain.js";
import { corpusIdentity, loadCorpus, within } from "../src/corpus.js";
import { protocolBinding, digest } from "../src/protocol.js";
import { Evaluator } from "../src/evaluator.js";
import { MockSandbox } from "../src/sandbox.js";
import { Budget, HttpLLM, MockLLM, configIdentity } from "../src/llm.js";
import { freezeSuite, verifySuite } from "../src/track2.js";
import { problemBootstrap, pairedProblemBootstrap } from "../src/metrics.js";
import { metadataFor, initializeRun } from "../src/workflow.js";
import {
  sealEvidence,
  inspectEvidence,
  validatePairs,
} from "../src/evidence.js";
import { JsonlLog } from "../src/logging.js";
import { runPair } from "../src/falsify.js";
import {
  freezePartitions,
  verifyPartitions,
  shrinkCounterexample,
} from "../src/experiments.js";
import { LabService, examples } from "../server/service.js";
import { encodeHistory, decodeHistory } from "../server/history.js";

const temp = () => mkdtemp(join(tmpdir(), "falsify-v3-"));
function reviewed() {
  const p = smokeProblem();
  delete p.oracleKind;
  p.references = p.references.map((r, i) => ({
    ...r,
    sourceHash: sha256(r.code),
    provenance: "synthetic unit test",
    algorithmFamily: "test-" + i,
    independenceRationale: "TEST DOUBLE, not human evidence",
    review: { status: "reviewed", reviewer: "test", reviewedAt: "2026-01-01" },
    sampleVerification: {
      status: "passed",
      sourceHash: sha256(r.code),
      samplesHash: digest(p.samples),
    },
  }));
  p.oracleReview = {
    status: "reviewed",
    reviewer: "test",
    reviewedAt: "2026-01-01",
    independenceRationale: "test only",
    binding: oracleBinding(p),
  };
  return p;
}
test("checker profiles reject unsupported semantics, invalid UTF-8, controls and excess output", () => {
  assert(!tokenChecker("YES", "yes"));
  assert(tokenChecker("1 2", "1\v2"));
  assert(!tokenChecker("1", Buffer.from([0xef, 0xbb, 0xbf, 0x31])));
  assert(yesNoChecker("YES No", "yes NO"));
  assert(!yesNoChecker("ABC", "abc"));
  assert(!tokenChecker("1", "1\0"));
  assert(!tokenChecker(Buffer.from([0xff]), Buffer.from([0xff])));
  assert(!lineChecker("a\nb", "a b"));
  assert(!tokenChecker("a b", "a\u00a0b"));
  assert(!tokenChecker("x", Buffer.alloc(LIMITS.outputBytes + 1, 120)));
  for (const profile of [undefined, "float", "special", "interactive"])
    assert.throws(() => checkerFor(profile));
});
test("oracle attestation is bound to actual source, samples, checker and validator", () => {
  for (const mutate of [
    (p) => (p.references[0].code += "\n# changed"),
    (p) => (p.samples[0].output = "999"),
    (p) => (p.checkerName = "lines"),
    (p) => (p.validator = () => ({ ok: true })),
    (p) => delete p.references[0].review,
  ]) {
    const p = reviewed();
    assert(assessOracle(p).trusted);
    mutate(p);
    assert(!assessOracle(p).trusted);
  }
});
test("unverified oracle never executes references or produces a kill", async () => {
  const p = smokeProblem();
  delete p.oracleKind;
  const sandbox = new MockSandbox(() => ({ stdout: Buffer.from("1") }));
  const result = await new Evaluator(sandbox).evaluate(
    p,
    p.dev[0],
    "generator",
  );
  assert.equal(result.verdict, "unusable");
  assert.equal(result.detail, "unverified_oracle");
  assert.equal(sandbox.calls.length, 1);
});
test("bounded exact oracle detects unanimous wrong references", async () => {
  const p = smokeProblem();
  p.exactOracle = () => ({ applicable: true, output: Buffer.from("3") });
  const e = new Evaluator(
    new MockSandbox(() => ({ stdout: Buffer.from("2") })),
  );
  assert.equal(
    (await e.prepare(p, Buffer.from(p.samples[0].input))).detail,
    "exact_oracle_disagreement",
  );
});
test("corpus hash binds metadata, public samples, private held-out code and checker", () => {
  for (const mutate of [
    (p) => (p.samples[0].output = "9"),
    (p) => (p.heldOut[0].code += "\n# edit"),
    (p) => (p.checkerName = "lines"),
    (p) => (p.constraints += " edit"),
    (p) => p.dev[0].passedTestCount++,
  ]) {
    const p = smokeProblem(),
      old = corpusIdentity([p]);
    mutate(p);
    assert.notEqual(corpusIdentity([p]), old);
  }
});
test("frozen suite invalidates changed held-out source and incompatible protocol", () => {
  const p = smokeProblem(),
    s = freezeSuite(
      p,
      [],
      {
        problem_id: p.id,
        split: "dev",
        submission_ids: p.dev.map((s) => s.id),
        rows: [],
      },
      "corpus",
    );
  verifySuite(s, p, "corpus");
  p.heldOut[0].code += "\n# change";
  assert.throws(() => verifySuite(s, p, "corpus"), /changed/);
  assert.throws(
    () => verifySuite({ ...s, protocol_version: "old" }, p, "corpus"),
    /protocol/,
  );
});
test("single problem has no cluster confidence interval", () =>
  assert.equal(
    problemBootstrap([{ problem_id: "one", killed: true }]).ci95,
    null,
  ));
test("paired bootstrap preserves matching and rejects missing or duplicate pairs", () => {
  const left = ["a", "b"].flatMap((problem_id) =>
      [1, 2].map((submission_id) => ({
        problem_id,
        submission_id,
        killed: true,
        attempts_used: 2,
      })),
    ),
    right = left.map((r) => ({ ...r, killed: false }));
  const result = pairedProblemBootstrap(left, right, { repetitions: 100 });
  assert.equal(result.delta_pp, 100);
  assert.deepEqual(result.ci95, [100, 100]);
  assert.throws(
    () => pairedProblemBootstrap(left, right.slice(1)),
    /same assigned/,
  );
  test("relabeling a held-out source or copying an oracle source cannot bypass partition gates", async () => {
    const p = smokeProblem();
    await assert.rejects(
      () =>
        runPair({
          problem: p,
          target: { ...p.heldOut[0], split: "dev" },
          metadata: { kind: "pilot" },
        }),
      /relabeled/,
    );
    await assert.rejects(
      () =>
        runPair({
          problem: p,
          target: { ...p.heldOut[0], id: "renamed", split: "dev" },
          metadata: { kind: "pilot" },
        }),
      /relabeled/,
    );
    p.dev[0].code = p.references[0].code;
    assert.throws(() => validateProblem(p), /source overlap/);
  });
  assert.throws(
    () => pairedProblemBootstrap([...left, left[0]], right),
    /Duplicate/,
  );
});
test("persistent reservations survive restart and block uncertain billing", async () => {
  const path = join(await temp(), "budget.json");
  const b = new Budget(1, { path, identity: "test" });
  const id = b.reserve(0.6);
  const restored = new Budget(1, { path, identity: "test" });
  assert.equal(restored.reserved, 0.6);
  assert.throws(() => restored.reserve(0.1), /Unsettled/);
  restored.charge(0.4, id);
  const next = new Budget(1, { path, identity: "test" });
  assert.equal(next.spent, 0.4);
  assert.throws(() => next.reserve(0.7), /Cost guard/);
});
test("provider transport failure cannot reset the reservation or retry silently", async () => {
  const c = {
    model: "snapshot",
    reasoningEffort: "high",
    maxCompletionTokens: 16000,
    maxInputTokens: 100,
    responseCache: false,
    costLimitUsd: 1,
    endpoint: "https://unit.invalid",
    pricing: { input: 1, cachedInput: 1, output: 1 },
  };
  const b = new Budget(1);
  let calls = 0;
  const llm = new HttpLLM(c, {
    budget: b,
    apiKey: "test",
    fetchImpl: async () => {
      calls++;
      throw Error("transport");
    },
  });
  await assert.rejects(() => llm.call("p"), /transport/);
  await assert.rejects(() => llm.call("p"), /Unsettled/);
  assert.equal(calls, 1);
  assert.notEqual(
    configIdentity(c),
    configIdentity({ ...c, maxInputTokens: 101 }),
  );
});
test("provider drift stops before generated code execution while preserving usage", async () => {
  const p = smokeProblem(),
    events = [];
  let executed = false;
  await assert.rejects(
    () =>
      runPair({
        problem: p,
        target: p.dev[0],
        metadata: { snapshot_pinned: true, model: "expected" },
        llm: {
          call: async () => ({
            providerModel: "other",
            costUsd: 0.1,
            tokensIn: 1,
            tokensOut: 2,
          }),
        },
        log: { append: async (k, v) => events.push(v) },
        evaluator: {
          evaluate: async () => {
            executed = true;
          },
        },
      }),
    /snapshot changed/,
  );
  assert(!executed);
  assert.equal(events[0].cost_usd, 0.1);
});
test("legacy official event labels never establish official evidence", async () => {
  const directory = await temp();
  await writeFile(
    join(directory, "run.json"),
    JSON.stringify({ kind: "official" }),
  );
  await writeFile(
    join(directory, "events.jsonl"),
    JSON.stringify({ event: "run_complete" }) + "\n",
  );
  const result = await inspectEvidence(directory);
  assert.equal(result.status, "LEGACY");
  assert(!result.official);
});
test("seals detect tampering and mocks remain nonofficial", async () => {
  const directory = await temp(),
    p = smokeProblem(),
    metadata = metadataFor([p], { model: "mock" }, "pilot"),
    log = await initializeRun(directory, metadata);
  await runPair({
    problem: p,
    target: p.dev[0],
    metadata,
    log,
    llm: new MockLLM(["```python\nprint(1)\n```"]),
    evaluator: {
      evaluate: async () => ({
        verdict: "kill",
        detail: "unit test",
        data: Buffer.from("1"),
      }),
    },
  });
  await log.append("events", {
    run_id: metadata.run_id,
    event: "run_complete",
  });
  await sealEvidence(directory);
  const before = await inspectEvidence(directory);
  assert.equal(before.status, "VERIFIED");
  assert(!before.official);
  await writeFile(join(directory, "finals.jsonl"), "{}\n");
  assert.equal((await inspectEvidence(directory)).status, "INCOMPLETE");
});
test("run initialization rejects prepopulated evidence without overwriting it", async () => {
  const directory = await temp();
  await writeFile(join(directory, "attempts.jsonl"), "original");
  await assert.rejects(() => new JsonlLog(directory).initialize({}), /EEXIST/);
  assert.equal(
    await readFile(join(directory, "attempts.jsonl"), "utf8"),
    "original",
  );
});
test("concurrent HTTP service starts reserve one slot before any await", async () => {
  const service = new LabService({ root: await temp(), demoDelay: 1 });
  await service.init();
  service.execute = async () => {};
  const results = await Promise.allSettled([
    service.start({ mode: "demo", ...examples[0] }),
    service.start({ mode: "demo", ...examples[0] }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "RUN_ACTIVE",
  );
});
test("malformed payloads and pasted unreviewed oracles fail before paid calls", async () => {
  const service = new LabService({ root: await temp() });
  await service.init();
  for (const value of [null, [], 1, "text"])
    await assert.rejects(
      () => service.start(value),
      (e) => e.status === 400,
    );
  await assert.rejects(
    () =>
      service.start({
        mode: "playground",
        statement: "s",
        constraints: "c",
        code: "print(1)",
        validator: "import os",
        references: ["a", "b", "c"],
        allowPaid: true,
      }),
    (e) => e.code === "ORACLE_UNVERIFIED",
  );
});

test("compilation resource failure is separate from a syntax error and spends no model call", async () => {
  const service = new LabService({ root: await temp() });
  await service.init();
  service.config = {
    model: "test-unused",
    reasoningEffort: "high",
    maxCompletionTokens: 16000,
    pricing: { input: 0, output: 0, cachedInput: 0 },
  };
  service.status = async () => ({
    provider: { status: "configured" },
    sandbox: { status: "available" },
    languages: [{ id: "cpp", status: "available" }],
  });
  service.multilang = {
    run: async () => ({ timedOut: true, stdout: Buffer.alloc(0) }),
  };
  const created = await service.start({
    ...examples[0],
    mode: "playground",
    oracle: "example",
    language: "cpp",
    allowPaid: true,
  });
  for (let i = 0; i < 100 && service.active; i++)
    await new Promise((r) => setTimeout(r, 10));
  const job = service.get(created.id);
  assert.equal(job.status, "error");
  assert.match(job.error, /resource limits/);
  assert(!job.events.some((e) => e.type === "llm_started"));
  assert.equal(job.attempts.length, 0);
});
test("history checksums reject accidental mutation and projection strips private keys", () => {
  const job = {
    id: "lab-12345678-abc",
    title: "fixture",
    mode: "demo",
    createdAt: "2026-01-01",
    events: [],
    attempts: [],
    apiKey: "SECRET",
  };
  const encoded = encodeHistory(job);
  assert(!JSON.stringify(decodeHistory(encoded, job.id)).includes("SECRET"));
  encoded.job.title = "tamper";
  assert.throws(() => decodeHistory(encoded, job.id), /checksum/);
  assert.throws(() => decodeHistory(job, "lab-other"), /Invalid/);
});
test("unseen-problem schema rejects overlap and invalidates later mutations", () => {
  const p = smokeProblem(),
    u = smokeProblem();
  assert.throws(
    () =>
      freezePartitions([p], [u], { reviewer: "test", rationale: "fixture" }),
    /overlap/,
  );
  u.id = "unseen";
  u.statement = "Different synthetic problem";
  const f = freezePartitions([p], [u], {
    reviewer: "test",
    rationale: "unit test only",
  });
  verifyPartitions(f, [p], [u]);
  u.constraints += " change";
  assert.throws(() => verifyPartitions(f, [p], [u]));
});
test("optional shrink preserves original and rejects invalid or non-killing proposals", async () => {
  const p = smokeProblem(),
    input = Buffer.from("1234");
  const evaluator = {
    prepare: async (p, data) =>
      data.toString() === "0"
        ? { verdict: "invalid", data }
        : { data, semanticSize: data.length },
    judge: async (p, t, r) =>
      r.verdict
        ? r
        : {
            ...r,
            verdict: r.data.toString() === "2" ? "survived" : "kill",
            detail: "wrong_answer",
          },
  };
  const result = await shrinkCounterexample({
    problem: p,
    target: p.dev[0],
    input,
    evaluator,
    proposals: function* () {
      yield Buffer.from("0");
      yield Buffer.from("2");
      yield Buffer.from("12");
    },
    maxChecks: 3,
  });
  assert.equal(result.original.sha, sha256(input));
  assert.equal(result.minimized.bytes, 2);
  assert.equal(input.toString(), "1234");
  assert.equal(result.phase, "post-analysis");
});
test("unreviewed host plugins are rejected before top-level code can run", async () => {
  const root = await temp();
  await writeFile(join(root, "plugin.mjs"), "throw Error('EXECUTED');");
  await writeFile(
    join(root, "corpus.json"),
    JSON.stringify({
      problems: [
        { plugin: "plugin.mjs", references: [], dev: [], heldOut: [] },
      ],
    }),
  );
  await assert.rejects(
    () => loadCorpus(join(root, "corpus.json")),
    /explicit hash-bound/,
  );
  await assert.rejects(() => within(root, "../outside"), /ENOENT|escapes/);
});
test("one-shot and no-feedback ablations use explicit budgets and remain nonofficial", async () => {
  const p = smokeProblem();
  for (const [method, budget, feedback] of [
    ["ai-one-shot", 1, true],
    ["ai-no-feedback", 3, false],
  ]) {
    const llm = new MockLLM(Array(budget).fill("```python\nprint(1)\n```")),
      records = [];
    const result = await runPair({
      problem: p,
      target: p.dev[0],
      method,
      budget,
      feedback,
      llm,
      metadata: { kind: "ablation", model: "mock" },
      log: { append: async (k, v) => records.push(v) },
      evaluator: {
        evaluate: async () => ({
          verdict: "survived",
          detail: "fixture",
          data: Buffer.from("1"),
        }),
      },
    });
    assert.equal(result.attempts_used, budget);
    assert(llm.prompts.every((p) => p.endsWith("[]")));
  }
});
