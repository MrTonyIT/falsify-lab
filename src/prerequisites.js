import { assert } from "./domain.js";
import { protocolBinding, currentProtocol, digest } from "./protocol.js";
const image = (id) => /^sha256:[a-f0-9]{64}$/.test(id ?? "");
export function verifyRuntimeValidation(record, { git_commit, image_id } = {}) {
  assert(
    record && currentProtocol(record),
    "Runtime validation protocol/resource policy is stale",
  );
  const { sha, ...content } = record;
  assert(sha === digest(content), "Runtime validation hash mismatch");
  assert(
    record.git_commit === git_commit,
    "Runtime validation Git revision mismatch",
  );
  assert(
    record.images?.python?.imageId === image_id &&
      image(image_id) &&
      image(record.images?.multilang?.imageId),
    "Runtime validation image mismatch",
  );
  for (const value of Object.values(record.images))
    assert(
      /@sha256:[a-f0-9]{64}$/.test(value.baseImage ?? ""),
      "Runtime validation requires digest-pinned base images",
    );
  assert(
    typeof record.docker_version === "string" &&
      record.docker_version &&
      record.versions?.python &&
      record.versions?.multilang,
    "Runtime/compiler versions missing",
  );
  assert(
    record.test_results?.passed > 0 &&
      record.test_results.failed === 0 &&
      record.test_results.skipped === 0 &&
      record.test_results.cancelled === 0,
    "Real runtime suite must pass without skips/cancellations",
  );
  assert(
    Number.isFinite(Date.parse(record.timestamp)),
    "Runtime validation timestamp missing",
  );
  return sha;
}
export function prerequisiteBinding({
  git_commit,
  corpus_id,
  config_id,
  image_id,
  runtime_validation_id,
}) {
  return {
    ...protocolBinding(),
    git_commit,
    corpus_id,
    config_id,
    image_id,
    runtime_validation_id,
  };
}
export function verifyPrerequisite(record, expected, { config = true } = {}) {
  assert(
    currentProtocol(record),
    "Prerequisite protocol/resource policy mismatch",
  );
  if (["baseline", "pilot", "compatibility"].includes(record.kind))
    assert(
      record.source_clean === true,
      "Prerequisite was made with uncommitted code",
    );
  for (const key of [
    "git_commit",
    "corpus_id",
    "image_id",
    "runtime_validation_id",
    ...(config ? ["config_id"] : []),
  ])
    assert(
      typeof expected[key] === "string" && record?.[key] === expected[key],
      `Prerequisite ${key} mismatch`,
    );
}
