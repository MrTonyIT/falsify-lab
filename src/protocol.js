import { createHash } from "node:crypto";
export const PROTOCOL_VERSION = "3.1.0";
export const EVIDENCE_SCHEMA = 4;
const attemptBudget = 3;
export const SCIENTIFIC_LIMITS = deepFreeze({
  attempts: attemptBudget,
  seed: 12345,
  generatorSeconds: 10,
  runSeconds: 30,
  compileSeconds: 20,
  syntaxSeconds: 10,
  prepareSeconds: 1,
  memoryBytes: 1073741824,
  inputBytes: 8388608,
  outputBytes: 8388608,
  stderrBytes: 65536,
  pids: 64,
  cpus: 2,
  tmpfsMiB: 64,
  workMiB: 256,
  pythonFiles: 64,
  multilangFiles: 128,
  heapMiB: 256,
  codeCacheMiB: 64,
  cpuHardGraceSeconds: 1,
  maxCompletionTokens: 16000,
  baselineBudgets: [attemptBudget, 50],
  providerResponseBytes: 8388608,
});
export const RESOURCE_POLICY_ID = digest(SCIENTIFIC_LIMITS);
export const PROTOCOL = deepFreeze({
  version: PROTOCOL_VERSION,
  checkerVersion: 2,
  population: {
    problems: 30,
    perDivision: 10,
    devPerProblem: 15,
    heldOutPerProblem: 10,
    pilotMinimum: 20,
  },
  oraclePolicy: "review-bound-or-explicit-synthetic; unverified-fails-closed",
  crashPolicy: "ambiguous-runtime-failure-is-inconclusive",
  feedback:
    "DEV target, public statement, own candidate and canonical verdict only",
  selection: "DEV greedy set cover; immutable content-addressed suite",
  primaryMetric: "all_pair_kill_at_3",
  secondaryMetric: "eligible_pair_kill_at_3",
  limits: SCIENTIFIC_LIMITS,
});
export function canonicalJson(value) {
  const normalize = (v) => {
    if (v === undefined) return null;
    if (typeof v === "number" && !Number.isFinite(v))
      throw new Error("Non-finite evidence number");
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .filter((k) => v[k] !== undefined)
          .map((k) => [k, normalize(v[k])]),
      );
    if (["function", "symbol", "bigint"].includes(typeof v))
      throw new Error("Non-JSON evidence value");
    return v;
  };
  return JSON.stringify(normalize(value));
}
export function digest(value) {
  return (
    "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex")
  );
}
export const PROTOCOL_ID = digest(PROTOCOL);
export function deepFreeze(obj) {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}
export function protocolBinding() {
  return {
    protocol_version: PROTOCOL_VERSION,
    protocol_id: PROTOCOL_ID,
    evidence_schema: EVIDENCE_SCHEMA,
    resource_policy_id: RESOURCE_POLICY_ID,
  };
}
export function currentProtocol(record) {
  return (
    record?.protocol_id === PROTOCOL_ID &&
    record?.protocol_version === PROTOCOL_VERSION &&
    record?.evidence_schema === EVIDENCE_SCHEMA &&
    record?.resource_policy_id === RESOURCE_POLICY_ID
  );
}
