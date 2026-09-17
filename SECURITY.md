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
- Current cost accounting is process-local; restarting the server resets its counter.
  Do not treat it as a durable spending cap.

See [the roadmap](docs/ROADMAP.md) for known reliability and operational work.
