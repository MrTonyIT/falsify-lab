import test from "node:test";
import assert from "node:assert/strict";
import { learnerCandidates } from "../fixtures/learner-candidates.js";
import { DockerSandbox } from "../src/sandbox.js";
import { LabService, examples } from "../server/service.js";
import { replayRevision } from "../server/replay.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test(
  "real Python Docker: candidate reference drafts and seeded wrong controls (not human review)",
  { skip: process.env.FALSIFIER_DOCKER_TEST !== "1", timeout: 300000 },
  async () => {
    const sandbox = new DockerSandbox({
      image: process.env.FALSIFIER_SANDBOX_IMAGE ?? "ai-falsifier-python:local",
    });
    await sandbox.check();
    for (const p of learnerCandidates) {
      for (const c of [...p.samples, p.counterexample])
        for (const reference of p.referenceDrafts) {
          const r = await sandbox.run(reference.code, Buffer.from(c.input));
          assert.equal(r.exitCode, 0, p.id + ": " + r.stderr);
          assert.equal(r.stdout.toString(), c.output, p.id);
        }
      const wrong = await sandbox.run(
        p.wrongSource,
        Buffer.from(p.counterexample.input),
      );
      assert.equal(wrong.exitCode, 0);
      assert.notEqual(wrong.stdout.toString(), p.counterexample.output, p.id);
      const sample = await sandbox.run(
        p.wrongSource,
        Buffer.from(p.samples[0].input),
      );
      assert.equal(sample.exitCode, 0);
      assert.equal(sample.stdout.toString(), p.samples[0].output, p.id);
    }
  },
);

test(
  "real Python Docker: replay saved demo input with arbitrary revised source and no provider",
  { skip: process.env.FALSIFIER_DOCKER_TEST !== "1", timeout: 300000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "runtime-replay-"));
    const service = new LabService({ root, demoDelay: 0 });
    try {
      await service.init();
      const job = await service.start({
        ...examples[0],
        mode: "demo",
        language: "python",
      });
      while (service.active) await new Promise((r) => setTimeout(r, 10));
      // Test-only transition: the original input is explicitly simulated; revision execution is real Docker.
      service.get(job.id).mode = "playground";
      service.sandbox = new DockerSandbox({
        image:
          process.env.FALSIFIER_SANDBOX_IMAGE ?? "ai-falsifier-python:local",
      });
      const good = await replayRevision(
        service,
        job.id,
        2,
        { code: examples[1].code + "\n# arbitrary revision" },
        examples,
      );
      assert.equal(good.verdict, "survived");
      assert.equal(good.execution_kind, "docker");
      assert.equal(good.model_calls, 0);
      assert(good.image_id.startsWith("sha256:"));
      const bad = await replayRevision(
        service,
        job.id,
        2,
        { code: examples[0].code },
        examples,
      );
      assert.equal(bad.verdict, "kill");
      const crash = await replayRevision(
        service,
        job.id,
        2,
        { code: 'raise RuntimeError("test")' },
        examples,
      );
      assert.equal(crash.verdict, "inconclusive");
      await assert.rejects(
        () => replayRevision(service, job.id, 2, { code: "if (" }, examples),
        (e) => e.code === "COMPILE_FAILED",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
