import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLabServer } from "../server/index.js";
import { LabService, examples } from "../server/service.js";
import { readJsonl } from "../src/logging.js";
import { build_falsify_prompt } from "../src/prompt.js";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test("HTTP + SSE call existing core and persist real attempt evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "falsify-web-"));
  const service = new LabService({ root, demoDelay: 1 });
  const { server } = await createLabServer({ service });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(
      (await (await fetch(base + "/api/health")).json()).status,
      "online",
    );
    const started = await fetch(base + "/api/falsify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "demo", ...examples[0] }),
    });
    assert.equal(started.status, 202);
    const summary = await started.json();
    const ac = new AbortController();
    const response = await fetch(base + "/api/runs/" + summary.id + "/events", {
      signal: ac.signal,
    });
    const reader = response.body.getReader();
    let wire = "";
    while (!wire.includes("job_finished")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      wire += new TextDecoder().decode(chunk.value);
    }
    await reader.cancel();
    ac.abort();
    for (const event of [
      "job_started",
      "attempt_started",
      "llm_started",
      "generator_running",
      "validation_passed",
      "references_agreed",
      "target_started",
      "checker_started",
      "attempt_result",
      "job_finished",
    ])
      assert(wire.includes(event), event);
    for (let i = 0; i < 100 && service.active; i++) await delay(5);
    const job = await (await fetch(base + "/api/runs/" + summary.id)).json();
    assert.equal(job.final.killed, true);
    assert.equal(job.final.attempts_used, 2);
    assert.equal(job.attempts[1].input, "1\n1\n-1\n");
    assert.equal(job.attempts[1].expected, "-1\n");
    assert.equal(job.attempts[1].actual, "1\n");
    const attempts = await readJsonl(join(root, job.id, "attempts.jsonl"));
    assert.equal(attempts.length, 2);
    assert.equal(attempts[1].verdict, "kill");
    const history = await (await fetch(base + "/api/runs")).json();
    assert.equal(history.length, 1);
    const metrics = await (await fetch(base + "/api/metrics")).json();
    assert.equal(metrics.officialStatus, "NOT RUN");
    const restored = new LabService({ root });
    await restored.init();
    assert.equal(restored.get(job.id).final.killed, true);
    const visible = JSON.stringify(job);
    assert(!visible.includes("fixture-author"));
    assert(!visible.includes("reference source"));
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test("custom requests cannot silently run as demos or import untrusted validators on host", async () => {
  const root = await mkdtemp(join(tmpdir(), "falsify-web-"));
  const service = new LabService({ root });
  await service.init();
  await assert.rejects(
    () => service.start({ mode: "demo", ...examples[0], code: "print(999)" }),
    (e) => e.code === "DEMO_EXAMPLE_ONLY",
  );
  await assert.rejects(
    () =>
      service.start({
        mode: "playground",
        statement: "custom",
        constraints: "custom",
        code: "print(1)",
      }),
    (e) => e.code === "ORACLE_REQUIRED",
  );
  await assert.rejects(
    () =>
      service.start({
        mode: "benchmark",
        ...examples[0],
        problemId: "unknown",
        submissionId: "held-out",
      }),
    (e) => e.code === "DEV_TARGET_REQUIRED",
  );
  assert.equal(service.list().length, 0);
});

test("local API rejects cross-origin POST and malformed JSON", async () => {
  const root = await mkdtemp(join(tmpdir(), "falsify-web-"));
  const { server } = await createLabServer({
    service: new LabService({ root }),
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port + "/api/falsify";
  try {
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            Origin: "https://external.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test("custom prompt never falsely labels pasted code known-wrong", () => {
  const problem = { id: "custom", statement: "s", constraints: "c" },
    target = { id: "t", split: "dev", code: "print(1)" };
  const prompt = build_falsify_prompt(problem, target, [], {
    knownWrong: false,
  });
  assert(prompt.includes("correctness is UNKNOWN"));
  assert(!prompt.includes("KNOWN TO BE INCORRECT"));
  assert(
    build_falsify_prompt(problem, target).includes("KNOWN TO BE INCORRECT"),
  );
});
