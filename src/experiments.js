import { assert, sha256, Verdict } from "./domain.js";
import { assessOracle } from "./oracle.js";
import { corpusIdentity } from "./corpus.js";
import {
  protocolBinding,
  digest,
  deepFreeze,
  currentProtocol,
} from "./protocol.js";

// This schema reserves unseen problems before tuning; it is not a dataset.
export function freezePartitions(
  development,
  unseen,
  { reviewer, rationale } = {},
) {
  assert(
    development.length && unseen.length,
    "Real development and unseen problems required",
  );
  assert(
    reviewer && rationale,
    "Human duplicate/near-duplicate problem review required",
  );
  const ids = new Set(development.map((p) => p.id)),
    statements = new Set(development.map((p) => p.statement.trim()));
  assert(
    unseen.every((p) => !ids.has(p.id) && !statements.has(p.statement.trim())),
    "Problem partitions overlap",
  );
  assert(
    new Set([...development, ...unseen].map((p) => p.id)).size ===
      development.length + unseen.length,
    "Duplicate problem IDs",
  );
  const content = {
    ...protocolBinding(),
    development: corpusIdentity(development),
    unseen: corpusIdentity(unseen),
    reviewer,
    rationale,
    frozen_at: new Date().toISOString(),
  };
  return deepFreeze({ ...content, sha: digest(content) });
}
export function verifyPartitions(frozen, development, unseen) {
  const { sha, ...content } = frozen;
  assert(
    currentProtocol(frozen) &&
      digest(content) === sha &&
      corpusIdentity(development) === frozen.development &&
      corpusIdentity(unseen) === frozen.unseen,
    "Frozen problem partition changed",
  );
}

// Optional post-analysis only. It never replaces an official candidate or its hash.
// Candidate proposals are trusted operator code, never arbitrary browser plugins.
export async function shrinkCounterexample({
  problem,
  target,
  input,
  evaluator,
  proposals,
  maxChecks = 50,
}) {
  assert(
    assessOracle(problem).trusted,
    "Reviewed or explicit synthetic oracle required",
  );
  assert(
    Number.isSafeInteger(maxChecks) && maxChecks > 0 && maxChecks <= 1000,
    "Bounded shrink budget required",
  );
  assert(
    Buffer.isBuffer(input) && typeof proposals === "function",
    "Input and proposal function required",
  );
  const judge = async (data) =>
    evaluator.judge(problem, target, await evaluator.prepare(problem, data));
  const original = await judge(input);
  assert(original.verdict === Verdict.KILL, "Original input must still kill");
  let best = Buffer.from(input),
    semantic = original.semanticSize ?? null,
    checks = 0;
  for await (const data of proposals(Buffer.from(input))) {
    if (checks >= maxChecks) break;
    checks++;
    if (!Buffer.isBuffer(data) || data.length >= best.length) continue;
    const result = await judge(data);
    if (result.verdict === Verdict.KILL && result.detail === original.detail) {
      best = Buffer.from(data);
      semantic = result.semanticSize ?? null;
    }
  }
  return {
    ...protocolBinding(),
    phase: "post-analysis",
    claim: "locally reduced under supplied proposals; not globally minimal",
    problem_identity: corpusIdentity([problem]),
    target_hash: sha256(target.code),
    checks,
    max_checks: maxChecks,
    original: {
      base64: input.toString("base64"),
      sha: sha256(input),
      bytes: input.length,
      semantic_size: original.semanticSize ?? null,
    },
    minimized: {
      base64: best.toString("base64"),
      sha: sha256(best),
      bytes: best.length,
      semantic_size: semantic,
    },
  };
}
