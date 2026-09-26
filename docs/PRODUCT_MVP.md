# Learner MVP — controlled local trial

Audience: learners with a single-file Python solution that passes samples but may
be wrong. Promise to test: choose a supported problem, paste code, inspect an
executed counterexample, and check a revision against that same input.

The product is not a proof of correctness or a replacement for an official judge.
The initial supported scope is deterministic stdin/stdout tasks, existing checker
profiles, Python, Vietnamese/English, and a small invited trial. Other adapters and
locales remain available with their actual verification status; no universal-code
claim. Research tools remain separate from the learner journey.

Acceptance: explicit demo/live state; reviewed-corpus selection without requiring
learners to author references; provider destination/budget disclosure; full input
download; source/input/runtime identity; no-provider replay of a previous checked
input; unknown/error results never presented as correctness certification.

| Priority | Actual gap                                     | Completion evidence                                                                                                      |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0       | Real container validation                      | Exact commit/image workflow and machine artifact, without treating hosted images as locally installed                    |
| P0       | No reviewed real catalog                       | Candidate packets with truthful provenance, automated checks, and a pending human-review gate                            |
| P0       | Result/revision journey                        | API and browser regressions for full evidence and replay, including gate failures                                        |
| P0       | Response artifact capacity                     | Bounded private raw blobs included in seals; large-response regression                                                   |
| P1       | Report denominator prominence                  | Primary all-pair counts visible before eligible sensitivity rates                                                        |
| P1       | Operator plan validation                       | Unsupported/mismatched analysis choices rejected; no arbitrary-analysis claim                                            |
| P1       | Unknown product value                          | Prepared 5–10-person task/measurement packet, explicitly not yet run                                                     |
| Deferred | Dependence between reviewed duplicate problems | No new inferential claims; family grouping/sensitivity analysis needed before scientific publication                     |
| Deferred | Public hosting                                 | Authentication, authorization, queue/quotas, isolation review, retention and operations owner required before deployment |

Existing passing checks are historical engineering evidence, not evidence of
user benefit. Do not acquire paid experiments, deploy publicly, choose a license,
or fabricate independent review to clear any gate. Each external gate needs its
actual operator/reviewer. Next stages depend on these gates, not feature count.

## Implementation handoff (2026-09-26)

Implemented: reviewed-problem selector, pending draft catalog, provider destination
and remaining-budget disclosure, complete private input/output export, source/input
hashes and runtime identity, revision replay without model calls, unchanged original
run seals, and explicit compile/oracle/resource failure handling. Vietnamese/English
cover the new flow; other locales retain the visible English fallback policy.

Engineering checks at this working checkpoint: Node 22 and Node 24 each passed 93
tests, zero failures/cancellations, with four opt-in Docker tests skipped locally.
Build, syntax, existing browser/language checks and learner browser flow passed;
dependency audit reported zero vulnerabilities. Build retains the existing Monaco
chunk-size warning. Check the final commit's CI before treating these as release evidence.

The actual `/work` ownership failure was reproduced on hosted Docker and fixed with
an explicit uid/gid/mode, bound into protocol 3.1.1. The intermediate runtime run
[36211015968](https://github.com/MrTonyIT/falsify-lab/actions/runs/36211015968)
passed Python plus ten language adapters. **This is intermediate evidence only**:
the final commit must also run the added candidate/revision Docker tests and retain
its own commit/image-bound artifact. Local Docker remains unavailable.

Remaining external gates:

| Owner | Needed | Status |
|---|---|---|
| Qualified independent reviewer + corpus operator | Actual validator/oracle/reference/provenance review and properly bound private corpus | Pending; use CANDIDATE_REVIEW.md; AI drafts are not independent references |
| Project owner + provider account operator | Chosen model/account, current official pricing, exact approved call scope and budget, locally configured credentials | Not supplied; no paid calls performed |
| Project owner + 5–10 consenting learners | Run LEARNER_TRIAL.md after prerequisites; retain failures as well as successes | Not recruited; product value unmeasured |
| Deployment/operations owner, if later requested | Authentication, authorization, job/data isolation, queues, cancellation, quotas, secret handling, retention/deletion, monitoring and rollback | Deferred; no public deployment |

Use LEARNER_GUIDE.md to try the local demo. Research independence/family clustering
and confirmatory analysis remain deferred; candidate checks and AI self-tests are
neither human review nor a scientific efficacy study.
