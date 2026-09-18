import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { languageFor } from "./languages.js";
import { LIMITS, assert } from "./domain.js";

export class InfrastructureError extends Error {}
export function dockerArgs(image, name, limits) {
  assert(
    typeof image === "string" && image && !image.startsWith("-"),
    "Invalid sandbox image",
  );
  return [
    "run",
    "--pull=never",
    "--name",
    name,
    "--network=none",
    "--read-only",
    "--tmpfs",
    `/tmp:rw,noexec,nosuid,nodev,size=${LIMITS.tmpfsMiB}m`,
    ...(limits.multilang
      ? ["--tmpfs", `/work:rw,exec,nosuid,nodev,size=${LIMITS.workMiB}m`]
      : []),
    "--user",
    "65534:65534",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--cpus",
    String(LIMITS.cpus),
    "--pids-limit",
    String(LIMITS.pids),
    "--memory",
    String(limits.memoryBytes),
    "--memory-swap",
    String(limits.memoryBytes),
    "--env",
    `PYTHONHASHSEED=${LIMITS.seed}`,
    "--env",
    "PYTHONDONTWRITEBYTECODE=1",
    "--log-driver=none",
    "--interactive",
    image,
    "python",
    "-I",
    "/runner.py",
    String(limits.seconds),
  ];
}
function command(
  executable,
  args,
  { input = "", timeout = 10000, maxBytes = 65536 } = {},
) {
  return new Promise((resolve, reject) => {
    const p = spawn(executable, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [],
      stderr = [];
    let bytes = 0,
      overflow = false;
    const timer = setTimeout(() => p.kill(), timeout);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new InfrastructureError(e.message));
    });
    p.stdout.on("data", (b) => {
      bytes += b.length;
      if (bytes <= maxBytes) stdout.push(b);
      else {
        overflow = true;
        p.kill();
      }
    });
    p.stderr.on("data", (b) => {
      if (stderr.reduce((a, x) => a + x.length, 0) < 65536) stderr.push(b);
    });
    p.stdin.on("error", () => {});
    p.stdin.end(input);
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        overflow,
      });
    });
  });
}
export class DockerSandbox {
  kind = "docker";
  constructor({ image = "ai-falsifier-python:local", docker = "docker" } = {}) {
    this.image = image;
    this.docker = docker;
  }
  async check() {
    const r = await command(this.docker, ["info", "--format", "{{.OSType}}"]);
    if (r.code !== 0 || r.stdout.toString().trim() !== "linux")
      throw new InfrastructureError("A Linux Docker daemon is required");
    const image = await command(this.docker, [
      "image",
      "inspect",
      this.image,
      "--format",
      "{{.Id}}",
    ]);
    if (image.code !== 0)
      throw new InfrastructureError("Build sandbox image first");
    const resolvedImage = image.stdout.toString().trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(resolvedImage))
      throw new InfrastructureError("Invalid sandbox image identity");
    if (this.imageId && this.imageId !== resolvedImage)
      throw new InfrastructureError(
        "Sandbox tag changed after pinning; restart and repeat validation",
      );
    this.imageId = resolvedImage;
    return {
      kind: this.kind,
      imageId: this.imageId,
      validation: "NOT RUN",
      node: process.version,
    };
  }
  async run(
    code,
    input = Buffer.alloc(0),
    {
      role = "target",
      seconds = LIMITS.runSeconds,
      memoryBytes = LIMITS.memoryBytes,
      maxBytes = LIMITS.outputBytes,
      language = "python",
      multilang = false,
      prepareOnly = false,
    } = {},
  ) {
    assert(typeof code === "string", "Source required");
    language = languageFor(language).id;
    assert(
      language === "python" || multilang,
      "Non-Python source requires a multi-language sandbox",
    );
    const wallSeconds = seconds + (multilang ? LIMITS.compileSeconds : 0);
    const name = "falsifier-" + randomUUID();
    if (!this.imageId) await this.check();
    const args = dockerArgs(this.imageId, name, {
      seconds: wallSeconds,
      memoryBytes,
      multilang,
    });
    const payload = JSON.stringify({
      code,
      input: Buffer.from(input).toString("base64"),
      role,
      seed: LIMITS.seed,
      language,
      prepareOnly,
      runSeconds: seconds,
      heapMiB: LIMITS.heapMiB,
      codeCacheMiB: LIMITS.codeCacheMiB,
      cpus: LIMITS.cpus,
      cpuHardGraceSeconds: LIMITS.cpuHardGraceSeconds,
      compileSeconds: LIMITS.compileSeconds,
      openFiles: multilang ? LIMITS.multilangFiles : LIMITS.pythonFiles,
    });
    let timedOut = false,
      overflow = false,
      stderrSize = 0,
      stdoutSize = 0;
    const stdout = [],
      stderr = [];
    let timer;
    try {
      const exit = await new Promise((resolve, reject) => {
        const p = spawn(this.docker, args, {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stopping = false;
        const stop = () => {
          if (!stopping) {
            stopping = true;
            command(this.docker, ["kill", name])
              .catch(() => {})
              .finally(() => p.kill());
          }
        };
        timer = setTimeout(() => {
          timedOut = true;
          stop();
        }, wallSeconds * 1000);
        p.on("error", (e) => reject(new InfrastructureError(e.message)));
        p.stdout.on("data", (b) => {
          stdoutSize += b.length;
          if (stdoutSize <= maxBytes) stdout.push(b);
          else {
            overflow = true;
            stop();
          }
        });
        p.stderr.on("data", (b) => {
          const remaining = LIMITS.stderrBytes - stderrSize;
          if (remaining > 0) {
            stderr.push(b.subarray(0, remaining));
            stderrSize += Math.min(remaining, b.length);
          }
        });
        p.stdin.on("error", () => {});
        p.stdin.end(payload);
        p.on("close", resolve);
      });
      clearTimeout(timer);
      const stateResult = await command(this.docker, [
        "inspect",
        "--format",
        "{{json .State}}",
        name,
      ]);
      if (stateResult.code !== 0)
        throw new InfrastructureError(
          "Container state unavailable; no benchmark verdict recorded",
        );
      const state = JSON.parse(stateResult.stdout.toString());
      if (
        state.Running ||
        !Number.isInteger(state.ExitCode) ||
        !Number.isFinite(Date.parse(state.FinishedAt))
      )
        throw new InfrastructureError(
          "Incomplete container termination evidence",
        );
      if (
        state.Error ||
        state.Status === "created" ||
        ([125, 126, 127].includes(exit) && state.ExitCode === 0)
      )
        throw new InfrastructureError("Sandbox failed to start");
      const elapsed =
        (Date.parse(state.FinishedAt) - Date.parse(state.StartedAt)) / 1000;
      timedOut ||=
        elapsed > wallSeconds ||
        ([137, 142, 152].includes(state.ExitCode) && !state.OOMKilled);
      if (multilang && state.ExitCode === 88)
        throw new InfrastructureError(
          "A required runtime is unavailable inside the sandbox",
        );
      const mle = state.OOMKilled || state.ExitCode === 86;
      return {
        compileFailed: multilang && state.ExitCode === 87,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: state.ExitCode,
        timedOut,
        mle,
        overflow,
        crashed: state.ExitCode !== 0,
      };
    } finally {
      clearTimeout(timer);
      const cleanup = await command(this.docker, ["rm", "--force", name]);
      if (
        cleanup.code !== 0 &&
        !/No such container/i.test(cleanup.stderr.toString())
      )
        throw new InfrastructureError("Container cleanup failed");
    }
  }
}

// Explicit scripted test double: never executes code, never accepted by official preflight.
export class MockSandbox {
  kind = "mock";
  constructor(handler) {
    this.handler = handler;
    this.calls = [];
  }
  async run(code, input, options) {
    this.calls.push({ code, input, options });
    return {
      stdout: Buffer.alloc(0),
      stderr: "",
      exitCode: 0,
      timedOut: false,
      mle: false,
      overflow: false,
      crashed: false,
      ...(await this.handler(code, input, options)),
    };
  }
}
