# Research and engineering roadmap

**v3 update:** the unchecked list below is the historical planning baseline.
Completed hardening and remaining external blockers are recorded in
[HARDENING_REPORT.md](HARDENING_REPORT.md). Do not interpret the old checkboxes as
the current implementation state. The next research milestone is real Docker
validation, reviewed corpus curation and a reviewed paid pilot, not more UI features.

Status: proposed work, not completed capabilities. Prioritize credible execution and
correct conclusions before adding languages or publishing a public service.

## P0 — Correctness and real execution

- [ ] Build both Docker images and run all real integration tests. Record versions,
      image identities, failures and verified language coverage.
- [ ] Distinguish user-supplied references from independently verified references;
      different source strings do not establish independence or correctness.
- [ ] Add/restrict checker profiles for float tolerance and multiple valid outputs.
      Reject unsupported problem classes instead of silently applying token equality.
- [ ] Distinguish Java/Node internal memory failures and other infrastructure failures
      from algorithmic crashes. Verify with targeted real programs.
- [ ] Make budget accounting durable across restart and reconcile uncertain provider
      charges. Audit admission locking before any concurrent-user deployment.

Exit criterion: a reviewed supported-problem contract and reproducible real executions
without known misclassification in the test corpus; all unverified scope stated explicitly.

## P1 — Scientific contribution and evaluation

- [ ] Produce a related-work comparison including EvalPlus, CodeContests-O and CodeHacker.
- [ ] Define falsifiable hypotheses and the exact additional contribution over prior work.
- [ ] Curate correct and incorrect human submissions with reviewed validators/checkers;
      exclude duplicate source/algorithm families and document provenance.
- [ ] Compare random/structured generation, independent LLM samples and feedback loops
      with explicit call, token, time and monetary budgets.
- [ ] Report bug discovery, false accusations, invalid/inconclusive cases, time and cost;
      cluster uncertainty by problem and justify sample size.
- [ ] Freeze selection before held-out evaluation; assess contamination and performance
      on new problems, not only unseen submissions to known problems.
- [ ] Preserve model responses, runtime identity and evidence for independent replication.
- [ ] Investigate constraint-preserving counterexample reduction and transfer of tests
      across submissions. Treat these as hypotheses, not established novelty.

Relevant research (starting points, not an exhaustive literature review):

- https://arxiv.org/abs/2305.01210 — EvalPlus
- https://arxiv.org/abs/2601.13682 — CodeContests-O
- https://arxiv.org/abs/2602.20213 — CodeHacker

## P2 — User value

- [ ] Choose the first audience: competitive-programming learners, problem setters or researchers.
- [ ] For learners, offer reviewed problems so they need not write three reference solutions.
- [ ] Evaluate whether small counterexamples and progressive hints improve debugging and learning.
- [ ] Measure time to first useful result, successful fixes, repeat use and cost per verified useful bug.
- [ ] Review translated terminology with fluent users; expand coverage based on observed demand.

## P3 — Public service readiness

- [ ] Authentication, per-user authorization and data separation.
- [ ] Durable queue, cancellation, quotas, per-user budgets and recovery.
- [ ] Independent sandbox/security review and dependency remediation.
- [ ] Explicit source-transmission/retention controls and observability without secret leakage.
- [ ] Capacity/cost measurements, operational runbooks and reviewed release criteria.

The project is not currently certified for public multi-tenant deployment. Interface
localization and the presence of runtime adapters do not satisfy these criteria.
