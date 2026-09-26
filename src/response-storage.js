import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { assert, LIMITS, sha256 } from "./domain.js";

const blobName = /^[a-f0-9]{64}\.txt$/;
// Raw bytes are bounded individually, not accumulated into one JSONL artifact.
export async function storeResponse(directory, record) {
  if (typeof record.raw_response !== "string") return record;
  const raw = record.raw_response;
  assert(
    Buffer.byteLength(raw) <= LIMITS.providerResponseBytes,
    "Response exceeds bound",
  );
  assert(sha256(raw) === record.raw_response_sha, "Response hash mismatch");
  const folder = join(directory, "responses");
  await mkdir(folder, { recursive: true, mode: 0o700 });
  assert(
    !(await lstat(folder)).isSymbolicLink(),
    "Response directory cannot be a symlink",
  );
  const filename = record.raw_response_sha.slice(7) + ".txt";
  try {
    await writeFile(join(folder, filename), raw, { flag: "wx", mode: 0o600 });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    assert(
      (await hashResponseFile(join(folder, filename))) ===
        record.raw_response_sha,
      "Existing response blob mismatch",
    );
  }
  return {
    ...record,
    raw_response: null,
    raw_response_file: "responses/" + filename,
    response_storage_version: 1,
  };
}
async function hashResponseFile(path) {
  const info = await lstat(path);
  assert(
    info.isFile() &&
      !info.isSymbolicLink() &&
      info.size <= LIMITS.providerResponseBytes,
    "Invalid response blob",
  );
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return "sha256:" + hash.digest("hex");
}
export async function responseHashes(directory) {
  const folder = join(directory, "responses");
  try {
    assert(
      (await lstat(folder)).isDirectory() &&
        !(await lstat(folder)).isSymbolicLink(),
      "Invalid response directory",
    );
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
  const result = {};
  for (const name of (await readdir(folder)).sort()) {
    assert(blobName.test(name), "Unexpected response artifact");
    result["responses/" + name] = await hashResponseFile(join(folder, name));
  }
  return result;
}
export function verifyResponseReference(record, hashes) {
  if (record.raw_response_file !== undefined) {
    assert(
      record.response_storage_version === 1 &&
        record.raw_response === null &&
        /^responses\/[a-f0-9]{64}\.txt$/.test(record.raw_response_file),
      "Invalid private response reference",
    );
    assert(
      hashes[record.raw_response_file] === record.raw_response_sha,
      "Private response blob missing or changed",
    );
  } else
    assert(
      record.raw_response === null ||
        sha256(record.raw_response) === record.raw_response_sha,
      "Inline response hash mismatch",
    );
}
