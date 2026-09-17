# Project status and continuation notes

Checkpoint: 2026-09-17. This document describes observed evidence, not a release certification.

## Implemented

- Benchmark engine: generator, validator, three references, target, checker; DEV-only
  search, held-out suite evaluation, JSONL evidence and baseline/metric tooling.
- Local React/TypeScript web application with streamed execution, code editor, history,
  benchmark analysis, system status and an explicit simulated demo.
- 12 UI locale choices: English/Vietnamese have broad coverage; ten others translate
  core controls and visibly fall back to English for advanced copy.
- 11 source-language adapters for single-file stdin/stdout programs. Generators,
  validators, references and the official benchmark remain Python.
- Live syntax/compilation preflight before model calls; compilation errors are not kills.

## Evidence at this checkpoint

- 54 automated checks passed; 2 Docker integration checks skipped.
- Production TypeScript/Vite build passed.
- Both browser suites passed, including demo kill/survival, history, language persistence,
  switching locale during a run, selected-language payload and mobile RTL navigation.
- Local API healthy; Docker unavailable; provider not configured; loaded corpus: 0.
- No actual compiler/container execution, paid model run or official benchmark was
  performed locally. GitHub CI results must be checked separately.

## Continue here

1. Read [ROADMAP.md](ROADMAP.md), especially oracle/checker correctness and resource
   classification, before adding more product surface.
2. Run local tests/build; enable Docker integration on a machine with Linux Docker.
   A manually dispatched GitHub workflow is provided, but has not been certified yet.
3. Establish a small reviewed real dataset and a fair experimental protocol.
4. Preserve the user's request for candid evaluations: distinguish implemented features,
   measured findings, assumptions and unresolved risks.

## Repository exclusions

Generated `results/`, `artifacts/`, `web/dist/`, dependencies, npm cache, private configs,
the original user DOCX and extracted specification text are excluded. Architecture,
protocol decisions and implementation notes remain in version control. Keep the
original source document privately for specification traceability.

## Local operation

Run `npm ci`, `npm run build`, `npm start`; open http://localhost:4173.
The original workspace is `D:\project 1`, but no machine-specific runtime paths are
required by the application. Browser tests accept `CHROME_PATH` / `LAB_URL`.
