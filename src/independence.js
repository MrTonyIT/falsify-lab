import { assert, sha256 } from "./domain.js";
import { digest, protocolBinding, currentProtocol } from "./protocol.js";
const normalize = (s) =>
  String(s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function independenceFindings(problems) {
  const findings = [];
  for (let i = 0; i < problems.length; i++)
    for (let j = i + 1; j < problems.length; j++) {
      const a = problems[i],
        b = problems[j],
        reasons = [];
      const canonical = (p) =>
        p.canonicalIdentity ??
        (p.contestId !== undefined && p.index !== undefined
          ? `${p.contestId}:${p.index}`
          : null);
      if (canonical(a) && normalize(canonical(a)) === normalize(canonical(b)))
        reasons.push("canonical-identity");
      if (normalize(a.statement) === normalize(b.statement))
        reasons.push("normalized-statement");
      const sources = (p) =>
        [...p.references, ...p.dev, ...p.heldOut].map((s) => sha256(s.code));
      const left = new Set(sources(a));
      if (sources(b).some((h) => left.has(h))) reasons.push("reused-source");
      // Token overlap is a review trigger, never a semantic-equivalence verdict.
      const words = (p) =>
          new Set(normalize(p.statement).match(/[\p{L}\p{N}]+/gu) ?? []),
        x = words(a),
        y = words(b);
      const union = new Set([...x, ...y]);
      if (
        union.size >= 10 &&
        [...x].filter((w) => y.has(w)).length / union.size >= 0.9
      )
        reasons.push("near-statement");
      if (reasons.length) findings.push({ problems: [a.id, b.id], reasons });
    }
  return findings;
}
export function independenceBinding(problems) {
  return digest({
    ...protocolBinding(),
    problems: problems.map((p) => ({
      id: p.id,
      canonicalIdentity: p.canonicalIdentity ?? null,
      contestId: p.contestId ?? null,
      index: p.index ?? null,
      statement: p.statement,
      constraints: p.constraints,
      sources: [...p.references, ...p.dev, ...p.heldOut].map((s) =>
        sha256(s.code),
      ),
    })),
    findings: independenceFindings(problems),
  });
}
export function validateIndependence(problems) {
  assert(
    new Set(problems.map((p) => p.id)).size === problems.length,
    "Duplicate problem IDs",
  );
  const findings = independenceFindings(problems);
  if (!findings.length) return;
  const review = problems.independenceReview;
  assert(
    currentProtocol(review) &&
      review.status === "reviewed" &&
      typeof review.reviewer === "string" &&
      review.reviewer.trim() &&
      typeof review.rationale === "string" &&
      review.rationale.trim() &&
      Number.isFinite(Date.parse(review.reviewed_at)) &&
      review.binding === independenceBinding(problems),
    "Global problem independence requires current hash-bound human review",
  );
}
