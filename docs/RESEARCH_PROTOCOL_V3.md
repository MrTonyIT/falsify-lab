# Research protocol 3.1.0

Status: **implemented harness; real experiments NOT RUN**. This document supersedes
incompatible v2 and v3.0 evidence. `src/protocol.js` supplies the version, canonical protocol
hash and evidence schema. Changing verdicts, eligibility, information access,
checker semantics, selection or denominators requires a new binding and fresh
evidence. Older files remain inspectable as LEGACY; they cannot establish official
results under this protocol.

Version 3.1 binds the entire resource policy (including a two-CPU container quota), uses evidence schema 4, and requires a separately frozen operator analysis plan. The questions below are design proposals, not an actual preregistration. See [operator procedure](OFFICIAL_RUN.md).

## Questions and falsifiable hypotheses

| Question                                       | Prespecified comparison                                                                                               | What would fail to support the hypothesis                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does adversarial generation improve detection? | Target-aware feedback AI versus frozen Random-3, on identical DEV pairs                                               | Paired problem-level difference is zero/negative or uncertainty includes zero                                                                      |
| Does feedback itself help?                     | Feedback AI versus no-feedback AI, each at most 3 calls with identical model/configuration and target access          | No positive paired difference; Kill@3 minus Kill@1 alone is NOT a feedback ablation                                                                |
| Do tests transfer to other implementations?    | DEV-selected frozen suite against 10 held-out submissions of each same problem                                        | Little/zero held-out coverage; DEV coverage alone is insufficient                                                                                  |
| Does target access help?                       | Statement-only generation versus target-aware generation with an explicitly matched per-problem total call allocation | No advantage under the matched allocation; the current K-call black-box suite and 15-target official workflow are NOT automatically budget matched |
| Are counterexamples economical?                | Validator semantic size, bytes, actual calls/tokens/executions/time and price-estimated cost                          | No consistent benefit across problems; smaller bytes do not imply smaller semantic cases                                                           |

No conclusion is hard-coded. Confirmatory claims require a locked analysis plan,
real corpus, reviewed evidence and actual measurements. Optional ablations and
shrinking are development APIs, not undocumented additions to the official CLI.

## Experimental units and denominators

Official Track 1 assigns 30 problems (10 each A/B/C), 15 human DEV targets per
problem, and at most 3 model calls per pair. The experimental cluster is the
problem, not the submission. The primary endpoint is **all_pair_kill_at_3**:
confirmed kills within 3 attempts divided by all 450 assigned pairs. All-pair
Kill@1 is also reported. Inconclusive, invalid, unusable and generator-failed
outcomes remain in the full denominator. Infrastructure-aborted/incomplete runs
cannot become completed official measurements.

Secondary eligible-pair rates exclude un-killed pairs with any inconclusive
attempt, with explicit excluded counts. These are sensitivity analyses, not the
primary result. Attempt-level failure rates use all observed attempts. Random-50
reports Kill@50 separately; a kill after attempt 3 never contributes to Kill@3.
First confirmed kill stops each pair; every earlier invalid/unusable attempt
consumes budget. Samples are eligibility checks, not adversarial search attempts.

Percentile bootstrap resamples entire problem clusters with replacement, pools
their pairs, and recomputes the full-denominator rate. Defaults: 2,000 draws, seed
12345; interactive dashboards use 500 draws. No interval is produced with fewer
than two clusters. Thirty clusters still offer limited precision. Current code
reports per-method intervals. `pairedProblemBootstrap` additionally requires
identical assigned pairs and estimates a paired full-denominator difference;
operators must first establish compatible corpora/configurations and budgets.
Neither API implements multiplicity correction or declares statistical significance.
The hypothesis table is a plan, not proof that all inferential analyses exist.

## Information access and budgets

Generation sees the public statement/constraints, the assigned DEV source for
target-aware methods, and only its own bounded candidate input plus canonical
verdict feedback. No reference code, validator code, expected/actual outputs or
held-out material enters prompts. No-feedback generation omits prior history;
one-shot uses one call. Official generation remains target-aware feedback AI only.

Model settings remain explicit: high reasoning, 16,000 maximum completion tokens,
configured conservative input-token reservation, no response reuse, no silent
model/parameter fallback, no automatic retries. Seed 12345 is requested, but
provider nondeterminism and OS entropy cannot be eliminated by that request.
Random-3 and Random-50 share the first three seeds of 12345–12394 and the same
operator-authored structured generator. This distribution is not uniform over
the valid-input space. Its scripts, plugin and corpus identity are frozen before
AI evaluation. Keep generator tuning outside the final evaluated corpus.

Attempt evidence records model calls, token usage, cached tokens, elapsed wall
time and evaluator sandbox executions. Preflight compilation, quality audits,
Track 2, compatibility and optional shrinking are separate phases and are not
silently included in Track 1 counts. Prices are operator-verified estimates;
invoices, provider-side overhead and uncertain billing need reconciliation.

## Checker and oracle policy

Supported checker profiles: case-sensitive ASCII-whitespace `tokens`, explicit
YES/NO-only case folding `tokens-yes-no`, and `lines` (CRLF normalized, trailing
spaces/tabs and trailing empty lines ignored). Invalid UTF-8, control bytes and
excess output are rejected. Floating-point, special judges, interactive tasks and
multiple-valid-output tasks are unsupported; import must reject them.

Three matching outputs do not prove correctness or independence. Each reference
needs source-bound provenance, algorithm family, independence rationale, dated
manual review and sample verification. The problem needs a reviewed oracle
binding. A reviewed exact/brute-force plugin may additionally check bounded
cases through `{applicable, output: Buffer}`. Unverified or disagreeing references
fail closed. The explicit synthetic fixture exception is never official evidence.

Only a valid candidate with a trusted oracle and unequal successful target output
produces a correctness KILL. Compile errors abort with a separate error; timeout,
OOM, output overflow and ambiguous nonzero runtime exits are INCONCLUSIVE.
This is a conservative, documented change from crash-as-KILL behavior: exception
text or exit status alone cannot reliably distinguish algorithmic failure from
managed-runtime/resource/launcher effects.

## Freeze and generalization

Track 2 collects only current-protocol DEV candidates, rebuilds the DEV kill
matrix, performs deterministic greedy set cover, and persists the full selection
before held-out execution. Suite identity binds canonical content, protocol,
matrix, candidate scripts, generated input hashes and current problem identity
including its held-out partition. Mutation invalidates verification. Repeated
held-out inspection must not be represented as untouched evaluation.

`freezePartitions`/`verifyPartitions` reserve separate unseen problems and reject
ID/exact-statement overlap. Near-duplicate and algorithm-family independence
still require human judgment. There is **no real unseen-problem dataset and no
completed unseen-problem experiment**. Same-problem held-out transfer cannot be
advertised as cross-problem generalization.

`shrinkCounterexample` is optional post-analysis. It revalidates/rejudges proposed
smaller byte strings with the same oracle and target, keeps only the same KILL
category, bounds checks, and preserves original/minimized bytes, hashes and
semantic sizes. It never rewrites Track 1 evidence, alters official selection,
or claims global minimality. Proposal functions are trusted operator code.

## Integrity and execution provenance

Run metadata binds protocol, Git revision/cleanliness, corpus/config identities,
expected DEV assignment, provider settings, seed and Node runtime. Official runs
also bind checked Docker image and preflight/baseline evidence. Completed evidence
is sealed across canonical artifact files. Reports and the web require compatible
metadata, seal, pair consistency and official gates rather than event names alone.
VERIFIED means **artifact integrity**, not external scientific certification.

Seals are not signatures. An operator with write access can rewrite both evidence
and seal; external archival attestation is outside this local research tool.
Plugins are explicitly trusted reviewed host code, not a sandboxed upload API.
Review their full dependency closure and bind declared dependency hashes.
Official preflight requires a clean committed harness and revalidation after
changes. Private submissions and raw research logs remain gitignored.
