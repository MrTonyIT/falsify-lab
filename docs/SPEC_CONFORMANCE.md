# Specification conformance

**Current checkpoint:** [HARDENING_REPORT.md](HARDENING_REPORT.md) supersedes the
historical test counts below. [Protocol v3](RESEARCH_PROTOCOL_V3.md) documents
intentional deviations. DONE means implementation, never runtime/scientific proof.

Status tracks implementation separately from operational evidence. DONE never implies the real benchmark ran. Initial audit: empty workspace, no code or tests to preserve; entire v2 document read. See DECISIONS.md for contradictions.

| Subsystem | Source | Status | Evidence / remaining work |
|---|---|---|---|
| Domain/config/verdicts/JSONL | §3, §7, §11, appendix C | DONE | domain.js, logging.js; tests passing |
| DEV/held-out and prompt privacy | §3, §4, §10 | DONE | Projection, feedback privacy, candidate provenance and DEV-only matrix tests |
| Isolated Docker execution | §6 | DONE | Backend and command controls tested; runtime verification separately blocked |
| Validators/checkers/oracle | §4.4, §5 | DONE | Three authors, fixture validator, helpers, oracle verdict tests |
| Prompt/parser/feedback/loop | §7, appendix A | DONE | Three logical attempts and logging tests |
| Provider/cost/reproducibility | §11–12, appendix B | DONE | Configurable HTTP adapter, reservation guard, usage, seed/hash metadata, snapshot drift abort; mock HTTP tests |
| Acquisition/cache/sample filtering | §4 | DONE | Rate-limited cached client, private importer, HTML fixture tests, sample execution and stratification; live crawl NOT RUN |
| Full 30-problem human corpus | §4, §13 | BLOCKED | No curated problem list or local sources supplied |
| Random baselines 3/50/freeze | §8 | DONE | Same evaluator, frozen generator digest, seeds and prefix budgets; mock E2E |
| Metrics/strata/survivors/bootstrap | §9, §14 | DONE | Problem-cluster bootstrap, denominator policy, byte/semantic sizes, labels and verified cutoff projection |
| Kill matrix/set cover/frozen held-out | §10.1–2 | DONE | DEV-only matrix, deterministic greedy, logged freeze, regeneration hashes, held-out evaluation tested |
| Optional black-box track | §10.3 | DONE | K calls with statement/constraints only; no target feedback, logged candidates and held-out suite evaluation |
| JSONL report | §13, §17 | DONE | HTML/JSON, joined baseline comparisons; fixtures explicitly not official results |
| Official checklist/pilot | §13, appendix B | DONE | CLI preflight, evidence binding, 20-pair pilot cap; operational runs still blocked |
| Related-work/claim discipline | §1, §15–17 | DONE | DECISIONS.md; no commercial scope |
| Real sandbox verification | §6 | BLOCKED | Docker unavailable in this environment |
| Pilot and official measurements | §13, appendix B | BLOCKED | Corpus, sandbox, provider, operator intent required |

## Validation record

Phases 1–8 are implemented in sequence. Unit tests passed after the domain phase, evaluator phase, loop phase, corpus phase and track/statistics phase. Mock end-to-end runs exercise baseline → Track 1 → kill matrix → frozen selection → held-out → report. An opt-in Docker integration test is provided and skipped without explicit Docker test enablement. No expensive LLM call, source crawl or official benchmark was performed.

Final local verification: 43 tests passed, 1 Docker integration test skipped. CLI smoke completed successfully. The real provider adapter was exercised using mocked HTTP responses; the official gate was tested with both complete synthetic evidence and missing/stale evidence.

Full project completion still requires real corpus curation, 30 reviewed validators/random generators, Docker integration, snapshot/pricing verification, pilot review and an operator-authorized official run. “DONE” rows describe harness implementation, not completion of these operational obligations.

## Web product extension

The subsequent user request expands scope to FALSIFY LAB. Implemented: React/TypeScript application, local HTTP API, SSE observers on existing core, Monaco Playground, explicit demo/live/DEV modes, counterexample panels, attempt timeline, stored run history, JSONL dashboard, Track 2 visualization, and actual system health. See WEB_INTEGRATION.md for the test record and boundaries. The extension does not duplicate the evaluator or change official benchmark protocol. The application can be used immediately with the labeled demo provider/sandbox; real arbitrary Python evaluation still requires Docker and a provider.
