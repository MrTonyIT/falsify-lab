import { Verdict as V, LIMITS, assert } from "./domain.js";
import { assessOracle } from "./oracle.js";
import { checkerFor } from "./checkers.js";
const failure = (r) => r.crashed || r.timedOut || r.mle || r.overflow;
export class Evaluator {
  constructor(sandbox, { onEvent = async () => {} } = {}) {
    this.sandbox = sandbox;
    this.onEvent = onEvent;
    this.executions = 0;
  }
  async run(...args) {
    this.executions++;
    return this.sandbox.run(...args);
  }
  async generate(script) {
    if (!script) return { error: "missing_generator" };
    await this.onEvent("generator_running", {});
    const result = await this.run(script, Buffer.alloc(0), {
      role: "generator",
      seconds: LIMITS.generatorSeconds,
      maxBytes: LIMITS.inputBytes,
    });
    await this.onEvent("generator_finished", {
      ok: !failure(result),
      bytes: result.stdout.length,
    });
    if (failure(result) || result.stdout.length > LIMITS.inputBytes)
      return {
        error: result.overflow
          ? "generator_output_limit"
          : result.timedOut
            ? "generator_timeout"
            : "generator_failed",
      };
    return { data: result.stdout };
  }
  async prepare(problem, data, { audit = false } = {}) {
    assert(Buffer.isBuffer(data), "Input must be bytes");
    assert(data.length <= LIMITS.inputBytes, "Input limit exceeded");
    const checker = checkerFor(problem.checkerName);
    const oracle = assessOracle(problem);
    if (!audit && !oracle.trusted)
      return {
        verdict: V.UNUSABLE,
        detail: "unverified_oracle",
        data,
        semanticSize: null,
        oracle,
      };
    await this.onEvent("validation_started", {});
    const validation = await problem.validator(data);
    await this.onEvent(
      validation.ok ? "validation_passed" : "validation_failed",
      {},
    );
    if (!validation.ok)
      return {
        verdict: V.INVALID_INPUT,
        detail: "validator_rejected",
        data,
        semanticSize: null,
      };
    assert(
      validation.semanticSize == null ||
        (Number.isFinite(validation.semanticSize) &&
          validation.semanticSize >= 0),
      "Invalid semantic size",
    );
    assert(
      problem.references.length === 3 &&
        new Set(problem.references.map((r) => r.author)).size === 3,
      "Three independent reference authors required",
    );
    const refs = [];
    await this.onEvent("references_started", {});
    for (const reference of problem.references)
      refs.push(
        await this.run(reference.code, data, {
          role: "reference",
          seconds: LIMITS.runSeconds,
        }),
      );
    if (refs.some(failure)) {
      await this.onEvent("references_failed", {});
      return {
        verdict: V.UNUSABLE,
        detail: "reference_failure",
        data,
        semanticSize: validation.semanticSize ?? null,
      };
    }
    if (
      !checker(refs[0].stdout, refs[0].stdout) ||
      !refs.slice(1).every((r) => checker(refs[0].stdout, r.stdout))
    ) {
      await this.onEvent("references_disagreed", {});
      return {
        verdict: V.UNUSABLE,
        detail: "reference_disagreement",
        data,
        semanticSize: validation.semanticSize ?? null,
      };
    }
    if (problem.exactOracle) {
      const exact = await problem.exactOracle(data);
      if (
        exact?.applicable &&
        (!Buffer.isBuffer(exact.output) ||
          !checker(exact.output, refs[0].stdout))
      )
        return {
          verdict: V.UNUSABLE,
          detail: "exact_oracle_disagreement",
          data,
          semanticSize: validation.semanticSize ?? null,
        };
    }
    await this.onEvent("references_agreed", {});
    return {
      data,
      expected: refs[0].stdout,
      semanticSize: validation.semanticSize ?? null,
      oracle,
    };
  }
  async judge(problem, target, prepared) {
    if (prepared.verdict) return prepared;
    if (!prepared.oracle?.trusted)
      return { ...prepared, verdict: V.UNUSABLE, detail: "unverified_oracle" };
    await this.onEvent("target_started", {});
    const got = await this.run(target.code, prepared.data, {
      role: "target",
      seconds: LIMITS.runSeconds,
      language: target.language ?? "python",
    });
    if (got.compileFailed) {
      const error = new Error(
        "Target compilation failed. Fix the source before testing.",
      );
      error.code = "COMPILE_FAILED";
      error.diagnostics = got.stderr;
      throw error;
    }
    await this.onEvent("target_finished", {
      crashed: got.crashed,
      timedOut: got.timedOut,
      mle: got.mle,
    });
    await this.onEvent("checker_started", {});
    let verdict, detail;
    if (got.timedOut || got.mle || got.overflow) {
      verdict = V.INCONCLUSIVE;
      detail = "target_resource_limit";
    } else if (got.crashed) {
      verdict = V.INCONCLUSIVE;
      detail = "target_runtime_failure";
    } else if (
      !checkerFor(problem.checkerName)(prepared.expected, got.stdout)
    ) {
      verdict = V.KILL;
      detail = "wrong_answer";
    } else {
      verdict = V.SURVIVED;
      detail = "correct_on_candidate";
    }
    return { ...prepared, verdict, detail, got: got.stdout };
  }
  async evaluate(problem, target, script) {
    const gen = await this.generate(script);
    if (gen.error)
      return {
        verdict: V.GEN_FAILED,
        detail: gen.error,
        data: Buffer.alloc(0),
        semanticSize: null,
      };
    return this.judge(problem, target, await this.prepare(problem, gen.data));
  }
}
