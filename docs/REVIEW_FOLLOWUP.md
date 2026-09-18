# Independent-review follow-up

Scope: the 22 requested follow-up items on `research-hardening-v3`, based on
`cf84931d001dac4111f50299791c23f8f8d0092c`. This is not a renewed repository audit.

| Items          | Resolution and evidence                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 20          | Nested test moved to top level. Core CI uses Node 22/24; one build/browser job, explicit health failure, high-severity dependency audit, visible opt-in Docker skips.                                                                                                      |
| 2, 3, 13, 16   | Protocol 3.1/schema 4 bind resource limits and population policy; runtime uses the shared values. Two-CPU container quota complements process CPU limits. Official RUNTIME_ERROR targets remain forbidden. Server imports protocol version and UI renders it.              |
| 4, 12, 15      | Prerequisites bind exact protocol/resource/Git/corpus/config/image/runtime identities. Actual sealed baseline, pilot and compatibility artifacts are checked. Both base images accept digests; the manual workflow emits machine-readable runtime evidence and TAP output. |
| 5, 21          | Report official status comes from its primary run. Comparisons reject incompatible identities and wrong baselines. Each group retains evidence status; scripts are omitted unless explicitly requested.                                                                    |
| 6              | Multilang child failures map to runtime failure, separate from launcher status. Real compiled-C tests cover exits 86/87/88/142 and conservative INCONCLUSIVE classification.                                                                                               |
| 7              | Global canonical identity, normalized statement, source reuse and near-statement findings require content-bound human review. Heuristics do not certify equivalence.                                                                                                       |
| 8              | Sealed private response records retain bounded raw content or mandatory hashes, identities, usage and cost. No raw response projection into browser/report.                                                                                                                |
| 9              | An operator-authored versioned analysis plan is frozen before official execution, required in preflight and sealed with the run. Official reports derive bootstrap settings from it. No external preregistration is claimed.                                               |
| 10, 11         | RELATED_WORK.md cites verified primary sources. Optional ablation, unseen-problem and shrinking helpers are explicitly development APIs without complete experimental workflows.                                                                                           |
| 14             | Explicit budget status/settle/release commands, billing evidence, no-billing attestation and recorded reconciliation; no automatic reservation clearing.                                                                                                                   |
| 17, 18, 19, 22 | Hash routes use safe decoding/allowlisting. Non-authoritative pasted oracle fields are disabled. Public/private and operator procedure documentation corrected. No license chosen.                                                                                         |

## Local verification

Node 22.23.2 and Node 24.19.0: core suite passes with zero failures/cancellations;
two real Docker integration tests are explicitly skipped locally. Dependency
installation, syntax check, production build, browser smoke, language/RTL suite,
malformed-hash browser checks and dependency audit passed. The suite includes
negative regressions for stale prerequisites, changed resource policy, wrong
baseline/corpus comparisons, response tampering and unverified budget release.

GitHub CI and Docker results are commit-specific. Consult the exact commit's
Actions runs and runtime-validation artifact rather than interpreting this local
verification section as evidence that hosted jobs have passed.

## Hostile self-review

Replayed stale Git/image/config/corpus/resource identities against the gates;
checked that a comparison cannot promote the primary run to official; checked
that changing private response bytes invalidates the seal; checked that a known
charged overrun cannot be released as unbilled or double-counted on settlement.
The review also added explicit rejection of dirty prerequisite worktrees and
checks tying an official run's image and frozen baseline to the actual artifacts.

Limits remain explicit: operator-controlled hashes are integrity checks, not
remote attestation; human oracle/privacy/billing review cannot be proved by a
boolean. Matching a hosted image's base digest alone does not identify a locally
rebuilt image. Official evidence needs the exact validated image. No real corpus,
paid-provider pilot, official experiment, comparative scientific result, external
preregistration or new language-wide correctness guarantee was created here.
