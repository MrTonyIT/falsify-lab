# FALSIFY LAB

**Status: early research prototype.** Local demonstration is available; real runtimes,
model performance and public-service readiness are not yet validated. Start with
[current evidence and continuation notes](docs/PROJECT_STATUS.md) and the
[research/engineering roadmap](docs/ROADMAP.md).

Repository guidance: [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md).
This public repository has not selected an open-source license.

An interactive adversarial code laboratory around the AI Falsifier engine. Open **http://localhost:4173** for the Playground, streamed execution pipeline, counterexamples, run history, benchmark analytics, Track 2 matrices and system health.

## Open the web application

```sh
npm ci
npm run build
npm start
```

The API serves the built React application and SSE stream on one local port. The initial **Demo** mode is ready to use: click **FALSIFY CODE** to run the bundled example through the existing engine with a scripted provider and sandbox fixture. It makes no paid calls and does not execute arbitrary pasted Python. Demo results are labeled and excluded from official metrics.

**Live playground** accepts custom code. It requires Linux Docker, a configured provider, and an oracle for the problem: either the bundled synthetic sum problem or a hash-bound, manually reviewed corpus entry. Pasting three references does not establish a trusted oracle and is blocked before paid execution. Custom code is never labeled known-wrong. Model credentials stay on the server. See [web integration](docs/WEB_INTEGRATION.md) for configuration, API boundaries and validation evidence.

The top-right language selector offers English, Vietnamese, Spanish, French, German, Portuguese, Japanese, Korean, Simplified Chinese, Arabic, Hindi and Russian. It remembers your choice and preserves active runs and source code. English and Vietnamese have the broadest coverage; the other ten translate core controls and use a visible English fallback for advanced content. This is an extensible catalogue, not a claim to translate every language.

In **Live playground**, choose a source language below the editor: Python, C, C++17, JavaScript, TypeScript, Java, Go, Rust, C# (Mono), Ruby or PHP. These adapters accept single-file console programs using stdin/stdout, without external packages. They do not test arbitrary websites, mobile apps or multi-file projects. Demo fixtures and official benchmarks keep their Python protocol. See [languages and runtimes](docs/LANGUAGES.md) for setup and current verification limits.

For frontend development, run `npm start` and `npm run dev` in separate terminals. `npm run test:e2e` runs browser checks against the running application (Chrome path can be configured through `CHROME_PATH`; URL through `LAB_URL`). The browser script covers streamed progress, KILL and SURVIVED, JSONL-backed metrics, history, errors and mobile navigation.

## Benchmark engine

**Official benchmark: NOT RUN.** This harness measures whether an LLM can generate valid counterexamples for known-wrong Python competitive-programming submissions. It implements the explicitly versioned [v3 research protocol](docs/RESEARCH_PROTOCOL_V3.md), documenting changes from the supplied v2.0 design; no paid benchmark or real Codeforces corpus was run during development.

The core flow is generator → validator → three independent references → target → checker. Track 1 permits three DEV-only attempts. Track 2 cross-runs generated tests against DEV submissions, freezes a greedy set-cover suite, then evaluates held-out submissions. Optional black-box generation sees only statement and constraints. Random baselines use 3 and 50 tests with reproducible seeds and the same evaluator.

## Run locally

Node.js 22+ is sufficient for core/mock tests. The benchmark engine remains dependency-free; the web product adds React, Motion, Monaco, Recharts and build/test tooling, pinned by `package-lock.json`.

```sh
npm run check
npm test
node src/cli.js smoke --out results/smoke
node src/cli.js report --out results/smoke
node src/cli.js help
```

The smoke command is a deterministic mock workflow, not Python execution and not a research result. It writes canonical JSONL plus `report.html` and `report.json`. Choose a fresh output directory for each run. On this Windows workspace Node is at `C:\Program Files\nodejs\node.exe` if it is not on PATH.

Real Python execution requires Linux Docker:

```sh
docker build -t ai-falsifier-python:local sandbox
# POSIX shell; PowerShell: $env:FALSIFIER_DOCKER_TEST='1'
FALSIFIER_DOCKER_TEST=1 npm test
```

Docker was unavailable in the development environment, so real isolation/resource tests are explicitly skipped by default. The backend uses fresh containers, no network, read-only root, tmpfs, non-root user, dropped capabilities, no-new-privileges, process/memory limits, RLIMIT_CPU and cleanup. It never executes downloaded or generated Python on the host. Manually authored validator plugins are trusted host code.

## Protocol and reproducibility

- [Specification audit](docs/SPEC_CONFORMANCE.md) distinguishes implementation, tests and operational blockers.
- [Decisions](docs/DECISIONS.md) records contradictions, defaults and departures from ambiguous pseudocode.
- [Corpus guide](docs/CORPUS.md) defines manifests, quality filters and private source handling.
- [Official-run procedure](docs/OFFICIAL_RUN.md) covers compatibility, prices, baseline freeze, pilot and preflight.

The six verdict values are `kill`, `survived`, `invalid`, `gen_failed`, `unusable`, `inconclusive`. TLE/MLE, output overflow, and ambiguous runtime failures are never correctness kills. Token comparison is case-sensitive; YES/NO folding requires the explicit `tokens-yes-no` profile. Unsupported checker classes are rejected. Expected outputs and reference/validator source never enter prompts; feedback uses verdict and a bounded summary of the model's own input. Invalid candidates consume attempts.

Reports include Kill@1, Kill@3, gain in percentage points, extended-baseline Kill@50, invalid/unusable/inconclusive rates, byte and semantic size medians, cost per kill, strata, survivors and seeded problem-cluster bootstrap intervals. Unknown values remain N/A. Contamination must remain unverified until the actual snapshot's cutoff is verified. Source code and large generated input files are not committed; scripts, seeds and hashes support regeneration, which is checked before suite evaluation.

See the [hardening report](docs/HARDENING_REPORT.md), [threats to validity](docs/THREATS_TO_VALIDITY.md), and [v3 protocol](docs/RESEARCH_PROTOCOL_V3.md).

Current limits: no curated 30-problem corpus, no real Docker validation on this machine, no provider compatibility/pricing verification, and no official results. The authored fixture has a full constraint validator, but it is not a substitute for 30 reviewed problem-specific validators. The project is related to fuzzing, mutation testing, LLM test generation and competitive-programming evaluation; it makes no unsupported novelty claim.
