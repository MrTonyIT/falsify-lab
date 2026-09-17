import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { assert, LIMITS, sha256 } from "./domain.js";
import { JsonlLog, readJsonl } from "./logging.js";
import { corpusIdentity, qualityAudit } from "./corpus.js";
import { freezeBaseline, runBaselines } from "./baseline.js";
import { runPair } from "./falsify.js";
import {
  collectCandidates,
  buildKillMatrix,
  freezeSuite,
  evaluateHeldOut,
} from "./track2.js";
import { configIdentity } from "./llm.js";
import { sealEvidence } from "./evidence.js";
import { protocolBinding } from "./protocol.js";
export function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "UNCOMMITTED";
  }
}
export function sourceClean() {
  try {
    return (
      execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === ""
    );
  } catch {
    return false;
  }
}
export function metadataFor(problems, config, kind) {
  return {
    ...protocolBinding(),
    expected_pairs: problems.flatMap((p) =>
      p.dev.map((s) => ({
        problem_id: p.id,
        submission_id: s.id,
        source_hash: sha256(s.code),
      })),
    ),
    source_clean: sourceClean(),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    run_id:
      new Date().toISOString().replaceAll(":", "-") +
      "_" +
      randomUUID().slice(0, 8),
    git_commit: gitCommit(),
    started_at: new Date().toISOString(),
    kind,
    model: config.model,
    reasoning_effort: config.reasoningEffort,
    max_completion_tokens: config.maxCompletionTokens,
    corpus_id: corpusIdentity(problems),
    seed: LIMITS.seed,
    pricing: config.pricing,
    response_cache: false,
    prompt_cache: "provider-managed; cached input tokens logged",
    limits: LIMITS,
    provider_endpoint: config.endpoint ?? null,
    snapshot_pinned: config.snapshotPinned ?? false,
    temperature: config.temperature ?? null,
    max_input_tokens: config.maxInputTokens ?? null,
    cost_limit_usd: config.costLimitUsd ?? null,
    config_id: configIdentity(config),
  };
}
export async function initializeRun(directory, metadata) {
  const log = new JsonlLog(directory);
  await log.initialize(metadata);
  await log.append("events", { ...metadata, event: "run_started" });
  return log;
}
export async function auditCorpus(problems, evaluator) {
  const audits = [];
  for (const p of problems) audits.push(await qualityAudit(p, evaluator));
  return {
    corpus_id: corpusIdentity(problems),
    problems: audits,
    completed_at: new Date().toISOString(),
  };
}
export async function track2({
  problems,
  evaluator,
  directory,
  log,
  metadata,
}) {
  const attempts = await readJsonl(join(directory, "attempts.jsonl"));
  for (const problem of problems) {
    const candidates = collectCandidates(problem, attempts, metadata.run_id),
      matrix = await buildKillMatrix(problem, candidates, evaluator),
      suite = freezeSuite(problem, candidates, matrix, metadata.corpus_id);
    // Persist selection before even reading held-out outcomes.
    await log.append("track2", {
      run_id: metadata.run_id,
      event: "suite_frozen",
      problem_id: problem.id,
      matrix,
      suite,
    });
    await log.append("track2", {
      run_id: metadata.run_id,
      event: "held_out_evaluated",
      ...(await evaluateHeldOut(problem, suite, evaluator, metadata.corpus_id)),
    });
  }
}
export async function track1({
  problems,
  evaluator,
  llm,
  log,
  metadata,
  pairLimit = Infinity,
}) {
  let count = 0;
  for (const problem of problems)
    for (const target of problem.dev) {
      if (count >= pairLimit) return count;
      await runPair({ problem, target, evaluator, llm, log, metadata });
      count++;
    }
  return count;
}
export async function baselineWorkflow({
  problems,
  evaluator,
  directory,
  config,
}) {
  const frozen = freezeBaseline(problems),
    metadata = {
      ...metadataFor(problems, config, "baseline"),
      baseline_sha: frozen.sha,
      sandbox: {
        kind: evaluator.sandbox?.kind ?? "unverified",
        imageId: evaluator.sandbox?.imageId ?? null,
      },
    },
    log = await initializeRun(directory, metadata);
  await writeFile(
    join(directory, "baseline.json"),
    JSON.stringify(frozen, null, 2),
    { flag: "wx" },
  );
  const quality = await auditCorpus(problems, evaluator);
  assert(
    quality.problems.every((p) => p.rejected.length === 0),
    "Corpus contains sample failures",
  );
  await log.append("events", { event: "quality_audit", ...quality });
  await runBaselines({ problems, frozen, evaluator, log, metadata });
  await log.append("events", {
    run_id: metadata.run_id,
    event: "run_complete",
  });
  await sealEvidence(directory);
  const digest = sha256(await readFile(join(directory, "attempts.jsonl")));
  return {
    frozen,
    quality,
    baseline: {
      sha: frozen.sha,
      completed: true,
      log_digest: digest,
      directory,
      completed_at: new Date().toISOString(),
    },
  };
}
