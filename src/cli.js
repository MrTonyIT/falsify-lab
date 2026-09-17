import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, sha256 } from "./domain.js";
import { loadCorpus, publicManifest } from "./corpus.js";
import { DockerSandbox } from "./sandbox.js";
import { Evaluator } from "./evaluator.js";
import { HttpLLM, configIdentity } from "./llm.js";
import { officialPreflight } from "./preflight.js";
import { smoke } from "./smoke.js";
import { report } from "./report.js";
import {
  gitCommit,
  sourceClean,
  metadataFor,
  initializeRun,
  auditCorpus,
  baselineWorkflow,
  track1,
  track2,
} from "./workflow.js";
import { CodeforcesClient } from "./acquisition.js";
import { readJsonl } from "./logging.js";
import {
  generateBlackbox,
  buildKillMatrix,
  freezeSuite,
  evaluateHeldOut,
} from "./track2.js";
import { inspectEvidence, sealEvidence } from "./evidence.js";
import { digest } from "./protocol.js";
import { applyContamination } from "./contamination.js";
const help = `AI Falsifier (Node >=22; real execution requires Linux Docker)
  node src/cli.js smoke --out results/smoke-unique
  node src/cli.js report --out results/run [--labels private/labels.json]
  node src/cli.js fetch --contest 1850 --index B --out private/1850B [--pages 2]
  node src/cli.js audit --corpus private/corpus.json --out private/quality.json
  node src/cli.js baseline --corpus private/corpus.json --config config/local.json --out results/random
  node src/cli.js compatibility --config config/local.json --out private/compatibility.json --execute-paid
  node src/cli.js preflight --corpus private/corpus.json --config config/local.json --evidence private/evidence.json --baseline results/random/baseline.json
  node src/cli.js pilot --corpus ... --config ... --out results/pilot --execute-paid
  node src/cli.js official --corpus ... --config ... --evidence ... --baseline ... --out results/official --execute-paid
  node src/cli.js blackbox --corpus ... --config ... --out results/blackbox --k 3 --execute-paid
  node src/cli.js public-manifest --corpus private/corpus.json --out public-corpus.json
Existing run directories are never overwritten. No automatic API retries.`;
export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv,
    options = {};
  for (let i = 0; i < rest.length; i++) {
    assert(rest[i].startsWith("--"), "Expected named option");
    const key = rest[i].slice(2);
    options[key] =
      rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  }
  const json = async (path) => {
    assert(typeof path === "string", "Required JSON path missing");
    return JSON.parse(await readFile(path, "utf8"));
  };
  const out = resolve(options.out ?? "results");
  if (!cmd || cmd === "help") {
    console.log(help);
    return;
  }
  if (cmd === "smoke") {
    await smoke(out);
    console.log("Mock smoke passed. Official benchmark: NOT RUN. " + out);
    return;
  }
  if (cmd === "report") {
    await mkdir(out, { recursive: true });
    const result = await report(out, {
      labels: options.labels ? await json(options.labels) : [],
      comparisonDirectories: options["baseline-results"]
        ? [options["baseline-results"]]
        : [],
    });
    console.log(
      `Official benchmark: ${result.official_status}. ${join(out, "report.html")}`,
    );
    return;
  }
  if (cmd === "fetch") {
    const contest = Number(options.contest),
      index = options.index;
    const client = new CodeforcesClient(join(out, "cache"));
    const submissions = await client.submissions(contest, index, {
        pages: Number(options.pages ?? 1),
      }),
      problem = await client.problem(contest, index);
    await mkdir(join(out, "sources"), { recursive: true });
    for (const s of submissions) {
      const code = await client.source(contest, s.id);
      await writeFile(join(out, "sources", s.id + ".py"), code);
      s.sha256 = sha256(code);
    }
    await writeFile(
      join(out, "metadata.json"),
      JSON.stringify(
        {
          submissions,
          samples: problem.samples,
          statementReviewRequired: true,
        },
        null,
        2,
      ),
    );
    await writeFile(join(out, "problem.html"), problem.html);
    console.log(
      "Private raw corpus fetched. Manual statement/constraints, eligibility, validators and sample audit still required.",
    );
    return;
  }
  const config = options.config
    ? await json(options.config)
    : { sandboxImage: "ai-falsifier-python:local" };
  if (cmd === "compatibility") {
    assert(
      options["execute-paid"] === true,
      "Compatibility call requires --execute-paid",
    );
    const llm = new HttpLLM(config),
      prompt =
        "Return exactly one Python code block printing 1.\n" +
        "Public compatibility test. ".repeat(500);
    const response = await llm.call(prompt);
    const evidence = {
      config_id: configIdentity(config),
      model: response.providerModel,
      nonempty: !!response.text.trim(),
      longPrompt: true,
      tested_at: new Date().toISOString(),
      tokens_in: response.tokensIn,
      tokens_out: response.tokensOut,
      cost_usd: response.costUsd,
      finish_reason: response.finishReason,
    };
    await writeFile(out, JSON.stringify(evidence, null, 2), { flag: "wx" });
    console.log(
      "Compatibility evidence written; verify provider snapshot and parameter support.",
    );
    return;
  }
  const problems = await loadCorpus(options.corpus, {
    official: ["preflight", "official"].includes(cmd),
    allowRuntimeError: config.allowRuntimeError === true,
  });
  const cutoff = applyContamination(
    problems,
    options.cutoff ? await json(options.cutoff) : null,
    config.model,
  );
  if (cmd === "public-manifest") {
    await publicManifest(problems, out);
    return;
  }
  const sandbox = new DockerSandbox({ image: config.sandboxImage }),
    sandboxInfo = await sandbox.check(),
    evaluator = new Evaluator(sandbox);
  if (cmd === "audit") {
    await writeFile(
      out,
      JSON.stringify(await auditCorpus(problems, evaluator), null, 2),
      { flag: "wx" },
    );
    return;
  }
  if (cmd === "baseline") {
    const result = await baselineWorkflow({
      problems,
      evaluator,
      directory: out,
      config,
    });
    await writeFile(
      join(out, "evidence.json"),
      JSON.stringify(
        { quality: result.quality, baseline: result.baseline },
        null,
        2,
      ),
    );
    await report(out);
    return;
  }
  let preflight = null;
  if (["preflight", "official"].includes(cmd)) {
    assert(
      sourceClean(),
      "Official preflight requires a clean committed worktree",
    );
    const evidence = await json(options.evidence),
      baseline = await json(options.baseline);
    // Check baseline completion against actual JSONL, not only an attestation.
    const baselineDirectory = evidence.baseline?.directory;
    assert(baselineDirectory, "Baseline log directory required");
    assert(
      sha256(await readFile(join(baselineDirectory, "attempts.jsonl"))) ===
        evidence.baseline.log_digest,
      "Baseline log digest mismatch",
    );
    const baselineStatus = await inspectEvidence(baselineDirectory);
    assert(
      baselineStatus.status === "VERIFIED" &&
        baselineStatus.metadata.kind === "baseline" &&
        baselineStatus.metadata.corpus_id === evidence.quality.corpus_id,
      "Baseline evidence integrity failed",
    );
    const actualFrozen = await json(join(baselineDirectory, "baseline.json"));
    assert(
      actualFrozen.sha === baseline.sha,
      "Selected baseline differs from completed baseline",
    );
    const pilotStatus = await inspectEvidence(evidence.pilot?.logs);
    assert(
      pilotStatus.status === "VERIFIED" &&
        pilotStatus.metadata.kind === "pilot" &&
        pilotStatus.metadata.corpus_id === evidence.pilot.corpus_id &&
        pilotStatus.metadata.config_id === configIdentity(config),
      "Pilot evidence integrity failed",
    );
    const pilotFinals = await readJsonl(
      join(evidence.pilot.logs, "finals.jsonl"),
    );
    assert(pilotFinals.length >= 20, "Pilot requires twenty completed pairs");
    const pilotAttempts = await readJsonl(
      join(evidence.pilot.logs, "attempts.jsonl"),
    );
    assert(
      pilotAttempts.every(
        (a) =>
          a.execution_kind === "docker" &&
          a.oracle_kind === "reviewed" &&
          a.provider_kind === "live" &&
          a.provider_model === config.model,
      ),
      "Pilot cannot use mocks, unverified oracles or a different provider model",
    );
    const finals = await readJsonl(join(baselineDirectory, "finals.jsonl")),
      attempts = await readJsonl(join(baselineDirectory, "attempts.jsonl"));
    assert(
      attempts.every(
        (a) => a.execution_kind === "docker" && a.oracle_kind === "reviewed",
      ),
      "Real reviewed baseline execution required",
    );
    assert(
      finals.length === 900,
      "Both baseline budgets must finish all 450 DEV pairs",
    );
    for (const p of problems)
      for (const s of p.dev)
        for (const method of ["random3", "random50"]) {
          const f = finals.filter(
            (f) =>
              f.problem_id === p.id &&
              f.submission_id === s.id &&
              f.method === method,
          );
          assert(f.length === 1, "Baseline pair missing or duplicated");
          const a = attempts.filter(
            (a) =>
              a.problem_id === p.id &&
              a.submission_id === s.id &&
              a.method === method,
          );
          assert(
            a.length === f[0].attempts_used &&
              a.every(
                (a) =>
                  a.sub_hash === sha256(s.code) &&
                  !["invalid", "gen_failed"].includes(a.verdict),
              ),
            "Baseline generator invalid or attempt evidence incomplete",
          );
        }
    const check = officialPreflight({
      config,
      problems,
      evidence,
      baseline,
      sandbox: sandboxInfo,
      gitCommit: gitCommit(),
    });
    console.log(JSON.stringify(check, null, 2));
    assert(check.ok, "Official prerequisites missing");
    preflight = {
      ...check,
      evidence_digest: digest(evidence),
      baseline_sha: baseline.sha,
    };
    if (cmd === "preflight") return;
  }
  assert(["pilot", "official", "blackbox"].includes(cmd), "Unknown command");
  assert(
    options["execute-paid"] === true,
    "Paid execution requires explicit --execute-paid",
  );
  const metadata = {
      ...metadataFor(problems, config, cmd),
      sandbox: sandboxInfo,
      preflight,
      cutoff_evidence: cutoff,
    },
    log = await initializeRun(out, metadata),
    llm = new HttpLLM(config);
  const quality = await auditCorpus(problems, evaluator);
  assert(
    quality.problems.every((p) => p.rejected.length === 0),
    "Sample audit failed",
  );
  await log.append("events", { event: "quality_audit", ...quality });
  if (cmd === "blackbox") {
    for (const p of problems) {
      const candidates = await generateBlackbox({
        problem: p,
        k: Number(options.k ?? 3),
        llm,
        evaluator,
        log,
        metadata,
      });
      const matrix = await buildKillMatrix(p, candidates, evaluator),
        suite = freezeSuite(p, candidates, matrix, metadata.corpus_id);
      await log.append("track2", {
        event: "blackbox_suite_frozen",
        run_id: metadata.run_id,
        suite,
        matrix,
      });
      await log.append("track2", {
        event: "blackbox_held_out",
        run_id: metadata.run_id,
        ...(await evaluateHeldOut(p, suite, evaluator, metadata.corpus_id)),
      });
    }
  } else {
    await track1({
      problems,
      evaluator,
      llm,
      log,
      metadata,
      pairLimit: cmd === "pilot" ? 20 : Infinity,
    });
    if (cmd === "official")
      await track2({ problems, evaluator, directory: out, log, metadata });
  }
  await log.append("events", {
    event: "run_complete",
    run_id: metadata.run_id,
  });
  await sealEvidence(out);
  await report(out);
  console.log("Run completed: " + out);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
