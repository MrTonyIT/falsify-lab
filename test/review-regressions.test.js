import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIMITS, validateProblem, sha256 } from "../src/domain.js";
import {
  SCIENTIFIC_LIMITS,
  PROTOCOL,
  PROTOCOL_ID,
  RESOURCE_POLICY_ID,
  protocolBinding,
  currentProtocol,
  digest,
} from "../src/protocol.js";
import { verifyRuntimeValidation } from "../src/prerequisites.js";
import { verifyAnalysisPlan } from "../src/analysis-plan.js";
import { runtimeFixture, planFixture } from "./review-fixtures.js";
import {
  independenceBinding,
  validateIndependence,
} from "../src/independence.js";
import { smokeProblem } from "../fixtures/sum-problem.js";
import {
  verifyReportComparisons,
  redactScripts,
  report,
} from "../src/report.js";
import { Budget } from "../src/budget.js";
import { parseRoute } from "../web/src/routes.js";
import { preserveResponse } from "../src/responses.js";
import { JsonlLog } from "../src/logging.js";
import { sealEvidence, inspectEvidence } from "../src/evidence.js";
import { smoke } from "../src/smoke.js";

test("resource policy is the runtime singleton and every field changes protocol identity", () => {
  assert.equal(LIMITS, SCIENTIFIC_LIMITS);
  assert.equal(PROTOCOL.limits, LIMITS);
  assert.equal(digest(LIMITS), RESOURCE_POLICY_ID);
  for (const [k, v] of Object.entries(LIMITS)) {
    const changed = Array.isArray(v) ? [...v, 99] : v + 1;
    assert.notEqual(
      digest({ ...PROTOCOL, limits: { ...LIMITS, [k]: changed } }),
      PROTOCOL_ID,
      k,
    );
  }
  assert(
    !currentProtocol({ ...protocolBinding(), resource_policy_id: "stale" }),
  );
});
test("official runtime-error populations remain forbidden even with opt-in", () => {
  const p = smokeProblem();
  p.dev[0].verdict = "RUNTIME_ERROR";
  assert.throws(() =>
    validateProblem(p, { official: true, allowRuntimeError: true }),
  );
});
test("runtime artifact rejects failed/skipped tests, mutable bases and stale commits/images", () => {
  const commit = "a".repeat(40),
    image = "sha256:" + "b".repeat(64),
    r = runtimeFixture(commit, image),
    expected = { git_commit: commit, image_id: image };
  assert.equal(verifyRuntimeValidation(r, expected), r.sha);
  for (const mutate of [
    (x) => (x.git_commit = "c".repeat(40)),
    (x) => (x.images.python.imageId = "sha256:" + "e".repeat(64)),
    (x) => (x.images.multilang.baseImage = "debian:latest"),
    (x) => (x.test_results.skipped = 1),
    (x) => (x.test_results.failed = 1),
    (x) => (x.resource_policy_id = "old"),
  ]) {
    const x = structuredClone(r);
    mutate(x);
    const { sha, ...body } = x;
    x.sha = digest(body);
    assert.throws(() => verifyRuntimeValidation(x, expected));
  }
  assert.throws(() => verifyRuntimeValidation({ passed: true }, expected));
});
test("frozen analysis plan rejects edits and changes to study identity", () => {
  const binding = {
      git_commit: "a".repeat(40),
      corpus_id: "corpus",
      config_id: "config",
    },
    plan = planFixture(binding);
  assert.equal(verifyAnalysisPlan(plan, binding), plan.sha);
  assert.throws(() =>
    verifyAnalysisPlan({ ...plan, hypotheses: ["changed"] }, binding),
  );
  for (const k of Object.keys(binding))
    assert.throws(() => verifyAnalysisPlan(plan, { ...binding, [k]: "stale" }));
});
test("cross-problem duplicates require review bound to sources, statements and canonical identities", () => {
  const a = smokeProblem(),
    b = smokeProblem();
  b.id = "other";
  const problems = [a, b];
  assert.throws(() => validateIndependence(problems), /independence/);
  problems.independenceReview = {
    ...protocolBinding(),
    status: "reviewed",
    reviewer: "TEST DOUBLE",
    reviewed_at: "2026-01-01",
    rationale: "Synthetic fixture only",
    binding: independenceBinding(problems),
  };
  validateIndependence(problems);
  b.constraints += " changed";
  assert.throws(() => validateIndependence(problems));
  b.statement = "Different problem";
  a.canonicalIdentity = b.canonicalIdentity = "CF:1:A";
  assert.throws(() => validateIndependence(problems));
});
test("comparison official status comes only from primary and exact baseline identity is required", () => {
  const metadata = {
      ...protocolBinding(),
      corpus_id: "corpus",
      kind: "pilot",
      source_clean: true,
      git_commit: "commit",
      config_id: "config",
      image_id: "image",
      runtime_validation_id: "runtime",
    },
    pilot = { metadata, status: "VERIFIED", official: false },
    official = {
      metadata: {
        ...metadata,
        kind: "official",
        preflight: { baseline_sha: "frozen" },
      },
      status: "VERIFIED",
      official: true,
    };
  assert.equal(verifyReportComparisons([pilot, official]), false);
  const baseline = {
    ...pilot,
    metadata: { ...metadata, kind: "baseline", baseline_sha: "frozen" },
  };
  assert.equal(verifyReportComparisons([official, baseline]), true);
  assert.throws(() =>
    verifyReportComparisons([
      official,
      {
        ...baseline,
        metadata: { ...baseline.metadata, baseline_sha: "other" },
      },
    ]),
  );
  for (const k of [
    "corpus_id",
    "protocol_id",
    "protocol_version",
    "evidence_schema",
    "resource_policy_id",
  ])
    assert.throws(() =>
      verifyReportComparisons([
        pilot,
        { ...official, metadata: { ...official.metadata, [k]: "other" } },
      ]),
    );
});
test("public reports redact nested scripts and preserve group evidence status", async () => {
  const root = await mkdtemp(join(tmpdir(), "review-report-"));
  await smoke(root);
  const r = await report(root);
  assert.equal(r.official_status, "NOT RUN");
  assert(
    Object.values(r.groups).every(
      (g) => g.evidence_status === "DEMO" && g.official_status === "NOT RUN",
    ),
  );
  const text = JSON.stringify(r);
  assert(!text.includes('"script":'));
  assert(!text.includes('"generator_script":'));
  assert(!text.includes('"raw_response":'));
  assert.deepEqual(
    redactScripts({
      a: [{ script: "SECRET", id: "keep", raw_response: "SECRET" }],
    }),
    { a: [{ id: "keep" }] },
  );
});
test("private responses keep provenance, support hash-only retention and invalidate seals on mutation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "review-response-")),
    log = new JsonlLog(dir),
    metadata = {
      ...protocolBinding(),
      kind: "pilot",
      run_id: "r",
      config_id: "c",
      limits: LIMITS,
    };
  await log.initialize(metadata);
  await log.append("events", { event: "run_started", run_id: "r" });
  const response = {
    rawResponse: '{"private":"SOURCE"}',
    text: "SOURCE",
    providerModel: "snapshot",
    requestId: "req",
    tokensIn: 2,
    tokensOut: 3,
    costUsd: 0.2,
    finishReason: "stop",
  };
  await preserveResponse(log, response, metadata, {
    problem_id: "p",
    submission_id: "s",
    attempt: 1,
    retainRaw: false,
  });
  const file = join(dir, "responses.jsonl"),
    row = JSON.parse((await readFile(file, "utf8")).trim());
  assert.equal(row.raw_response, null);
  assert.equal(row.raw_response_sha, sha256(response.rawResponse));
  assert.equal(row.provider_request_id, "req");
  await log.append("events", { event: "run_complete", run_id: "r" });
  await sealEvidence(dir);
  assert.equal((await inspectEvidence(dir)).status, "VERIFIED");
  await writeFile(file, "{}\n");
  assert.equal((await inspectEvidence(dir)).status, "INCOMPLETE");
});
test("operator budget reconciliation requires billing evidence and never double-charges", () => {
  const b = new Budget(10),
    id = b.reserve(1);
  assert.throws(() =>
    b.reconcile({
      action: "release",
      reservation: id,
      operator: "test",
      evidence: "bill",
    }),
  );
  assert.throws(() => b.reserve(1));
  b.reconcile({
    action: "release",
    reservation: id,
    operator: "test",
    evidence: "verified zero billing",
    noBilling: true,
  });
  assert.equal(b.spent, 0);
  const second = b.reserve(1);
  assert.equal(b.charge(2, second), false);
  assert.equal(b.spent, 2);
  assert.throws(() =>
    b.reconcile({
      action: "release",
      reservation: second,
      operator: "test",
      evidence: "bill",
      noBilling: true,
    }),
  );
  b.reconcile({
    action: "settle",
    reservation: second,
    operator: "test",
    evidence: "invoice",
    actualCost: 2.5,
  });
  assert.equal(b.spent, 2.5);
  assert.equal(b.state.reconciliations.length, 2);
  b.reserve(1);
});
test("malformed and unknown hash routes safely fall back", () => {
  for (const hash of ["#%", "#%E0%A4%A", "#javascript:alert(1)", "#unknown"])
    assert.equal(parseRoute(hash), "Playground");
  assert.equal(parseRoute("#Test%20Suites"), "Test Suites");
  assert.equal(parseRoute("#System"), "System");
});
