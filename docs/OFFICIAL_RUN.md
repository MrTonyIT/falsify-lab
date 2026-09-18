# Official run procedure (protocol 3.1, schema 4)

The repository supplies a harness, not official research measurements. A real
study requires the operator's corpus, paid-provider authorization and actual
review. Never populate evidence fields with fabricated approvals.

## Freeze the environment and study

1. Commit the harness on the research branch and keep its worktree clean.
2. Build both sandbox images from digest-pinned bases. Python accepts
   --build-arg PYTHON_IMAGE=python@sha256:...; multilang accepts
   --build-arg MULTILANG_IMAGE=debian@sha256:.... Mutable default tags are for
   development only. Record the resulting image IDs. Package repositories can
   change even with a pinned base: use the exact tested image, not an assumed
   reproducible rebuild.
3. Run the manual Docker runtime validation workflow after normal CI passes, or
   run node scripts/runtime-validation.mjs on the exact local images. Preserve
   runtime-validation.json and its TAP output. It records protocol/resource policy,
   Git commit, both image IDs and base digests, Docker/runtime/compiler versions,
   test counts, timestamp and a content hash. The gate rejects skips/failures and
   mismatched revisions/images. A hash proves integrity, not trusted authorship;
   the operator must verify the workflow provenance. A successful hosted workflow
   does not validate a different locally rebuilt image.
4. Curate the private corpus per CORPUS.md, including reviewed plugins, validators,
   samples, independent reference sources and the frozen target partition. Official
   RUNTIME_ERROR populations are rejected even with allowRuntimeError enabled.
   Global duplicate identities/statements and reused sources require explicit
   review. Near-statement token overlap is only a review trigger, never proof of
   semantic equivalence. If triggered, the manifest's independenceReview must
   contain current protocolBinding(), status reviewed, reviewer, reviewed_at,
   rationale and binding=independenceBinding(problems). Review the actual findings
   from independenceFindings(problems); never copy an approval from another corpus.
5. Configure a concrete model snapshot, verified prices, conservative input-token
   reservation, cost cap and provider account limit. No provider secrets belong in
   JSON or Git. All commands must use the same corpus/configuration/cutoff options.
6. Write your actual hypotheses and analysis choices to private/operator-plan.json.
   Required fields: hypotheses (nonempty string array), primary_endpoint
   all_pair_kill_at_3, secondary_endpoints, denominator_policy all-assigned-pairs,
   bootstrap {method: problem-cluster-percentile, repetitions: integer >=100,
   seed: integer}, planned_comparisons, multiplicity_interpretation, exclusions,
   stopping_policy first-confirmed-kill-or-budget, attempt_budget 3, reviewer.
   Freeze before execution with:

       node src/cli.js freeze-plan --corpus private/corpus.json --config private/config.json --plan private/operator-plan.json --out private/frozen-plan.json

   This records content, timestamp, hash and exact protocol/Git/corpus/configuration.
   It is a local analysis-plan freeze, not external preregistration. Official
   reports use its bootstrap settings. The engine always retains all assigned
   pairs; write exclusion and multiplicity choices consistent with that behavior.
   Additional confirmatory analyses need a separately implemented and reviewed
   workflow; a free-text plan does not execute arbitrary statistical methods.

## Collect actual prerequisites

Use --corpus, --config and --runtime-validation private/runtime-validation.json
for baseline, pilot and compatibility commands. Without runtime validation,
development runs cannot qualify as official prerequisites.

- Run audit and inspect every validator/sample/reference result.
- Run compatibility --out private/compatibility.json --execute-paid with
  FALSIFIER_API_KEY set. This is a separately billable long-prompt call. It records
  the response snapshot, usage and a private sealed response in the adjacent
  .private directory. Confirm real provider parameter/pricing support.
- Run baseline --out results/random before tuning against AI results. Preserve
  baseline.json, evidence.json and the entire sealed run. Both Random-3 and
  Random-50 must complete all 450 DEV pairs and pass generator validity checks.
- Run pilot --out results/pilot --execute-paid. At least twenty actual reviewed
  DEV pairs are required. Manually inspect the logs and reconcile provider billing.
- Assemble private/evidence.json using generated evidence. Its root must include
  protocolBinding(). Supply quality (actual audit), baseline (actual generated
  evidence), compatibility (actual call), pilot (metadata binding plus pairs,
  manuallyReviewed and logs), privacyReview (binding plus passed), pricing
  (verified, config_id, source, verified_at), accountUsageLimitConfigured.
  Baseline/pilot/compatibility/privacy bindings each include exact protocol version,
  ID, evidence schema, resource_policy_id, git_commit, corpus_id, config_id,
  image_id and runtime_validation_id. The CLI also verifies the actual sealed
  baseline and pilot metadata, not just the supplied attestations.
- Run preflight with --evidence, --baseline results/random/baseline.json,
  --runtime-validation and --analysis-plan private/frozen-plan.json in addition
  to corpus/configuration. Missing/stale evidence fails closed.
- Only then run official with the same options, --out results/official and
  --execute-paid. The frozen plan is copied into sealed run evidence. Any change
  to Git, protocol, corpus, configuration or tested image requires new applicable
  prerequisites. There is no automatic paid retry or resume.

## Evidence and reporting

responses.jsonl is private and sealed. Each bounded response has run/problem/
submission/attempt identity, provider request/model, token usage, price-estimated
cost, finish reason and protocol/config binding. retainRawResponses defaults to
true; false retains a mandatory SHA-256 instead. Raw response content is never
projected into browser APIs or reports. Protect private run-directory permissions
and backups; mode 0600 applies on systems that support POSIX modes.

Run report --out results/official --baseline-results results/random. Official
status belongs to the primary run only, and each group retains its own evidence
status. Incompatible protocol/corpus comparisons fail. An official baseline must
match the exact frozen baseline identity. Generated scripts are redacted by
default; --include-scripts is an explicit private-export option because scripts
may reproduce source fragments. Review any artifact before publishing it.

## Budget inspection and reconciliation

Provider reservations persist before requests at results/budgets/<config-hash>.json.
Uncertain billing is never auto-cleared. With writers stopped, use:

    node src/cli.js budget --action status --config private/config.json
    node src/cli.js budget --action settle --config private/config.json --reservation ID --actual-cost 0.012 --operator NAME --evidence VERIFIED_INVOICE_REFERENCE
    node src/cli.js budget --action release --config private/config.json --reservation ID --operator NAME --evidence VERIFIED_ZERO_BILLING_REFERENCE --attest-no-billing

Use --ledger-root for a different results root. Settlement records verified actual
cost without double-counting an already recorded excessive charge. Release requires
an explicit no-billing attestation and cannot erase known charged usage. Every
reconciliation is recorded in the ledger. A stale .lock requires checking that no
writer remains before operator removal. Never delete ledgers to evade limits.

## Runtime and interpretation limits

Each execution uses an isolated container, bounded memory/PIDs/files/output,
two-CPU container quota and per-process CPU limits. Wall timing includes container
startup and may be conservative. Multi-language compilation has a separate bounded
allowance. Docker is not a VM. Compiler/runtime failures and ambiguous target
crashes do not automatically become correctness kills. The actual Docker workflow
must pass before claiming runtime validation.

Optional --cutoff evidence defaults to unverified; only a verified snapshot/model
card supports before/after grouping. Same-problem held-out results do not establish
unseen-problem transfer. One-shot/no-feedback, unseen-problem partitioning and
shrinking remain development APIs without complete experimental CLI/report flows.
See RELATED_WORK.md for verified overlap with prior research.
