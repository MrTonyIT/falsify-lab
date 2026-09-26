import { mkdir, writeFile } from "node:fs/promises";
import { learnerCandidates } from "../fixtures/learner-candidates.js";
import { sha256 } from "../src/domain.js";
await mkdir("private", { recursive: true });
const packet = {
  status: "pending-human-review",
  independence: "NOT ESTABLISHED",
  instructions:
    "Read docs/CANDIDATE_REVIEW.md. This packet never promotes candidates into the live corpus.",
  problems: learnerCandidates.map(({ validator, solve, ...p }) => ({
    ...p,
    validatorSource: String(validator),
    validatorHash: sha256(String(validator)),
    correctControl: p.referenceDrafts[0],
    referenceDrafts: p.referenceDrafts.map((r) => ({
      ...r,
      sourceHash: sha256(r.code),
    })),
  })),
};
await writeFile(
  "private/learner-candidate-review.json",
  JSON.stringify(packet, null, 2),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Wrote private/learner-candidate-review.json (pending; existing packets are not overwritten).",
);
