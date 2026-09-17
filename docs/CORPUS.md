# Corpus construction

No official corpus has been downloaded or selected. The synthetic sum fixture is authored for tests and is excluded from official runs. The spec does not prescribe 30 named problems, so statements, constraints and validators must be curated against actual selected problems.

1. Choose 10 Div2 A, 10 B, 10 C problems. Record publication date. Reject interactive, print-any, special-checker, floating-output, file-I/O and image-dependent tasks. Replace problems with insufficient qualified Python submissions.
2. `node src/cli.js fetch --contest 1850 --index B --pages 1 --out private/1850B` caches metadata, HTML, public samples and source pages at no more than one network request every two seconds. This is an example identity, not a recommendation that the problem meets the protocol. Network failures/challenges stop acquisition. No hidden-test endpoint is implemented. Review sample HTML parsing against the page; unsupported entity encodings require manual import.
3. Review the statement and extract all constraints manually. Source code comes from submission HTML, never the metadata API. Keep all sources/cache under gitignored `private/`. Do not publish attempt logs without reviewing generated scripts for quotations of target code.
4. Write a **trusted, manually reviewed** JavaScript plugin exporting `validate(Buffer) -> {ok, semanticSize?}`, `validatorCases`, and `randomGenerator(seed) -> Python source`. Plugins execute on the host and must never contain downloaded submission code or LLM-generated evaluator code. See `fixtures/sum-problem.js` for a complete example. Validate exact line/element counts, ranges, aggregate constraints, alphabets and structures. Every plugin needs at least two valid and two invalid cases, including aggregate cases where relevant.
5. Select three ACCEPTED Python sources with different named authors. Prefer algorithmic diversity. Run `qualityAudit()` on all candidate targets. It runs references and every target against actual public samples, even when passedTestCount is available. Rejected or inconclusive sample executions disqualify the candidate. Copy returned `samplePassed` evidence onto accepted candidates and call `stratifiedSplit()` with seed 12345 to assign 15 DEV and 10 held-out. Keep all eligibility filters intact. Source duplicates across partitions are rejected.
6. Assemble the private manifest below; initially it may include excess targets for an audit. After replacing rejected targets and freezing the split, `audit` and `baseline` operate on the final corpus. `public-manifest` exports IDs/hashes/metadata only.

```json
{
  "problems": [{
    "id": "contest-index",
    "statement": "Reviewed full statement",
    "constraints": "All constraints including aggregate bounds",
    "division": "A",
    "publishedAt": "2025-01-01",
    "eligibilityReviewed": true,
    "exclusions": [],
    "semanticSizeDefinition": "sum(n) across cases",
    "checkerName": "tokens",
    "plugin": "problem/plugin.mjs",
    "samples": [{"input": "...", "output": "..."}],
    "references": [
      {"id": 1, "author": "author-a", "verdict": "ACCEPTED", "language": "Python 3", "source": "problem/ref1.py"},
      {"id": 2, "author": "author-b", "verdict": "ACCEPTED", "language": "Python 3", "source": "problem/ref2.py"},
      {"id": 3, "author": "author-c", "verdict": "ACCEPTED", "language": "Python 3", "source": "problem/ref3.py"}
    ],
    "dev": [{"id": 4, "split": "dev", "verdict": "WRONG_ANSWER", "language": "Python 3", "passedTestCount": 20, "origin": "human", "source": "problem/dev4.py"}],
    "heldOut": [{"id": 5, "split": "held-out", "verdict": "WRONG_ANSWER", "language": "Python 3", "passedTestCount": 20, "origin": "human", "source": "problem/held5.py"}]
  }]
}
```

The schema example is intentionally incomplete (1 DEV/1 held-out); official validation rejects it. Paths resolve beneath the manifest's directory. Use `.mjs` for external plugins so Node treats them as ES modules. `source` can be accompanied by `sha256` for integrity verification. Corpus identity binds statements, constraints, source hashes, split, metadata, samples and plugin bytes. No benchmark needs network access to Codeforces after acquisition.

Mutants require `origin: "mutant"` and belong in separate development experiments, never the official human corpus. Survivors may be labeled using a private JSON array of `{problem_id, submission_id, bug_type}` and passed to `report --labels`; labels do not affect generation or suite selection. Suggested categories: boundary case, duplicates, misunderstanding problem, complexity issue, overflow where applicable, other.
