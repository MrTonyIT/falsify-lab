import {
  mkdir,
  stat,
  readdir,
  readFile,
  writeFile,
  appendFile,
  rename,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { languages, languageFor } from "../src/languages.js";
import { runPair } from "../src/falsify.js";
import { Evaluator } from "../src/evaluator.js";
import { DockerSandbox, MockSandbox } from "../src/sandbox.js";
import { HttpLLM, MockLLM, persistentBudget } from "../src/llm.js";
import { JsonlLog, readJsonl } from "../src/logging.js";
import { metadataFor } from "../src/workflow.js";
import { loadCorpus } from "../src/corpus.js";
import { analyzeAsync } from "./analysis.js";
import { tokenChecker } from "../src/checkers.js";
import { encodeHistory, decodeHistory } from "./history.js";
import { PROTOCOL_VERSION } from "../src/protocol.js";
import { assessOracle } from "../src/oracle.js";
import { sealEvidence, inspectEvidence } from "../src/evidence.js";
import { assert, sha256, validateConfig, LIMITS } from "../src/domain.js";
import { smokeProblem } from "../fixtures/sum-problem.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const demoProblem = smokeProblem();
export const examples = [
  {
    id: "signed-sum",
    name: "The missing minus sign",
    tag: "LOGIC BUG",
    statement: demoProblem.statement,
    constraints: demoProblem.constraints,
    code: demoProblem.dev[0].code,
  },
  {
    id: "sum-survivor",
    name: "A sum that survives",
    tag: "NO KILL",
    statement: demoProblem.statement,
    constraints: demoProblem.constraints,
    code: demoProblem.references[0].code,
  },
];
const generatorScripts = [
  'print("1\\n2\\n1 2")',
  'print("1\\n1\\n-1")',
  'print("1\\n2\\n-3 2")',
];
const generatorInputs = ["1\n2\n1 2\n", "1\n1\n-1\n", "1\n2\n-3 2\n"];
const text = (value, max = 65536) =>
  Buffer.from(value ?? "")
    .toString("utf8")
    .slice(0, max);

export class LabService {
  constructor({ root, configPath, corpusPath, demoDelay = 160 } = {}) {
    this.root = root;
    this.configPath = configPath;
    this.corpusPath = corpusPath;
    this.demoDelay = demoDelay;
    this.jobs = new Map();
    this.listeners = new Map();
    this.active = null;
    this.config = null;
    this.configError = null;
    this.problems = [];
    this.sandbox = new DockerSandbox();
    this.multilang = new DockerSandbox({
      image:
        process.env.FALSIFIER_MULTILANG_IMAGE || "ai-falsifier-multilang:local",
    });
  }
  async init() {
    await mkdir(this.root, { recursive: true });
    if (this.configPath)
      try {
        this.config = validateConfig(
          JSON.parse(await readFile(this.configPath, "utf8")),
        );
        this.sandbox = new DockerSandbox({ image: this.config.sandboxImage });
        this.budget = persistentBudget(this.config, this.root);
      } catch {
        this.config = null;
        this.configError =
          "The model configuration file could not be loaded or validated.";
      }
    if (this.corpusPath)
      try {
        this.problems = await loadCorpus(this.corpusPath);
      } catch {
        this.corpusError =
          "The corpus could not be loaded. Check its manifest and validators.";
      }
    for (const dir of await readdir(this.root, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      try {
        if (!/^lab-[a-f0-9-]{12}$/.test(dir.name)) continue;
        if (
          (await stat(join(this.root, dir.name, "web.json"))).size >
          4 * 1024 * 1024
        )
          throw Error("History too large");
        const bytes = await readFile(
          join(this.root, dir.name, "web.json"),
          "utf8",
        );
        if (bytes.length > 4 * 1024 * 1024) throw Error("History is too large");
        const job = decodeHistory(JSON.parse(bytes), dir.name);
        if (job.status === "running" || job.status === "queued") {
          job.status = "error";
          job.error =
            "The server restarted before this run completed. Start a new run; no calls are automatically repeated.";
          job.events.push({
            id: job.events.length + 1,
            type: "job_failed",
            error: job.error,
            at: new Date().toISOString(),
          });
        }
        this.jobs.set(job.id, job);
      } catch (e) {
        if (e.code !== "ENOENT")
          this.storageWarning = "A saved web run could not be read.";
      }
    }
  }
  async status() {
    let sandbox;
    try {
      sandbox = { status: "available", ...(await this.sandbox.check()) };
    } catch {
      sandbox = {
        status: "unavailable",
        message:
          "Linux Docker and the falsifier Python image are required for live execution.",
      };
    }
    let multiAvailable = false;
    try {
      await this.multilang.check();
      multiAvailable = true;
    } catch {}
    return {
      protocol: PROTOCOL_VERSION,
      evidence: {
        dockerValidation: "NOT RUN",
        providerValidation: "NOT RUN",
        unseenProblems: "NOT RUN",
      },
      languages: languages.map((l) => ({
        ...l,
        status: (
          l.id === "python" ? sandbox.status === "available" : multiAvailable
        )
          ? "available"
          : "unavailable",
      })),
      api: "online",
      sandbox,
      provider: {
        status:
          this.config && process.env.FALSIFIER_API_KEY
            ? "configured"
            : "not_configured",
        model: this.config?.model ?? null,
        effort: "high",
        maxAttempts: LIMITS.attempts,
        message: this.configError,
      },
      corpus: {
        count: this.problems.length,
        target: 30,
        error: this.corpusError,
      },
      validators: this.problems.length,
      references: this.problems.reduce((n, p) => n + p.references.length, 0),
      storage: this.storageWarning ? "warning" : "available",
      activeJob: this.active,
      demo: "available",
      budget: this.budget
        ? {
            limit: this.budget.limit,
            spent: this.budget.spent,
            reserved: this.budget.reserved,
          }
        : null,
    };
  }
  problemList() {
    return this.problems.map((p) => ({
      id: p.id,
      statement: p.statement,
      constraints: p.constraints,
      division: p.division,
      dev: p.dev.map((s) => ({ id: s.id, code: s.code })),
    }));
  }
  summary(job) {
    return {
      id: job.id,
      title: job.title,
      mode: job.mode,
      language: job.language ?? "python",
      status: job.status,
      createdAt: job.createdAt,
      model: job.model,
      final: job.final,
      attempts: job.attempts.length,
      verdict: job.attempts.at(-1)?.verdict ?? null,
      elapsed_ms: job.elapsed_ms,
      cost: job.attempts.reduce((n, a) => n + a.cost_usd, 0),
      error: job.error,
    };
  }
  list() {
    return [...this.jobs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((j) => this.summary(j));
  }
  get(id) {
    const j = this.jobs.get(id);
    if (!j) throw new ApiError(404, "RUN_NOT_FOUND", "This run was not found.");
    return j;
  }
  async save(job) {
    const path = join(this.root, job.id, "web.json");
    await writeFile(path + ".tmp", JSON.stringify(encodeHistory(job)));
    await rename(path + ".tmp", path);
  }
  async emit(job, type, data = {}) {
    const event = {
      id: job.events.length + 1,
      type,
      at: new Date().toISOString(),
      attempt: job.currentAttempt ?? 0,
      ...data,
    };
    job.events.push(event);
    await appendFile(
      join(this.root, job.id, "stream.jsonl"),
      JSON.stringify(event) + "\n",
    );
    for (const send of this.listeners.get(job.id) ?? []) send(event);
    return event;
  }
  subscribe(id, callback) {
    this.get(id);
    if (!this.listeners.has(id)) this.listeners.set(id, new Set());
    this.listeners.get(id).add(callback);
    return () => this.listeners.get(id)?.delete(callback);
  }
  async start(payload) {
    if (this.starting || this.active)
      throw new ApiError(409, "RUN_ACTIVE", "A run is already active.");
    this.starting = true;
    try {
      return await this.startReserved(payload);
    } finally {
      this.starting = false;
    }
  }
  async startReserved(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new ApiError(400, "INVALID_PAYLOAD", "A JSON object is required.");
    if (this.active)
      throw new ApiError(
        409,
        "RUN_ACTIVE",
        "A run is already active. Wait for it to finish before starting another.",
      );
    if (!["demo", "playground", "benchmark"].includes(payload.mode))
      throw new ApiError(400, "INVALID_MODE", "Choose a valid run mode.");
    for (const key of ["statement", "constraints", "code"])
      if (
        typeof payload[key] !== "string" ||
        !payload[key].trim() ||
        payload[key].length > 100000
      )
        throw new ApiError(
          400,
          "INVALID_PROBLEM_FORMAT",
          "Provide a statement, constraints and source code (up to 100,000 characters each).",
        );
    let language;
    try {
      language = languageFor(payload.language).id;
    } catch {
      throw new ApiError(
        400,
        "UNSUPPORTED_LANGUAGE",
        "Select a supported programming language.",
      );
    }
    if (payload.mode !== "playground" && language !== "python")
      throw new ApiError(
        422,
        "PYTHON_PROTOCOL_ONLY",
        "Demo examples and the benchmark protocol use Python. Select Live playground for other languages.",
      );
    let problem, target, example;
    if (payload.mode === "demo") {
      example = examples.find(
        (e) =>
          e.code === payload.code &&
          e.statement === payload.statement &&
          e.constraints === payload.constraints,
      );
      if (!example)
        throw new ApiError(
          422,
          "DEMO_EXAMPLE_ONLY",
          "Demo mode supports the two bundled examples. Load an example, or select Live playground to test your own code.",
        );
      problem = smokeProblem();
      target = { ...problem.dev[0], code: example.code, origin: "synthetic" };
    } else if (payload.mode === "benchmark") {
      problem = this.problems.find((p) => p.id === payload.problemId);
      target = problem?.dev.find(
        (s) => String(s.id) === String(payload.submissionId),
      );
      if (!problem || !target)
        throw new ApiError(
          422,
          "DEV_TARGET_REQUIRED",
          "Select a DEV submission from the configured corpus.",
        );
    } else {
      const selected = this.problems.find((p) => p.id === payload.problemId);
      if (
        selected &&
        (payload.statement !== selected.statement ||
          payload.constraints !== selected.constraints)
      )
        throw new ApiError(
          422,
          "ORACLE_MISMATCH",
          "The statement must match the selected verified oracle. Use a custom oracle for a different problem.",
        );
      if (selected) problem = selected;
      else if (
        payload.oracle === "example" &&
        payload.statement === demoProblem.statement &&
        payload.constraints === demoProblem.constraints
      )
        problem = smokeProblem();
      else {
        if (
          typeof payload.validator !== "string" ||
          !payload.validator.trim() ||
          payload.validator.length > 100000 ||
          !Array.isArray(payload.references) ||
          payload.references.length !== 3 ||
          payload.references.some(
            (r) => typeof r !== "string" || !r.trim() || r.length > 100000,
          ) ||
          new Set(payload.references).size !== 3
        )
          throw new ApiError(
            422,
            "ORACLE_REQUIRED",
            "A custom problem needs a Python input validator and three distinct reference solutions. Expand Verification setup to add them.",
          );
        problem = {
          ...smokeProblem(),
          oracleKind: "unverified",
          oracleReview: null,
          exactOracle: null,
          id: "custom-" + randomUUID().slice(0, 8),
          statement: payload.statement,
          constraints: payload.constraints,
          references: payload.references.map((code, i) => ({
            id: "custom-ref-" + i,
            author: "user-reference-" + i,
            verdict: "UNVERIFIED",
            code,
          })),
          validator: async (data) => {
            const r = await this.sandbox.run(payload.validator, data, {
              role: "validator",
              seconds: LIMITS.runSeconds,
            });
            if (r.timedOut || r.mle || r.overflow)
              throw new Error(
                "The custom validator exceeded its resource limits.",
              );
            return { ok: !r.crashed && r.exitCode === 0 };
          },
        };
      }
      target = {
        id: "custom",
        split: "dev",
        code: payload.code,
        language,
        origin: "custom",
        passedTestCount: 0,
      };
    }
    if (!assessOracle(problem).trusted)
      throw new ApiError(
        422,
        "ORACLE_UNVERIFIED",
        "Three pasted references are not reviewed evidence. Configure a hash-bound reviewed corpus oracle before live evaluation.",
      );
    if (payload.mode !== "demo") {
      const status = await this.status();
      if (status.provider.status !== "configured")
        throw new ApiError(
          503,
          "MODEL_NOT_CONFIGURED",
          "Live generation needs a configured model provider. Open System for setup. Demo mode is ready now.",
        );
      if (status.sandbox.status !== "available")
        throw new ApiError(503, "SANDBOX_UNAVAILABLE", status.sandbox.message);
      if (
        language !== "python" &&
        status.languages.find((l) => l.id === language)?.status !== "available"
      )
        throw new ApiError(
          503,
          "LANGUAGE_RUNTIME_UNAVAILABLE",
          "Build the multi-language sandbox image before testing this language. See System.",
        );
      if (payload.allowPaid !== true)
        throw new ApiError(
          422,
          "PAID_RUN_NOT_ENABLED",
          "Enable paid model calls in the run configuration before starting a live run.",
        );
    }
    // Claim the single execution slot after async health checks too.
    if (this.active)
      throw new ApiError(409, "RUN_ACTIVE", "Another run has just started.");
    const id = "lab-" + randomUUID().slice(0, 12);
    const job = {
      id,
      title:
        example?.name ??
        (payload.mode === "benchmark"
          ? problem.id
          : "Custom counterexample search"),
      mode: payload.mode,
      language,
      model:
        payload.mode === "demo"
          ? "Scripted fixture provider"
          : this.config.model,
      status: "queued",
      createdAt: new Date().toISOString(),
      attempts: [],
      events: [],
      currentAttempt: 0,
      knownWrong: payload.mode === "benchmark",
      elapsed_ms: 0,
    };
    await mkdir(join(this.root, id), { recursive: true });
    this.active = id;
    this.jobs.set(id, job);
    try {
      await this.save(job);
    } catch (e) {
      this.active = null;
      this.jobs.delete(id);
      throw e;
    }
    setImmediate(() =>
      this.execute(job, problem, target).catch(async () => {
        job.status = "error";
        job.error =
          "Results could not be persisted. Check storage permissions.";
        this.active = null;
        for (const cb of this.listeners.get(id) ?? [])
          cb({
            id: job.events.length + 1,
            type: "job_failed",
            error: job.error,
            at: new Date().toISOString(),
          });
      }),
    );
    return this.summary(job);
  }
  async execute(job, problem, target) {
    const started = Date.now();
    job.status = "running";
    const config =
      job.mode === "demo"
        ? {
            model: "scripted-demo",
            reasoningEffort: "high",
            maxCompletionTokens: LIMITS.maxCompletionTokens,
            pricing: { input: 0, output: 0, cachedInput: 0 },
          }
        : this.config;
    const metadata = {
      ...metadataFor([problem], config, job.mode),
      run_id: job.id,
    };
    const log = new JsonlLog(join(this.root, job.id));
    await log.initialize(metadata);
    const observer = async (type, data) => {
      if (type === "attempt_started") job.currentAttempt = data.attempt;
      await this.emit(job, type, data);
      if (
        job.mode === "demo" &&
        !["attempt_finished", "generator_created"].includes(type)
      )
        await pause(this.demoDelay);
    };
    try {
      await this.emit(job, "job_started", { mode: job.mode });
      await log.append("events", { ...metadata, event: "run_started" });
      const sandbox =
        job.mode === "demo"
          ? new MockSandbox((code, input, options) => {
              if (options.role === "generator") {
                const i = generatorScripts.indexOf(code);
                assert(i >= 0, "Unknown demo generator");
                return { stdout: Buffer.from(generatorInputs[i]) };
              }
              const allowed = [
                ...problem.references.map((r) => r.code),
                target.code,
              ];
              assert(allowed.includes(code), "Unknown demo source");
              const values = input
                .toString()
                .trim()
                .split("\n")[2]
                .split(" ")
                .map(Number);
              const sum = values.reduce(
                (n, v) =>
                  n +
                  (options.role === "target" && target.code === examples[0].code
                    ? Math.abs(v)
                    : v),
                0,
              );
              return { stdout: Buffer.from(sum + "\n") };
            })
          : {
              kind: "docker",
              run: (code, input, options) => {
                const multi =
                  options.role === "target" &&
                  languageFor(options.language).id !== "python";
                return (multi ? this.multilang : this.sandbox).run(
                  code,
                  input,
                  { ...options, multilang: multi },
                );
              },
            };
      // Check compiled source before spending tokens. Compiler output is never a counterexample.
      if (job.mode === "playground") {
        await this.emit(job, "compilation_started", {});
        const checked =
          job.language === "python"
            ? await this.sandbox.run(
                "compile(bytes.fromhex('" +
                  Buffer.from(target.code, "utf8").toString("hex") +
                  "').decode('utf-8'), '<submission>', 'exec')",
                Buffer.alloc(0),
                { role: "syntax-check", seconds: LIMITS.syntaxSeconds },
              )
            : await this.multilang.run(target.code, Buffer.alloc(0), {
                language: job.language,
                multilang: true,
                prepareOnly: true,
                seconds: LIMITS.prepareSeconds,
              });
        if (checked.timedOut || checked.mle || checked.overflow) {
          const error = new Error(
            "Compilation preflight exceeded sandbox resource limits; no model call was made.",
          );
          error.code = "SANDBOX_RESOURCE_LIMIT";
          throw error;
        }
        if (
          checked.compileFailed ||
          checked.crashed ||
          checked.timedOut ||
          checked.mle ||
          checked.overflow
        ) {
          const error = new Error(
            "Compilation failed or exceeded sandbox limits.",
          );
          error.code = "COMPILE_FAILED";
          error.diagnostics = checked.stderr;
          throw error;
        }
        await this.emit(job, "compilation_finished", {});
      }
      const llm =
        job.mode === "demo"
          ? new MockLLM(
              generatorScripts.map((s) => "```python\n" + s + "\n```"),
            )
          : new HttpLLM(config, { budget: this.budget });
      const evaluator = new Evaluator(sandbox, { onEvent: observer });
      job.final = await runPair({
        problem,
        target,
        evaluator,
        llm,
        log,
        metadata,
        method: job.mode === "demo" ? "demo" : "ai",
        knownWrong: job.knownWrong,
        onEvent: observer,
        onEvaluation: async (evaluation, record) => {
          const view = {
            ...record,
            input: text(evaluation.data),
            expected: text(evaluation.expected),
            actual: text(evaluation.got),
            input_truncated: evaluation.data.length > 65536,
            outputs_truncated:
              (evaluation.expected?.length ?? 0) > 65536 ||
              (evaluation.got?.length ?? 0) > 65536,
          };
          job.attempts.push(view);
          await this.save(job);
          await this.emit(job, "attempt_result", { result: view });
        },
      });
      job.status = "finished";
      job.elapsed_ms = Date.now() - started;
      await log.append("events", { run_id: job.id, event: "run_complete" });
      await sealEvidence(log.directory);
      await this.emit(job, "job_finished", {
        final: job.final,
        elapsed_ms: job.elapsed_ms,
      });
    } catch (error) {
      job.status = "error";
      job.elapsed_ms = Date.now() - started;
      job.error =
        error.code === "SANDBOX_RESOURCE_LIMIT"
          ? error.message
          : error.code === "COMPILE_FAILED"
            ? "Compilation failed. Fix your source code before testing."
            : job.mode === "demo"
              ? "The demonstration could not complete. Please start a new run."
              : "Execution stopped. Check the model configuration, budget and sandbox in System.";
      if (error.code === "COMPILE_FAILED")
        job.diagnostics = String(error.diagnostics ?? "").slice(0, 4096);
      await log.append("events", {
        run_id: job.id,
        event: "web_job_failed",
        message: error.message,
      });
      await this.emit(job, "job_failed", {
        error: job.error,
        diagnostics: job.diagnostics,
      });
    } finally {
      await this.save(job);
      this.active = null;
    }
  }
  async data() {
    if (this.dataCache && Date.now() - this.dataCache.at < 5000)
      return this.dataCache.value;
    if (this.dataPending) return this.dataPending;
    this.dataPending = this.readData();
    try {
      const value = await this.dataPending;
      this.dataCache = { at: Date.now(), value };
      return value;
    } finally {
      this.dataPending = null;
    }
  }
  async readData() {
    const runs = [],
      suites = [];
    // Bound interactive work; full CLI reports still use complete JSONL.
    const directories = (await readdir(this.root, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && d.name !== "budgets")
      .sort((a, b) => b.name.localeCompare(a.name));
    const warnings = [];
    for (const dir of directories.slice(0, 100)) {
      try {
        if (!dir.isDirectory()) continue;
        const path = join(this.root, dir.name);
        const [attempts, finals, events, track2] = await Promise.all(
          ["attempts", "finals", "events", "track2"].map((name) =>
            readJsonl(join(path, name + ".jsonl")),
          ),
        );
        if (!finals.length && !track2.length) continue;
        const meta = events.find((e) => e.event === "run_started") ?? {};
        const evidence = await inspectEvidence(path);
        const official = evidence.official;
        runs.push({
          id: dir.name,
          kind: meta.kind ?? "development",
          corpusId: meta.corpus_id,
          evidenceStatus: evidence.status,
          baselineSha: meta.baseline_sha,
          requiredBaselineSha: meta.preflight?.baseline_sha,
          official,
          attempts: attempts.map(
            ({ attempt, cost_usd, semantic_size, input_size, verdict }) => ({
              attempt,
              cost_usd,
              semantic_size,
              input_size,
              verdict,
            }),
          ),
          finals: finals.map(
            ({ attempts_used, killed, min_input_size, semantic_size }) => ({
              attempts_used,
              killed,
              min_input_size,
              semantic_size,
            }),
          ),
          analysis: await analyzeAsync(finals, attempts),
        });
        for (const e of track2.filter((e) => e.suite)) {
          const held = track2.find((h) => h.suite_sha === e.suite.sha);
          suites.push({
            runId: dir.name,
            official,
            problemId: e.suite.problem_id,
            matrix: e.matrix,
            selection: e.suite.selection,
            evidenceStatus: evidence.status,
            suiteHash: e.suite.sha,
            tests: e.suite.tests.map(({ id, input_sha }) => ({
              id,
              input_sha,
            })),
            heldOut:
              evidence.status === "VERIFIED" || evidence.status === "DEMO"
                ? (held ?? null)
                : null,
          });
        }
      } catch {
        warnings.push({
          directory: dir.name,
          message:
            "Evidence could not be safely loaded; use the CLI to inspect this artifact.",
        });
      }
    }
    return {
      browsingLimit: 100,
      truncated: directories.length > 100,
      warnings,
      officialStatus: runs.some((r) => r.official) ? "MEASURED" : "NOT RUN",
      runs,
      suites,
    };
  }
}
