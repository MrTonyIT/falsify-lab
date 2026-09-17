# Official run procedure

The repository contains no official measurements. Development uses mocks and authored fixtures. An official run is a separate operator action requiring paid-provider credentials and a curated corpus. The harness does not bypass provider or Codeforces access restrictions.

1. Install Node >=22 and a Linux Docker daemon. Build the image with `docker build -t ai-falsifier-python:local sandbox`. Pin the base image digest for reproducibility (`--build-arg PYTHON_IMAGE=python@sha256:...`). Run the opt-in Docker tests and save the tested image ID; official evidence must match the image returned by `docker image inspect`. No host fallback exists.
2. Curate the corpus following CORPUS.md. Run `audit`. Review validators, sample parsing, exclusions and all 90 references. Commit the harness and record the Git revision. All downloaded sources remain private.
3. Copy `config/example.json` to a private local configuration. Replace endpoint/model with a verified concrete snapshot. Set real prices per million tokens (the example zeros are placeholders), cost guard, and provider account usage limit. Prices and model identifiers in the source spec are unverified planning assumptions. Do not silently substitute another model.
4. Export `FALSIFIER_API_KEY` in the operator's shell. Run `compatibility --config ... --out private/compatibility.json --execute-paid`. It tests high effort, 16000 completion tokens and a long prompt. It sends temperature only if configured. If rejected, deliberately update configuration and rerun; no silent fallback occurs. Compatibility is separately billable and its usage is recorded in its evidence file. Official analysis does not include compatibility costs.
5. Freeze and run both random baselines before AI: `baseline --corpus ... --config ... --out results/random`. Save `baseline.json` and `evidence.json`. Both use the same manually authored generator with seeds 12345 through 12394; the 3-test baseline is the prefix. Execution stops at a kill. Do not tune generators after seeing AI results.
6. Run `pilot --corpus ... --config ... --out results/pilot --execute-paid` (20 DEV pairs maximum). Manually inspect every attempt/log. Record the review in evidence. If the corpus has fewer than 20 pairs this cannot satisfy official prerequisites. Check billing against provider usage, particularly after any transport interruption.
7. Assemble the evidence file described below. Run `preflight` with corpus/config/evidence/baseline paths. Missing, inconsistent or stale evidence fails safely. Re-run relevant checks after any code, corpus, plugin, provider or price change.
8. Start `official ... --out results/official --execute-paid` only after preflight passes. Calls run serially by problem. Track 2 reuses generators, makes no LLM calls, logs matrix/selection before evaluating held-out submissions. No held-out source/outcome enters generation. Do not use held-out results to tune and rerun suites as if they were untouched held-out data.
9. `report --out results/official --baseline-results results/random` joins canonical JSONL for comparisons. Include negative results, invalid/unusable/inconclusive rates, survivor labels and problem-level confidence intervals. Do not generalize 30 problems into 450 independent samples.

Evidence structure (combine actual generated records, never fill with fabricated approvals):

```json
{
  "compatibility": {"config_id": "sha256:...", "model": "verified-snapshot", "nonempty": true, "longPrompt": true},
  "quality": {"corpus_id": "sha256:...", "problems": ["actual audit records"]},
  "baseline": {"sha": "sha256:...", "completed": true, "log_digest": "sha256:...", "directory": "results/random"},
  "sandboxIntegration": {"imageId": "sha256:...", "passed": true},
  "accountUsageLimitConfigured": true,
  "pricing": {"verified": true, "config_id": "sha256:...", "source": "provider price evidence URL", "verified_at": "ISO timestamp"},
  "pilot": {"pairs": 20, "manuallyReviewed": true, "corpus_id": "sha256:...", "logs": "results/pilot"},
  "privacyReview": {"passed": true, "git_commit": "40-character Git revision"}
}
```

The gate verifies the baseline attempt-file digest, all 900 DEV/budget final records, target hashes, attempt counts and generator validity. Human review/account limits/pricing evidence remain explicit operator attestations, not claims the harness can independently prove.

Contamination grouping is optional and defaults to `unverified`. Supply `--cutoff private/cutoff.json` with `{ "verified": true, "model": "exact-snapshot", "cutoff": "YYYY-MM-DD", "source": "verified model-card URL" }` only after verifying that snapshot. The CLI ignores unverified corpus labels, derives before/after groups from publication dates, and stores the evidence in run metadata. No date from the specification's speculative cutoff discussion is treated as fact.

The cost guard reserves a conservative configured `maxInputTokens` plus maximum completion-token cost before each serial call; the prompt must fit within that many UTF-8 bytes. Verify the provider's tokenizer and billing semantics during compatibility. Cached input billing is separate from response reuse, which is prohibited. A failed HTTP call may still be billed by the provider; reconcile usage before resuming. There is no automatic resume or retry that might silently duplicate calls. Existing run directories are never overwritten.

Sandbox cleanup uses explicit `docker rm --force` in `finally`, rather than `--rm`: this preserves `OOMKilled` state long enough to distinguish MLE from a correctness crash. Cleanup runs after every attempted execution, including timeout/errors. An ungraceful host termination may require operator removal of containers named `falsifier-*`. Wall timeout includes container startup; this is conservative and may increase inconclusive/unusable rates. RLIMIT_CPU is additionally enforced in Python. Docker is not a VM, and local mock success does not establish production isolation.
