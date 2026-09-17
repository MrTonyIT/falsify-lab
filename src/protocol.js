import { createHash } from "node:crypto";
export const PROTOCOL_VERSION = "3.0.0";
export const EVIDENCE_SCHEMA = 3;
export const PROTOCOL = Object.freeze({
  version: PROTOCOL_VERSION,
  checkerVersion: 2,
  oraclePolicy: "review-bound-or-explicit-synthetic; unverified-fails-closed",
  crashPolicy: "ambiguous-runtime-failure-is-inconclusive",
  feedback:
    "DEV target, public statement, own candidate and canonical verdict only",
  selection: "DEV greedy set cover; immutable content-addressed suite",
  primaryMetric: "all_pair_kill_at_3",
  secondaryMetric: "eligible_pair_kill_at_3",
  attempts: 3,
  seed: 12345,
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
export const digest = (value) =>
  "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex");
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
  };
}
export function currentProtocol(record) {
  return (
    record?.protocol_id === PROTOCOL_ID &&
    record?.protocol_version === PROTOCOL_VERSION &&
    record?.evidence_schema === EVIDENCE_SCHEMA
  );
}
