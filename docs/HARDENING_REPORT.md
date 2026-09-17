# Research hardening v3 — completion report

Date: 2026-09-17. This is an engineering verification record, not a scientific
benchmark result or independent security certification. No paid model calls,
Codeforces acquisition or official experiment were performed.

## 1. Branch

All changes are confined to `research-hardening-v3`. No merge, force-push, history
rewrite or modification of `main` is part of this task.

## 2. Git revision

Base and unchanged main: `2b381ad043317b2a50903554ae4d4290cf809715`.
The delivered revision is the commit containing this report; use
`git rev-parse research-hardening-v3` for its exact hash. The final delivery message
also records that hash. A report cannot embed its own final Git hash without
changing the hash again.

## 3. Materially changed modules

- Research: `protocol`, `oracle`, `checkers`, `corpus`, `domain`, `evaluator`,
  `falsify`, `track2`, `baseline`, `metrics`, `experiments`.
- Evidence/operation: `evidence`, `logging`, `workflow`, `preflight`, `cli`,
  `report`, `budget`, `llm`, `sandbox`, polyglot runner.
- Server: HTTP validation/SSE, service orchestration, history projection/checksums,
  worker-based analysis.
- Frontend: separate Playground, Pipeline, Result, RunsPage, BenchmarkPage,
  SystemPage, Suite, shared components, API and dialog-focus hook; chart semantics.
- Tests, normal CI, dependency lock/override, Vite sanitizer guard and documentation.

## 4. P0 findings and fixes

| Finding | Resolution |
|---|---|
| Event names alone could imply an official measurement | Current-protocol metadata, artifact seals, pair consistency, frozen selection, real-execution provenance and official prerequisites are checked centrally |
| Different reference strings/authors could be mistaken for independent correctness | Source/sample-bound provenance, dated human review and oracle binding; unreviewed custom oracles blocked before paid calls; optional bounded exact check |
| Global case folding changed judge semantics | Explicit case-sensitive token, YES/NO and line profiles; unsupported classes and malformed output rejected |
| Ambiguous runtime failures could become correctness KILLs | Conservative INCONCLUSIVE policy; compilation and compilation-resource errors separate |
| Suite verification trusted a caller-supplied stale corpus label | Current problem identity, protocol, matrix, scripts and input hashes bound; changed private targets also invalidate verification |
| Model drift detected only after code ran | Check response model before generator execution; retain returned usage in abort evidence |
| Budget reset on restart and did not reserve outstanding requests | Durable locked ledger, flushed pre-call reservation, settlement; uncertain billing blocks subsequent calls |
| Concurrent starts could both pass the active-run check | Synchronous reservation before asynchronous checks; failure releases the slot |
| Source/plugin path containment ignored symlinks/review | Realpath containment, explicit hash-bound trusted-plugin/dependency review gate before import |
| Docker tag could change between executions | Resolve and pin image ID; tag drift after pinning fails closed |
| Dependency audit override did not patch Monaco's vendored sanitizer | Exact DOMPurify 3.4.15 dependency plus Vite redirection of the vendored copy; build rejects any remaining old vendored module |

These fixes cover identified reviewed paths. They are not proof that no undiscovered
vulnerability exists. Real sandbox validation remains externally blocked.

## 5. P1 findings and fixes

Full-denominator primary metrics and problem-level uncertainty are explicit;
one-cluster confidence intervals are suppressed. Paired bootstrap requires exactly
matched assignments. Baseline comparisons bind the exact frozen baseline identity.
Official preflight checks actual sealed pilot/baseline files, execution provenance,
complete pairs and a clean committed harness. Restored histories are bounded,
checksummed and projected onto known fields. SSE validates cursors, limits clients
and handles backpressure without dropping large evidence events. Incompatible
old evidence is displayed as legacy, not promoted to official measurements.

## 6. Research methodology

[Protocol v3](RESEARCH_PROTOCOL_V3.md) defines falsifiable questions, primary and
secondary endpoints, denominators, budgets, early stopping, seeds, information
access, cluster bootstrap and interpretation limits. One-shot/no-feedback APIs,
unseen-problem partition freezing and optional post-analysis shrinking were added.
These are implemented development facilities, **not measured ablation or
generalization results**. Black-box K-call selection is not automatically budget
matched to the per-target official workflow. Extra-attempt gain is no longer
labeled a causal feedback gain.

## 7. Sandbox/security

Existing network isolation, read-only root, non-root user, dropped capabilities,
no-new-privileges, PID/memory/tmpfs/output/stderr/wall controls and cleanup remain.
Execution uses immutable image IDs; the polyglot supervisor adds inherited CPU
limits. Unknown termination/startup state aborts. No host execution fallback was
added. Host plugins are trusted reviewed operator code, explicitly not a security
sandbox. Cross-origin/fetch-site checks and asset realpath containment were added.

## 8. Testing added

Regression coverage includes adversarial checker bytes/case/size, oracle review
drift, unanimous-reference disagreement with an exact oracle, corpus identity,
post-freeze mutation, single/paired problem bootstrap, durable/uncertain billing,
provider drift ordering, legacy official labels, seals, overwrite prevention,
concurrent starts, primitive HTTP payloads, pasted unverified oracles, history
projection, unseen partitions, shrinking, host-plugin gates, ablation budgets,
SSE cursor/backpressure and compilation-resource classification.

## 9. CI

The normal workflow runs on this branch, main and PRs: clean install, JavaScript
syntax checks, unit/API/integration tests, TypeScript/production build, Playwright
Chromium installation and both browser suites serially against one server. Browser
scripts now support managed Chromium on Linux. Real Docker validation remains a
separately dispatched workflow; it was not represented as locally passed.

## 10. Architecture

The former approximately 2,381-line frontend entry file is approximately 716 lines;
Playground presentation is approximately 696 lines, with other pages/components
separated by purpose. Scientific logic stays in `src/`. Server artifact integrity,
history handling and analysis execution have dedicated modules. This is an
incremental refactor, not a rewrite. Some UI props still use `any`; stricter product
typing is future maintainability work, not evidence of experimental readiness.

## 11. UI/UX/accessibility

Full-denominator metrics, legacy/integrity status, unverified custom-oracle behavior,
same-problem transfer limitations and runtime-validation status are explained.
Metric definitions distinguish semantic size, bytes, exclusions, cluster CI and
price-estimated cost. Command-dialog focus is trapped and restored. Existing visible
focus, reduced motion, mobile behavior and RTL layout are preserved. English fallback
is visible for non-English locales; no translation is claimed certified by a human.

## 12. Performance

Interactive bootstrap analysis runs in a worker instead of blocking the API/SSE
event loop. Dashboard loads share in-flight work and a short cache; payloads omit
generator sources and browsing is capped at 100 directories with a visible notice.
Individual evidence files are capped at 128 MiB for supported analysis. Full
archives require deliberate CLI reports. Monaco/charts remain lazy loaded.

Observed production chunks: entry approximately 454.63 kB (150.38 kB gzip), charts
359.66 kB (104.39 kB gzip), editor 2,640.94 kB (678.00 kB gzip). The editor remains
large and emits the existing chunk-size warning. It is not hidden by raising the
warning threshold, and no unsupported performance improvement is claimed.

## 13. Documentation

README, security guidance, corpus preparation, decisions, official process, language
limits, web integration, specification conformance, status and roadmap were updated.
New protocol, threats-to-validity and this report distinguish implemented code from
runtime, human-review and experimental evidence. Historical test counts are labeled
historical instead of silently passed off as current.

## 14. Commands executed

On this Windows workspace, `npm`/`node` below were invoked through
`C:\Program Files\nodejs\npm.cmd` and `C:\Program Files\nodejs\node.exe`:

```text
git ls-remote --heads origin main research-hardening-v3
git switch -c research-hardening-v3
npm view dompurify version --cache .npm-cache
npm install dompurify@3.4.15 --save-exact --package-lock-only --cache .npm-cache
npm ci --cache .npm-cache
npm run check
npm test
npm run build
npm audit --json --cache .npm-cache
npm ls dompurify
node src/cli.js smoke --out results/v3-final-smoke
git diff --check
```

The hidden local server used `PORT=4174`. Browser commands used
`LAB_URL=http://127.0.0.1:4174`:

```text
npm run test:e2e
npm run test:languages
```

Docker availability was checked using `Get-Command docker` and the standard Docker
Desktop executable path; neither was available. Secret/excluded-file scanning is
performed against staged content before the branch commit.

## 15. Observed results

- Clean dependency installation: passed; 81 packages installed.
- Static checks: 47 JavaScript modules passed syntax checks.
- Tests: **80 total, 78 passed, 0 failed, 2 skipped**.
- TypeScript and production build: passed; large lazy Monaco chunk warning remains.
- Browser suite: passed, including core SSE, demo kill/survival, history, pages,
  error states and mobile navigation.
- Language suite: passed, including 12 locale choices, persistence, code preservation,
  locale switching during SSE, 11 source-language choices, C++ request payload and
  RTL mobile behavior. Language choices are not real compiler validation.
- CLI smoke: passed, explicitly MOCK; official status NOT RUN.
- Dependency audit: **0 known reported vulnerabilities** at verification time.
  This does not mean vulnerability-free software. The vendored sanitizer was also
  checked through the build guard, rather than trusting audit output alone.
- Diff whitespace/error check: passed.

An initial concurrent invocation of the two browser suites competed for the single
run slot and caused the language suite to time out waiting for active progress.
Both suites passed when run serially, and CI now runs them serially. Interim test
failures during protocol/refactor work were corrected; no final failures are hidden.

## 16. Skipped tests

Two explicitly opt-in tests remain skipped: real Python Docker isolation/resource
classification and real multi-language Docker execution. Docker was absent locally.
Mocks do not substitute for either test.

On a Linux Docker host, run:

```sh
docker build -t ai-falsifier-python:local sandbox
docker build -f sandbox/Dockerfile.multilang -t ai-falsifier-multilang:local sandbox
FALSIFIER_DOCKER_TEST=1 FALSIFIER_MULTILANG_TEST=1 npm test
```

Record the actual image IDs, runtime versions, output and failures. Pin base images
for the final experiment. The manual Docker workflow is another execution option.

## 17. Remaining BLOCKED / NOT RUN

Real Docker validation; real compiler/runtime validation; curated 30-problem corpus;
90 genuinely reviewed reference solutions and validators; provider compatibility,
snapshot/pricing evidence; a real reviewed pilot; official benchmark; unseen-problem
dataset/evaluation; measured ablations and shrinking effectiveness. These require
external runtime/data/review/provider inputs, not fabricated local test fixtures.

## 18. Human judgment required

Problem eligibility/judge semantics, reference correctness and independence,
near-duplicate/algorithm-family review, trusted plugin/dependency review, dataset
curation/split, privacy review, contamination evidence, pricing and invoice
reconciliation, pilot inspection, preregistered comparison plan and language review.
Evidence hashes cannot perform these judgments.

## 19. Paid credentials required

Provider compatibility, real AI pilot, feedback/no-feedback/one-shot/black-box
experiments and official AI measurement. The key remains server-side. Each requires
explicit operator paid-run authorization, verified configuration and budget/account
limits. No paid action was used to claim completion of this engineering task.

## 20. Before an official benchmark

Clean committed harness; tested pinned Docker image; final eligible reviewed corpus;
valid checker/oracle/sample evidence; pre-AI frozen and completed real baselines;
verified provider snapshot/configuration/prices; durable ledger and account cap;
20-pair real pilot with actual human review; current privacy/protocol evidence;
passing preflight; a fresh output directory; explicit `--execute-paid` authorization.
Afterwards verify seals and frozen held-out provenance before interpreting results.

## 21. Maturity

**Not ready for a real pilot or official experiment yet.** The local demonstration
and automated engineering checks are operational and materially hardened. External
runtime, corpus and provider evidence is missing. This does not justify a numerical
doctoral-quality score, a novelty claim, or a claim of production-service readiness.

## Hostile self-review record

These were three review passes by the implementing agent, not independent reviewers.

| Perspective | Challenge and resulting action | Unresolved external requirement |
|---|---|---|
| A — research methodology | Rejected author-name independence, event-label official claims, stale suites, eligible-only primary rates, one-cluster CI and causal “feedback gain”; added review bindings/seals/full-denominator metrics, paired analysis and precise labels | Real corpus and expert review; actual experiments and locked analysis plan |
| B — security | Challenged budget reset/outstanding calls, start races, plugin paths, image-tag drift, legacy histories and npm-only sanitizer remediation; added durable reservations, slot lock, realpath/review gates, image pinning, projections and actual bundled sanitizer replacement | Linux Docker validation and independent security review before hosted deployment |
| C — software/UX | Challenged monolithic UI, event-loop analysis, misleading legacy/availability labels, focus handling, concurrent browser tests and SSE backpressure; extracted modules, moved analysis to workers, clarified status, trapped focus and tested large events | Human accessibility/translation review and real-world workload validation |

After fixes, automated tests/build/browser suites were rerun. No identified
code-fixable P0 remains open in the reviewed scope; that statement is bounded by
the tests and review above, not a universal assurance. Main remains untouched.
