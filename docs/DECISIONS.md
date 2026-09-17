# Protocol decisions

## v3 superseding decisions

[Protocol v3](RESEARCH_PROTOCOL_V3.md) uses all assigned pairs as the primary
denominator; eligible-pair rates remain secondary. Tokens are case-sensitive unless
`tokens-yes-no` is selected. Ambiguous crashes are INCONCLUSIVE; unreviewed oracles
fail closed. Corpus, baseline, suite, configuration and artifacts bind protocol
identities. Snapshot drift stops before code execution; budgets are durable;
official completion requires a seal and complete assignments. These are deliberate
incompatibilities. The numbered v2 history below is superseded where it conflicts.

Source: AI-Falsifier-Adversarial-Test-Generation-v2.0.docx, dated 2026-09-16. The entire main document (including tables and appendices A–C) was extracted and read before implementation. The original specification is Vietnamese. No prior specification or implementation was supplied. At initial implementation the workspace was empty; that historical condition no longer describes this Git repository.

1. **Eligibility (§2.2, §4.2 versus §7.3, §17):** default human corpus is WRONG_ANSWER only. RUNTIME_ERROR is an explicit separate configuration, recorded in metadata. Mutants never join the human corpus.
2. **Size (§9.1 versus appendix C):** `input_size` is UTF-8 bytes. `semantic_size` is a validator-supplied nonnegative problem-specific measure, with a named definition. Unknown semantic size is null, never substituted with bytes. Report both medians.
3. **Response contract (appendix A):** request one Python block, allow up to two trailing explanatory sentences, extract the last nonempty Python fenced block. Python syntax/execution errors consume an attempt as GEN_FAILED. “Valid block” means a syntactically formed Markdown fence, not pre-executed Python.
4. **Privacy (§3 versus appendix A and user request):** the appendix includes expected outputs in feedback, but the user's explicit privacy rule prohibits private expected outputs and derived hidden answers. Conservative default omits expected AND target outputs (a surviving target reveals the answer). Feedback includes only verdict, safe fixed reason and candidate input truncated to 500 characters. Private logs can record diagnostics; no arbitrary evaluator detail enters prompts.
5. **Historical v2 inconclusive denominator (§7.3, §9), superseded for the primary metric by v3:** a killed pair is always eligible. An un-killed pair with any inconclusive attempt is excluded from both Kill@1 and Kill@3 denominators. Also report all-pair rates and exclusion counts. This prevents inconsistent denominators from breaking Kill@3 >= Kill@1. Attempt-level inconclusive rate is separate.
6. **Unusable (§7.2 versus §9.1):** includes any reference failure and disagreement. Report disagreement separately; failures do not prove weak official tests.
7. **Track 2 (§10 versus §12 cost table):** reuse Track 1 generators; matrix/selection make zero LLM calls. The extra 240 calls in the cost estimate have no defined protocol and are not implemented.
8. **Seed (appendix A):** `import random` must precede `random.seed(12345)` in executable Python. Require seeding before random draws, not literally before imports. Runner also seeds Python's PRNG and hash seed; this cannot guarantee determinism for time/OS entropy, so suite freezing regenerates and hashes selected inputs.
9. **Limits (§6):** 8 MiB and 1 GiB interpreted as binary units. Missing prior-spec values: pids=64, tmpfs=64 MiB, stderr=64 KiB, reference/target stdout=8 MiB. Output overflow on target is INCONCLUSIVE (not evidence of a valid correctness kill). CPU hard limit matches wall seconds via RLIMIT_CPU.
10. **Environment:** Node.js 24 is available; Python and Docker are absent from PATH. The dependency-free harness is JavaScript, submitted/generated programs remain Python. Mock tests do not execute untrusted code. Real execution requires a built, pinned Linux Docker image. No host execution fallback.
11. **Provider (§11):** `gpt-5.6-terra` is specification wording, not a verified available API snapshot. Provider URL/model/pricing are operator configuration. No cutoff or current price is asserted. Official runs require explicit compatibility/pricing/cutoff evidence where applicable, a pinned model identity and operator usage-limit attestation.
12. **Corpus:** the specification names no fixed list of 30 problems. Acquisition/import and validation gates are implemented separately from the manually curated corpus. Authored smoke fixtures are synthetic and cannot be reported as human Codeforces results. Real corpus curation and 30 validators remain operational work until selected problems exist.
13. **Scope:** no hidden-test acquisition, SaaS, repair agent, or paid official run is authorized as part of development. Honest reports display NOT RUN when no measured official data exists. Related-work claims in §0/§16 are positioning, not established novelty.

Docker controls were checked against [Docker run documentation](https://docs.docker.com/engine/containers/run/) and [resource constraints](https://docs.docker.com/engine/containers/resource_constraints/). Docker integration must be tested on a Linux Docker host before official execution.

14. **Cleanup (§6):** explicit `docker rm --force` in `finally` replaces immediate auto-removal so Docker OOM state can be inspected before mapping verdicts. This is a documented implementation deviation; graceful paths always clean up, but host termination can leave named containers for operator cleanup.
15. **Baseline stopping/metrics (§8–9):** both random budgets stop at their first kill, matching AI early stopping. Random50 records Kill@50 separately; a kill on test 25 never counts as Kill@3. The same seed prefix is used for random3/random50.
16. **Black-box (§10.3):** one generator per call, K calls, without target code or outcome feedback; candidates can be processed through the same DEV selection/frozen held-out pipeline. This reports a compact black-box-derived suite, not a separate claim that all K raw tests were selected.
17. **Infrastructural failures:** Docker/provider transport failures abort a run and create events, rather than fabricate one of the six scientific verdicts. If a response already exists, its generator and usage are preserved in the abort event. In v3 a provider snapshot mismatch is detected before generated code executes; usage is preserved and official completion is prevented. Interrupted runs are not official measured results.
