# Related work and limits of the contribution

Primary sources checked on 2026-09-18. This is a qualitative comparison, not a
replication or an exhaustive novelty search. Results reported by other authors
are not measurements of FALSIFY LAB.

| Work and verified prior capability                                                                                                                                                                                                                              | Overlap                                                                        | Difference in this implementation                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [EvalPlus](https://github.com/evalplus/evalplus), [project site](https://evalplus.github.io/): expanded HumanEval/MBPP tests evaluate generated-code correctness more rigorously.                                                                               | Stronger tests can reveal errors missed by an original suite.                  | This harness specifies a small target-aware competitive-programming study with human incorrect submissions and frozen same-problem held-out suites. That design difference does not establish superiority.            |
| [TCGBench, Cao et al.](https://arxiv.org/abs/2506.06821): studies both valid generator creation and targeted generators exposing bugs in human competition code; reports instruction-data prompting and fine-tuning experiments.                                | Direct overlap with both statement-only and target-aware generator production. | The present implementation emphasizes explicit oracle review, conservative crash interpretation, provenance, fixed budgets and denominator reporting. Targeted generator creation itself is already prior capability. |
| [CodeContests-O, Cai et al.](https://arxiv.org/abs/2601.13682): iteratively generates tests using execution feedback from correct and incorrect solutions and constructs an optimized CodeContests derivative; authors report evaluation and training benefits. | Feedback-driven refinement and execution-based discrimination.                 | This repository implements a three-attempt per-target protocol and DEV-selected immutable suites. It does not implement or reproduce the paper's large dataset construction or training study.                        |
| [CodeHacker, Shi et al., v2](https://arxiv.org/abs/2602.20213v2): targeted competitive-programming attacks use stress testing, anti-hash attacks and logic targeting, with a validator/checker calibration phase.                                               | Adversarial inputs, target access and attention to reliable checking.          | This harness requires reviewed oracle provenance and does not treat model-created calibration as sufficient authority. It has no measured comparison against CodeHacker.                                              |

The name TCGBench also appears in [Rethinking Verification for LLM Code
Generation: From Generation to Testing](https://arxiv.org/abs/2507.06920).
The TCGBench row above specifically identifies Cao et al. by paper ID; the two
works must not be silently conflated. A detailed comparison of the second work
is TODO.

## Implemented versus demonstrated

Implemented: bounded generation/evaluation loops, reviewed-oracle gates,
full-denominator metrics, baseline freezing, same-problem held-out suite
evaluation, private response artifacts, protocol-bound resource policy,
analysis-plan freezing and prerequisite identity checks. Tests of these mechanisms
are engineering evidence, including synthetic negative cases.

Measured research evidence: no official corpus/provider experiment or
head-to-head study is supplied by this change. CI and runtime integration results
only establish the behavior of the tested harness on their fixtures.

Unmeasured hypotheses: better detection than matched random baselines, a causal
benefit from feedback, economic advantage, and transfer to unseen problems or
languages. Each needs an actual frozen study plan, independent problems, matched
budgets, reviewed oracles and completed evidence. None is a present finding.

One-shot/no-feedback generation, unseen-problem partition helpers and shrinking
are strictly development APIs. They do not yet provide complete CLI/log/report
experimental workflows. Their availability must not be described as completed
ablation, unseen-problem or shrinking experiments.
