# Contributing

This is an early research prototype. Read [current status](docs/PROJECT_STATUS.md),
[research roadmap](docs/ROADMAP.md) and [protocol decisions](docs/DECISIONS.md) first.

## Local checks

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npm start
```

Browser checks require Chrome and a running server. Set `CHROME_PATH` and `LAB_URL`
when necessary, then run `npm run test:e2e` and `npm run test:languages` sequentially
(they share the server's execution slot).

Real Docker checks are opt-in; see [runtime setup](docs/LANGUAGES.md).
CI's unit/API checks do not certify compiler isolation or model performance.

## Change discipline

- Use a focused branch and a pull request with behavior, evidence and limitations.
- Keep secrets in environment variables, configuration under `private/`, and generated
  outputs under ignored folders. Commit only manually reviewed synthetic fixtures.
- Never run submitted or model-generated programs on the host.
- Preserve DEV/held-out separation and keep oracle material out of model prompts.
- Treat translations as UI only; do not translate source, output, routes or API enums.
- Changes to verdicts, checker semantics, prompts or budgets must document their effect
  on comparability. Report all skipped checks explicitly.
- Do not add paid calls to automated CI. Do not silently retry provider calls.

No open-source license has been selected for this public repository. Adding one
requires a deliberate project-owner decision.
