# Security and private data

This prototype is intended for local, single-user use. It is not ready to be exposed
as a public multi-tenant execution service.

Report suspected vulnerabilities privately to the repository owner. Do not include
credentials, private source code or exploitable infrastructure details in public issues.

## Boundaries

- Keep the API bound to loopback until authentication, authorization, queueing and
  resource isolation have been independently reviewed.
- Untrusted source runs only inside disposable Docker containers. No host fallback.
- Real sandbox integration was not executed on the original development machine.
  A successful build or mocked test is not a sandbox security audit.
- Never commit `.env*`, private provider settings, corpus submissions or result logs.
- Model calls transmit the target source and problem text to the configured provider;
  evaluate whether that is appropriate before submitting confidential code.
- Cost reservations persist by configuration identity and survive process restarts.
  Uncertain billing blocks further calls until operator reconciliation. A changed
  configuration has a separate ledger: keep an independent provider account cap.
- Corpus plugins are trusted reviewed host code with hash-bound dependency manifests.
  They are not sandboxed uploads. Never approve downloaded or generated code as a
  trusted plugin without reviewing its complete behavior and dependency closure.
- Evidence seals detect drift, not malicious privileged rewriting. Human approvals
  and real Docker/provider validation remain external requirements.

See [the roadmap](docs/ROADMAP.md) for known reliability and operational work.
