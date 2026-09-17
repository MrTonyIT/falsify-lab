import { sha256 } from "./domain.js";
import { digest, PROTOCOL_ID } from "./protocol.js";
import { checkerIdentity } from "./checkers.js";
export function oracleBinding(problem) {
  return digest({
    protocol_id: PROTOCOL_ID,
    statement: problem.statement,
    constraints: problem.constraints,
    checker: checkerIdentity(problem.checkerName),
    validator: problem.validatorHash ?? sha256(String(problem.validator)),
    validatorFunction: sha256(String(problem.validator)),
    samples: problem.samples ?? [],
    exactOracle: problem.exactOracle
      ? sha256(String(problem.exactOracle))
      : null,
    references: problem.references.map((r) => ({
      id: r.id,
      sourceHash: sha256(r.code),
      author: r.author,
      provenance: r.provenance,
      algorithmFamily: r.algorithmFamily,
      independenceRationale: r.independenceRationale,
    })),
  });
}
export function assessOracle(problem) {
  if (problem.oracleKind === "synthetic-fixture")
    return {
      trusted: true,
      kind: "synthetic",
      reason: "Authored synthetic fixture; never official evidence",
    };
  try {
    const refs = problem.references ?? [];
    if (
      refs.length !== 3 ||
      new Set(refs.map((r) => sha256(r.code))).size !== 3
    )
      throw new Error("Three distinct references required");
    const samplesHash = digest(problem.samples ?? []);
    if (!problem.samples?.length)
      throw new Error("Public sample evidence required");
    for (const r of refs) {
      if (
        !r.author ||
        !r.provenance ||
        !r.algorithmFamily ||
        !r.independenceRationale
      )
        throw new Error(
          "Reference provenance and independence rationale missing",
        );
      if (r.sourceHash !== sha256(r.code))
        throw new Error("Reference source binding stale");
      if (
        r.review?.status !== "reviewed" ||
        !r.review.reviewer ||
        !Number.isFinite(Date.parse(r.review.reviewedAt))
      )
        throw new Error("Reference manual review missing");
      if (
        r.sampleVerification?.status !== "passed" ||
        r.sampleVerification.sourceHash !== r.sourceHash ||
        r.sampleVerification.samplesHash !== samplesHash
      )
        throw new Error("Reference sample verification missing or stale");
    }
    const review = problem.oracleReview;
    if (
      review?.status !== "reviewed" ||
      !review.reviewer ||
      !review.independenceRationale ||
      !Number.isFinite(Date.parse(review.reviewedAt))
    )
      throw new Error("Oracle review missing");
    if (review.binding !== oracleBinding(problem))
      throw new Error("Oracle review binding stale");
    return {
      trusted: true,
      kind: "reviewed",
      binding: review.binding,
      reason:
        "Operator-reviewed evidence; independence is an attestation, not automatically proved",
    };
  } catch (error) {
    return { trusted: false, kind: "unverified", reason: error.message };
  }
}
