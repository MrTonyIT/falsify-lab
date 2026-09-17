# Threats to validity and scope

| Threat | Mitigation implemented | Remaining limitation / required evidence |
|---|---|---|
| Construct validity | Valid-input gate; explicit checkers; confirmed output mismatch | Finding a counterexample is not proving correctness; surviving 3 tests proves little |
| Oracle error/correlation | Hash-bound provenance/review, public samples, optional bounded exact oracle; disagreement fails closed | Different authors and unanimous answers can share one bug; expert review cannot be inferred from a Boolean |
| Checker mismatch | Enumerated case-sensitive, YES/NO and line profiles; unsupported classes rejected | Operator must reproduce each original judge's actual semantics |
| Internal validity | Same evaluator, fixed seeds/budgets, frozen baselines, stopping rule | Structured random quality and token allocation can dominate comparisons |
| Feedback attribution | Separate no-feedback and one-shot APIs | Extra-attempt gain alone is not evidence of feedback benefit; no real ablation results |
| Statistical validity | Full denominator primary, cluster bootstrap, no one-cluster CI | Small problem count, within-problem dependence, multiple hypotheses; paired hypothesis testing still requires a locked analysis plan |
| Corpus selection bias | Eligibility/sample/split checks, duplicate-source review | Python and Div2 A/B/C restrict population; human curators choose problems and references |
| Semantic duplication | Exact hashes and normalized-comment/whitespace heuristic | Heuristic flags possible duplication, not semantic equivalence or independence |
| Contamination | Snapshot-specific cutoff evidence; unknown remains unverified | Public problems may exist in model training; cutoff alone cannot prove absence |
| Provider drift/nondeterminism | Exact response-model check before code execution; config/usage logs | A model name does not expose weights/backend changes; seeds do not ensure provider determinism |
| Leakage | Field-projected prompts, DEV-only selection, immutable suite binding | Local operator can inspect held-out data; procedural isolation and privacy review remain necessary |
| External validity | Separate unseen-problem partition schema and explicit NOT RUN | Same-problem held-out submissions do not demonstrate transfer to unseen problems/languages |
| Sandbox artifacts | No host fallback, immutable image execution, conservative resource verdicts | Docker is not a VM; startup latency, JVM/GC behavior, hardware and memory policy affect outcomes; real validation is blocked locally |
| Compile/runtime ambiguity | Compile errors separate; ambiguous nonzero exits inconclusive | Conservative policy can miss real runtime bugs; compare only under the same protocol |
| Counterexample minimality | Rechecked bounded proposals; originals preserved | Local byte reduction is neither global minimality nor necessarily lower semantic complexity |
| Cost uncertainty | Durable pre-call reservation and usage settlement; interrupted billing blocks further calls | Provider invoice reconciliation and account-level cap remain mandatory; config-specific ledgers are not a universal account budget |
| Human subjectivity | Named/datable, source-bound provenance and oracle review | Attestations are not automatic proof; independent reviewers must actually perform reviews |
| Evidence tampering | Seals, protocol/corpus/config binding, pair consistency | Hashes detect drift, not malicious privileged rewriting; external signature/archive is not implemented |
| UI interpretation | DEMO/nonofficial separation, legacy labels, metric definitions | Translations are incomplete and not certified; technical terms need human review |
| Public deployment | Loopback binding, origin/fetch-site checks, bounded inputs/SSE | No authentication, multi-tenant isolation, quotas or hosted production readiness; do not treat the local UI as a public service |

No novelty, universal-language capability, statistically significant improvement,
Docker validation, provider compatibility or benchmark success is asserted by
the existence of implementation code or passing mock tests.
