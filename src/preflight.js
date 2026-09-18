import { PROTOCOL as CURRENT_PROTOCOL } from "./protocol.js";
import {
  verifyRuntimeValidation,
  prerequisiteBinding,
  verifyPrerequisite,
} from "./prerequisites.js";
import { verifyAnalysisPlan } from "./analysis-plan.js";
import { validateIndependence } from "./independence.js";
import { protocolBinding, currentProtocol } from "./protocol.js";
import { assert, validateConfig, validateProblem, sha256 } from "./domain.js";
import { configIdentity } from "./llm.js";
import { corpusIdentity } from "./corpus.js";
import { verifyBaseline } from "./baseline.js";
export function officialPreflight({
  config,
  problems,
  evidence,
  baseline,
  sandbox,
  gitCommit,
}) {
  const failures = [];
  const binding = prerequisiteBinding({
    git_commit: gitCommit,
    corpus_id: corpusIdentity(problems),
    config_id: configIdentity(config),
    image_id: sandbox.imageId,
    runtime_validation_id: evidence.runtimeValidation?.sha,
  });
  const check = (name, fn) => {
    try {
      fn();
    } catch (e) {
      failures.push(`${name}: ${e.message}`);
    }
  };
  check("protocol", () =>
    assert(
      currentProtocol(evidence),
      "Evidence must bind to the current protocol",
    ),
  );
  check("configuration", () => validateConfig(config, true));
  check("corpus", () => {
    assert(
      problems.length === CURRENT_PROTOCOL.population.problems &&
        ["A", "B", "C"].every(
          (d) =>
            problems.filter((p) => p.division === d).length ===
            CURRENT_PROTOCOL.population.perDivision,
        ),
      "30 problems: 10 per division",
    );
    validateIndependence(problems);
    problems.forEach((p) =>
      validateProblem(p, {
        official: true,
        allowRuntimeError: config.allowRuntimeError === true,
      }),
    );
  });
  check("sandbox", () => {
    assert(
      sandbox.kind === "docker" &&
        /^sha256:[a-f0-9]{64}$/.test(sandbox.imageId),
      "Verified Docker image ID required",
    );
    assert(
      verifyRuntimeValidation(evidence.runtimeValidation, binding) ===
        binding.runtime_validation_id,
      "Sandbox integration evidence for current image required",
    );
  });
  check("analysis-plan", () =>
    verifyAnalysisPlan(evidence.analysisPlan, binding),
  );
  for (const key of ["baseline", "pilot", "compatibility", "privacyReview"])
    check(key + "-binding", () => verifyPrerequisite(evidence[key], binding));
  check("compatibility", () => {
    assert(
      evidence.compatibility?.config_id === configIdentity(config),
      "Compatibility call must match exact configuration",
    );
    assert(
      evidence.compatibility?.model === config.model &&
        evidence.compatibility?.nonempty === true &&
        evidence.compatibility?.longPrompt === true,
      "Concrete snapshot and long-prompt compatibility call required",
    );
  });
  check("quality", () => {
    assert(
      evidence.quality?.corpus_id === corpusIdentity(problems),
      "Quality audit missing/stale",
    );
    assert(
      evidence.quality?.problems?.length ===
        CURRENT_PROTOCOL.population.problems,
      "Thirty problem audits required",
    );
    for (const p of problems) {
      const q = evidence.quality.problems.find((q) => q.problem_id === p.id);
      assert(
        q?.referenceSamplesAgree &&
          q.validator.valid >= 2 &&
          q.validator.invalid >= 2 &&
          q.rejected.length === 0,
        "Validator/reference/sample audit incomplete",
      );
      assert(
        q.accepted.length ===
          CURRENT_PROTOCOL.population.devPerProblem +
            CURRENT_PROTOCOL.population.heldOutPerProblem &&
          [...p.dev, ...p.heldOut].every((s) =>
            q.accepted.some(
              (a) =>
                a.id === s.id &&
                a.hash === sha256(s.code) &&
                a.samplePassed === true,
            ),
          ),
        "Every target must pass samples with source hash evidence",
      );
    }
  });
  check("baseline", () => {
    verifyBaseline(baseline, problems);
    assert(
      evidence.baseline?.sha === baseline.sha &&
        evidence.baseline?.completed === true &&
        evidence.baseline?.log_digest,
      "Completed frozen baseline evidence required",
    );
  });
  check("operator", () => {
    assert(
      evidence.accountUsageLimitConfigured === true,
      "Operator must configure provider account usage limit",
    );
    assert(
      evidence.pricing?.verified === true &&
        evidence.pricing?.config_id === configIdentity(config) &&
        evidence.pricing?.source &&
        evidence.pricing?.verified_at,
      "Pricing verification for current configuration required",
    );
    assert(
      evidence.pilot?.pairs >= CURRENT_PROTOCOL.population.pilotMinimum &&
        evidence.pilot?.manuallyReviewed === true &&
        evidence.pilot?.corpus_id === corpusIdentity(problems) &&
        evidence.pilot?.logs,
      "Twenty-pair pilot and manual log review required",
    );
    assert(
      evidence.privacyReview?.passed === true &&
        evidence.privacyReview?.git_commit === gitCommit,
      "Privacy review must match code revision",
    );
  });
  check("revision", () =>
    assert(
      /^[a-f0-9]{40}$/.test(gitCommit),
      "Record a real Git commit before official run",
    ),
  );
  return {
    ...binding,
    analysis_plan_sha: evidence.analysisPlan?.sha,
    ok: failures.length === 0,
    failures,
    checked_at: new Date().toISOString(),
    corpus_id: corpusIdentity(problems),
    config_id: configIdentity(config),
  };
}
