# Interface languages and source runtimes

v3 retains the same 12 locales and 11 source-language adapters. Translation coverage
is partial and has not received certified human review. Missing keys fall back to
English. Runtime availability is distinct from real integration validation, which
remains NOT RUN on this machine. Compile failure is not KILL; ambiguous runtime
failure is INCONCLUSIVE. Custom oracles now require reviewed corpus provenance.

## Dùng trên giao diện

- Đổi ngôn ngữ bằng bộ chọn góc trên bên phải. Lựa chọn được nhớ trong trình duyệt; không đổi nội dung đề bài, code, đầu vào/đầu ra hay ngắt lượt chạy đang hoạt động.
- Chọn **Chạy thực tế / Live playground**, rồi chọn **Ngôn ngữ lập trình / Code language** dưới trình soạn code. Dán code đúng ngôn ngữ đã chọn: bộ chọn không tự chuyển đổi mã nguồn.
- Mở **Hệ thống / System** để xem môi trường nào sẵn sàng. Máy hiện tại chưa có Docker hoặc nhà cung cấp mô hình được cấu hình, nên chạy thực tế chưa khả dụng; minh họa vẫn dùng được.

## Translation coverage

12 interface locales: `en`, `vi`, `es`, `fr`, `de`, `pt`, `ja`, `ko`, `zh`, `ar`, `hi`, `ru`. English is the source catalogue; Vietnamese covers the principal pages and setup/error copy. The other ten have curated core-control translations, with a visible notice that advanced untranslated text falls back to English. Translation is local, with no external translation service or transmission of source code.

`web/src/i18n.tsx` manages the locale, browser-language detection, storage, document `lang`/`dir`, fallback and number formatting. UI strings call `t()` during React rendering. Locale changes do not change component keys, route IDs, API enum values or persisted benchmark evidence. Arabic uses RTL layout, while code and output retain LTR direction. Native language names make the selector usable after an accidental language change.

Extend `locales` and the dictionaries in `web/src/locales/` to add languages. `vi.json` uses English source messages as keys; `international.js` documents its column order. `catalogue.json` is a migration inventory, not an authoritative list of translated messages. Dates and primary summary metrics use the chosen locale; technical trace numbers retain invariant formatting.

## Supported source profiles

| ID | Runtime/profile | File / entry point |
|---|---|---|
| python | Existing Python sandbox | main.py |
| c | GCC, C17 | main.c |
| cpp | G++, C++17 | main.cpp |
| javascript | Node.js, CommonJS | main.js |
| typescript | Debian TypeScript compiler → Node.js, CommonJS, ES2020 | main.ts |
| java | Debian default JDK | Main.java, public class Main |
| go | Debian Go compiler | main.go, package main |
| rust | rustc, edition 2021 | main.rs |
| csharp | Mono mcs/runtime | Main.cs, static Main |
| ruby | Ruby interpreter | main.rb |
| php | PHP CLI | main.php |

These are explicit adapters, not “all programming languages.” Only single-file console programs are supported. No package downloads, network, interactive judging or project builds. Runtime versions come from the built Debian image, not the newest language release or a claim of exact Codeforces compiler parity. TypeScript does not bundle external Node type packages: declare required Node globals locally (see the integration-test example).

Generators, custom validators and the three reference solutions remain Python and continue using the original sandbox. The target language is validated against the shared registry, included in the prompt and stored in job summaries and attempt evidence. Historical Python/PyPy corpus labels normalize to Python; the Python prompt contract and official benchmark split rules remain intact. Non-Python demo or benchmark requests are rejected.

## Enable execution

Install/start Linux Docker, then build both images:

```sh
docker build -t ai-falsifier-python:local sandbox
docker build -f sandbox/Dockerfile.multilang -t ai-falsifier-multilang:local sandbox
```

The first image executes Python generators, validators, references and targets. The second handles the ten additional target languages. `FALSIFIER_MULTILANG_IMAGE` optionally selects a different multi-language image tag. Configure `FALSIFIER_CONFIG` and `FALSIFIER_API_KEY` as described in `WEB_INTEGRATION.md`, restart the server, and refresh System. A language is available only when the relevant image can be inspected on a Linux Docker daemon; this health check is not a compiler certification.

Every execution stays in a fresh non-root Docker container with no network or host mounts, read-only root, dropped capabilities, no-new-privileges, process/memory limits and bounded output. The multi-language image adds a 256 MiB executable tmpfs at `/work` for compiler outputs. `/tmp` remains non-executable. There is no host execution fallback.

Live playground checks Python syntax or compiles/checks the other languages **before model calls**. Python preflight invokes trusted `compile()` on hex-encoded source data inside the original sandbox, without executing that source. Compilation/syntax failures end the job, expose bounded diagnostics to its user, and never count as algorithmic kills. Compiled targets are rebuilt in each fresh candidate container: up to 20 seconds for compilation, 30 seconds for target execution, plus the existing 1 GiB memory limit. Tool failure and reserved failure codes cannot create correctness kills. Time/memory/output failures remain inconclusive. There is no shared build cache across untrusted targets.

## Verification

```sh
npm test
npm run build
# Requires the app running on localhost:4173 and Chrome:
npm run test:e2e
npm run test:languages
```

`test:languages` checks all 12 locale selections, persistence, source/input preservation, switching language during an SSE run, selected-language API payload, unavailable-runtime state and mobile RTL navigation. Screenshots/results are written to `artifacts/`.

Real runtime checks require the built images. In PowerShell:

```powershell
$env:FALSIFIER_DOCKER_TEST='1'
$env:FALSIFIER_MULTILANG_TEST='1'
npm test
```

The multi-language integration test covers stdin/stdout for all ten additional languages plus compilation errors, timeout and read-only isolation. Both Docker integration tests are skipped by default. **Docker is absent from this development machine; no actual compiler/container test or paid model call was performed here.** Unit/API and browser checks do not substitute for those integration checks. The server continues to bind to loopback; localization does not publish the service on the public internet.
