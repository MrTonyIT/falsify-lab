import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLabServer } from "../server/index.js";
import { LabService, examples } from "../server/service.js";
import {
  learnerCandidates,
  validateCandidate,
} from "../fixtures/learner-candidates.js";
import { assessOracle } from "../src/oracle.js";
import { JsonlLog, readJsonl } from "../src/logging.js";
import { preserveResponse } from "../src/responses.js";
import { sealEvidence, inspectEvidence } from "../src/evidence.js";
import { LIMITS, sha256 } from "../src/domain.js";
import { protocolBinding } from "../src/protocol.js";
import { freezeAnalysisPlan } from "../src/analysis-plan.js";
import { planFixture } from "./review-fixtures.js";
import { report } from "../src/report.js";
import { smoke } from "../src/smoke.js";
import { MockSandbox } from "../src/sandbox.js";

test("candidate catalog stays pending; validators reject malformed data and controls match authored cases", () => {
  assert.equal(learnerCandidates.length, 5);
  for (const p of learnerCandidates) {
    assert.equal(p.live_eligible, false);
    assert.equal(p.review_status, "pending");
    assert(!assessOracle(p).trusted);
    assert.equal(new Set(p.referenceDrafts.map((r) => r.author)).size, 1);
    for (const c of p.validatorCases)
      assert.equal(
        validateCandidate(Buffer.from(c.input)).ok,
        c.valid,
        p.id + " " + c.input,
      );
    for (const c of [...p.samples, p.counterexample]) {
      const valid = validateCandidate(Buffer.from(c.input));
      assert(valid.ok);
      assert.equal(p.solve(valid.values) + "\n", c.output);
    }
  }
});
test("frozen analysis plans reject misleading exclusions and unsupported analyses", () => {
  const binding = {
      git_commit: "a".repeat(40),
      corpus_id: "corpus",
      config_id: "config",
    },
    { sha, frozen_at, ...plan } = planFixture(binding);
  for (const change of [
    { exclusions: "Drop unsuccessful pairs" },
    { planned_comparisons: ["invented"] },
    { secondary_endpoints: ["invented"] },
  ])
    assert.throws(() => freezeAnalysisPlan({ ...plan, ...change }, binding));
});
test("raw responses exceeding 128 MiB in aggregate are privately sealed as bounded blobs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mvp-response-"));
  try {
    const log = new JsonlLog(dir),
      metadata = {
        ...protocolBinding(),
        run_id: "r",
        kind: "pilot",
        limits: LIMITS,
      };
    await log.initialize(metadata);
    await log.append("events", { event: "run_started", run_id: "r" });
    for (let i = 0; i < 17; i++)
      await preserveResponse(
        log,
        {
          rawResponse: String.fromCharCode(65 + i).repeat(
            LIMITS.providerResponseBytes,
          ),
          text: "test",
          tokensIn: 1,
          tokensOut: 1,
          costUsd: 0,
        },
        metadata,
        { attempt: i + 1 },
      );
    assert((await stat(join(dir, "responses.jsonl"))).size < 32768);
    await log.append("events", { event: "run_complete", run_id: "r" });
    await sealEvidence(dir);
    assert.equal((await inspectEvidence(dir)).status, "VERIFIED");
    const records = await readJsonl(join(dir, "responses.jsonl"));
    assert.equal(records.length, 17);
    assert(
      records.every((r) => r.raw_response === null && r.raw_response_file),
    );
    await writeFile(join(dir, records[0].raw_response_file), "tampered");
    assert.equal((await inspectEvidence(dir)).status, "INCOMPLETE");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("primary report table displays full denominator and labels eligible rates as sensitivity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mvp-report-"));
  try {
    await smoke(dir);
    await report(dir);
    const html = await readFile(join(dir, "report.html"), "utf8");
    assert(html.includes("Primary all-pair Kill@3"));
    assert(html.includes("Un-killed inconclusive pairs"));
    assert(html.includes("sensitivity analyses only"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("learner evidence and revision replay preserve the original run, reject arbitrary demo code and survive restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "mvp-api-")),
    service = new LabService({ root, demoDelay: 0 }),
    { server } = await createLabServer({ service });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, value) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  try {
    const candidates = await (await fetch(base + "/api/candidates")).json();
    assert(
      candidates.length === 5 && candidates.every((c) => !c.live_eligible),
    );
    assert(!JSON.stringify(candidates).includes("referenceDrafts"));
    const pending = await post("/api/falsify", {
      mode: "playground",
      problemId: candidates[0].id,
      statement: candidates[0].statement,
      constraints: candidates[0].constraints,
      language: "python",
      code: "print(1)",
      allowPaid: true,
    });
    assert.equal(pending.status, 422);
    const created = await (
      await post("/api/falsify", {
        ...examples[0],
        mode: "demo",
        language: "python",
      })
    ).json();
    for (let i = 0; i < 300 && service.active; i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(service.get(created.id).status, "finished");
    const path = `/api/runs/${created.id}/attempts/2`,
      before = await readFile(join(root, created.id, "seal.json"), "utf8");
    const response = await fetch(base + path + "/evidence");
    assert.equal(response.status, 200);
    const evidence = await response.json();
    assert.equal(
      sha256(Buffer.from(evidence.input_b64, "base64")),
      evidence.input_sha,
    );
    assert.equal(evidence.source_included, false);
    assert(!JSON.stringify(evidence).includes("generator_script"));
    assert.equal(
      (await post(path + "/replay", { code: 'import os;os.system("whoami")' }))
        .status,
      422,
    );
    const fixed = await (
      await post(path + "/replay", { code: examples[1].code })
    ).json();
    assert.equal(fixed.verdict, "survived");
    assert.equal(fixed.model_calls, 0);
    assert.equal(fixed.execution_kind, "mock");
    const stillWrong = await (
      await post(path + "/replay", { code: examples[0].code })
    ).json();
    assert.equal(stillWrong.verdict, "kill");
    assert.equal(
      await readFile(join(root, created.id, "seal.json"), "utf8"),
      before,
    );
    const restored = new LabService({ root });
    await restored.init();
    assert.equal(restored.get(created.id).sourceHash, sha256(examples[0].code));
    const { exportEvidence } = await import("../server/replay.js");
    assert.equal(
      (await exportEvidence(restored, created.id, 2)).input_sha,
      evidence.input_sha,
    );
    // Exercise the live replay path with an explicit test double and no provider configured.
    service.get(created.id).mode = "playground";
    let syntaxFails = false,
      resourceFails = false;
    const sandbox = new MockSandbox((code, input, options) =>
      options.role === "syntax-check"
        ? { crashed: syntaxFails, timedOut: resourceFails }
        : { stdout: Buffer.from("-1\n") },
    );
    sandbox.check = async () => ({ imageId: null });
    service.sandbox = sandbox;
    const replayed = await (
      await post(path + "/replay", { code: examples[1].code })
    ).json();
    assert.equal(replayed.verdict, "survived");
    assert.equal(replayed.execution_kind, "mock");
    assert.equal(replayed.model_calls, 0);
    syntaxFails = true;
    const syntax = await post(path + "/replay", { code: "bad python" });
    assert.equal(syntax.status, 422);
    assert.equal((await syntax.json()).error.code, "COMPILE_FAILED");
    syntaxFails = false;
    resourceFails = true;
    const resource = await post(path + "/replay", { code: "print(1)" });
    assert.equal(resource.status, 422);
    assert.equal((await resource.json()).error.code, "REPLAY_RESOURCE_LIMIT");
    assert.equal(service.active, null);
    assert.equal(service.starting, false);
    await writeFile(join(root, created.id, "replay.jsonl"), "{}\n");
    assert.equal((await fetch(base + path + "/evidence")).status, 409);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await rm(root, { recursive: true, force: true });
  }
});
