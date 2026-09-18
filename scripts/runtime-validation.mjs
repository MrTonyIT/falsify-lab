import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { protocolBinding, digest } from "../src/protocol.js";
import { verifyRuntimeValidation } from "../src/prerequisites.js";
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw Error("Runtime validation requires a clean committed worktree");
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  }).trim();
const image = (tag) => {
  const [i] = JSON.parse(docker(["image", "inspect", tag]));
  return {
    imageId: i.Id,
    baseImage: i.Config.Labels?.["org.falsify.base-image"],
  };
};
const images = {
  python: image("ai-falsifier-python:local"),
  multilang: image("ai-falsifier-multilang:local"),
};
const version = (id, args) =>
  docker([
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    id,
    ...args,
  ]);
const versions = {
  python: version(images.python.imageId, ["python", "--version"]),
  multilang: {},
};
for (const [name, args] of Object.entries({
  python: ["python", "--version"],
  gcc: ["gcc", "--version"],
  gpp: ["g++", "--version"],
  node: ["node", "--version"],
  typescript: ["tsc", "--version"],
  java: ["java", "--version"],
  javac: ["javac", "--version"],
  go: ["go", "version"],
  rust: ["rustc", "--version"],
  mono: ["mono", "--version"],
  mcs: ["mcs", "--version"],
  ruby: ["ruby", "--version"],
  php: ["php", "--version"],
}))
  versions.multilang[name] = version(images.multilang.imageId, args);
mkdirSync("artifacts", { recursive: true });
const run = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-reporter=tap",
    "--test-timeout=300000",
    "test/docker.test.js",
    "test/languages.test.js",
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    timeout: 900000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      FALSIFIER_DOCKER_TEST: "1",
      FALSIFIER_MULTILANG_TEST: "1",
      FALSIFIER_SANDBOX_IMAGE: images.python.imageId,
      FALSIFIER_MULTILANG_IMAGE: images.multilang.imageId,
    },
  },
);
const output = (run.stdout ?? "") + (run.stderr ?? "");
writeFileSync("artifacts/runtime-validation.tap", output);
process.stdout.write(output);
const count = (key) => {
  const m = output.match(new RegExp("^# " + key + " (\\d+)\\s*$", "m"));
  if (!m) throw Error("Missing test counter " + key);
  return Number(m[1]);
};
const record = {
  ...protocolBinding(),
  git_commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  images,
  docker_version: docker(["version", "--format", "{{json .}}"]),
  versions,
  test_results: {
    passed: count("pass"),
    failed: count("fail"),
    skipped: count("skipped"),
    cancelled: count("cancelled"),
  },
  timestamp: new Date().toISOString(),
  workflow_run: process.env.GITHUB_RUN_ID ?? null,
};
const evidence = { ...record, sha: digest(record) };
writeFileSync(
  "artifacts/runtime-validation.json",
  JSON.stringify(evidence, null, 2),
);
if (run.error || run.status !== 0)
  throw run.error ?? Error("Runtime tests failed");
verifyRuntimeValidation(evidence, {
  git_commit: record.git_commit,
  image_id: images.python.imageId,
});
