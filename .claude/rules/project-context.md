# aws-dashboard — Project Context

- **Purpose**: Local-only AWS monitoring dashboard — a read-only proxy over the AWS SDK for inspecting account resources.
- **Stack**: Next.js (dev server :3000)
- **Repo layout**: flat; commands run from repo root

## Quirks
- **LOOPBACK ONLY**: must never bind `0.0.0.0`, be tunneled, or exposed — it proxies live AWS credentials. Keep it on localhost.
- API routes are a **read-only AWS proxy**: only `List*` / `Describe*` / `Get*` calls are allowed — never add mutating AWS calls.
- Reads credentials/profiles from `~/.aws/config` — no credentials are stored in the repo or env files.
- Vitest with a **90% coverage** threshold.
