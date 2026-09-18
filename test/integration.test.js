import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { smoke } from "../src/smoke.js";
import { report } from "../src/report.js";
import { HttpLLM, Budget } from "../src/llm.js";
import { officialPreflight } from "../src/preflight.js";
import { readJsonl } from "../src/logging.js";
import { generateBlackbox } from "../src/track2.js";
import { MockLLM } from "../src/llm.js";
import { smokeProblem } from "../fixtures/sum-problem.js";
test("mock end-to-end baseline, feedback loop, selected suite, held-out and report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "falsifier-smoke-"));
  const result = await smoke(dir);
  assert.equal(result.official_status, "NOT RUN");
  assert.equal(result.run_complete, true);
  assert.equal(Object.keys(result.groups).length, 3);
  const events = await readJsonl(join(dir, "track2.jsonl"));
  assert.equal(events[0].event, "suite_frozen");
  assert.equal(events[1].event, "held_out_evaluated");
  assert(events[1].results[0].killed);
  assert(
    (await readFile(join(dir, "report.html"), "utf8")).includes("NOT RUN"),
  );
  await assert.rejects(() => smoke(dir), /EEXIST/);
});
test("empty report does not fabricate measurements", async () => {
  const dir = await mkdtemp(join(tmpdir(), "falsifier-report-"));
  const r = await report(dir);
  assert.equal(r.official_status, "NOT RUN");
  assert.deepEqual(r.groups, {});
});
test("live adapter forwards fixed parameters, accounts tokens, makes no response reuse", async () => {
  const requests = [];
  const c = {
    model: "snapshot",
    reasoningEffort: "high",
    maxCompletionTokens: 16000,
    maxInputTokens: 1000,
    responseCache: false,
    costLimitUsd: 1,
    pricing: { input: 1, cachedInput: 0.1, output: 1 },
    endpoint: "https://provider.example/complete",
  };
  const llm = new HttpLLM(c, {
    budget: new Budget(1),
    apiKey: "test",
    fetchImpl: async (url, r) => {
      requests.push(JSON.parse(r.body));
      return {
        ok: true,
        json: async () => ({
          model: "snapshot",
          choices: [{ message: { content: "```python\nprint(1)\n```" } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      };
    },
  });
  await llm.call("prompt");
  await llm.call("prompt");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].max_completion_tokens, 16000);
  assert.equal(requests[0].reasoning_effort, "high");
  assert(!("temperature" in requests[0]));
});
test("official gate rejects absent evidence and mock isolation", () => {
  const r = officialPreflight({
    config: {},
    problems: [],
    evidence: {},
    baseline: {},
    sandbox: { kind: "mock" },
    gitCommit: "UNCOMMITTED",
  });
  assert.equal(r.ok, false);
  assert(r.failures.some((s) => s.startsWith("sandbox")));
  assert(r.failures.some((s) => s.startsWith("compatibility")));
});
test("black-box generation sees neither target nor reference source and consumes K calls", async () => {
  const p = smokeProblem();
  p.dev[0].code = "SECRET_TARGET";
  p.references[0].code = "SECRET_REFERENCE";
  const llm = new MockLLM(["```python\nprint(1)\n```", ""]),
    records = [];
  const evaluator = {
    generate: async (s) =>
      s ? { data: Buffer.from("1") } : { error: "missing" },
    prepare: async () => ({}),
  };
  await generateBlackbox({
    problem: p,
    k: 2,
    llm,
    evaluator,
    log: {
      append: async (k, v) => {
        if (k === "blackbox") records.push(v);
      },
    },
    metadata: { run_id: "b" },
  });
  assert.equal(llm.prompts.length, 2);
  assert.equal(records.length, 2);
  assert(llm.prompts.every((p) => !p.includes("SECRET")));
  assert.equal(records[1].verdict, "gen_failed");
});
