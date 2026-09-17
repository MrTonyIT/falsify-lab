# Falsify Lab web integration

Repository inspection: existing engine is Node ESM, with Python programs executed in a Docker sandbox. There is no Python backend package to preserve or wrap in FastAPI. The product reuses `runPair`, `Evaluator`, `HttpLLM`, `DockerSandbox`, JSONL, metrics and Track 2 readers directly through a local Node HTTP API. React/TypeScript/Vite provides the browser UI; engine logic is not duplicated in TypeScript.

Optional event observers were added to the existing loop/evaluator. Defaults are no-ops; the benchmark remains unchanged. Custom playground prompts say correctness is unknown. Expected/actual outputs may be displayed to the local operator, but are never inserted into LLM feedback.

Demo mode is a clearly labeled, deterministic provider/sandbox fixture exercising the actual loop, validator, three-reference agreement, checker and JSONL. Only bundled example sources are supported in demo. It does not execute arbitrary Python, call a model or create official benchmark metrics. Real mode accepts a supported corpus problem or custom statement/constraints with a Python validator and three independent Python references. All pasted Python, including validators, executes only in Docker. Generic statement-only validation/oracle generation is not scientifically sound and is not fabricated.

The API binds to loopback, validates Host/Origin, rejects cross-origin mutation, limits bodies and concurrent jobs, and exposes no credential or reference-source endpoints. Credentials/configuration stay in local environment files. This is a local single-user product, not an authenticated public deployment.

## Running

`npm run build` type-checks and builds the frontend. `npm start` runs the API and serves `web/dist` at `http://localhost:4173`. The frontend uses React/TypeScript, Motion, Lucide, locally bundled Monaco/Python workers, Recharts and local Inter/JetBrains Mono fonts. There are no CDN dependencies. Monaco and chart code are lazy-loaded. Reduced-motion preferences, keyboard controls, focus indicators and stacked mobile panels are supported.

Optional server environment:

```powershell
$env:FALSIFIER_CONFIG='D:\project 1\private\model.json'
$env:FALSIFIER_API_KEY='your-provider-key'
$env:FALSIFIER_CORPUS='D:\project 1\private\corpus.json'
npm start
```

Configure the model using `config/example.json` as the schema, with real endpoint/model/prices. The existing `HttpLLM` adapter and budget guard make live calls; all Python uses the existing `DockerSandbox`. Custom validators read stdin and accept by exiting 0, reject by exiting nonzero. Validator/reference sources are retained only in the server job closure and never enter prompts or API read responses. Supplied references are user-provided oracles, not automatically certified ACCEPTED submissions.

## Endpoints and persistence

| Endpoint | Purpose |
|---|---|
| GET /api/health | API liveness |
| GET /api/system/status | Actual Docker/model/corpus/storage state |
| GET /api/examples | The two explicitly authored demonstration examples |
| GET /api/problems | Public statement/constraints and DEV targets only |
| POST /api/falsify | Validate input, create job, call the existing engine |
| GET /api/runs | Stored web run summaries |
| GET /api/runs/:id | Per-attempt evidence and event trace |
| GET /api/runs/:id/events | SSE with replay and Last-Event-ID support |
| GET /api/metrics or /api/benchmarks | Existing JSONL analysis, separated by run/kind |
| GET /api/test-suites | Existing matrix, frozen selection and held-out records |

Each web run writes existing `attempts.jsonl`, `finals.jsonl` and `events.jsonl`, plus `stream.jsonl` for UI events and an atomic `web.json` snapshot for history. Generated candidate/output previews are capped at 65,536 characters; truncated inputs cannot be copied as if complete. Generator scripts remain copyable. Run failures do not trigger silent provider retries. Server restart marks interrupted jobs as failed. Live playground and interactive DEV runs do not become official benchmark evidence; the official CLI preflight remains required.

## Verification in this workspace

- Production frontend build and TypeScript check passed.
- 54 core/API/localization tests passed; the two real Docker integration tests remain skipped because Docker is not installed.
- Chromium end-to-end test passed: Monaco loads, payload submitted, streamed stages animate, two-attempt KILL yields input `1 / 1 / -1`, expected `-1`, actual `1`; history and run details persist.
- Three-attempt survivor flow preserves uncertainty; custom input cannot silently execute as a mock; live mode without credentials returns a readable error.
- Benchmarks/Analytics/Test Suites/System/Settings were opened and visually reviewed. Metrics default to NOT RUN, with a separate measured-demo dataset selector. Mobile layout/navigation tested at 390 px without horizontal page overflow.
- No paid provider call or actual Docker execution was performed. Real mode is wired to those backends but remains unavailable until they are configured.

## Language extension

The UI now offers 12 locales with persistent selection, React-rendered translations, English fallback and Arabic RTL support. Live target execution has 11 explicit source-language profiles; validators, generators, references and the official benchmark remain Python. `GET /api/system/status` now includes the public language registry and image availability. `POST /api/falsify` accepts an allowlisted `language` (default `python`); run summaries/attempt logs retain it. Live syntax/compilation preflight runs before model calls; compilation failures produce an error with bounded diagnostics, never a kill. The second Docker image and validation limits are documented in [LANGUAGES.md](LANGUAGES.md). `npm run test:languages` verifies the language selector, input preservation, locale changes during SSE, API language routing and mobile RTL layout.
