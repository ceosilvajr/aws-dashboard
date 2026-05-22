# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `yarn dev` / `npm run dev` — start Next.js dev server on http://localhost:3000
- `yarn build` — production build
- `yarn lint` — ESLint (uses flat config in `eslint.config.mjs`, extends `eslint-config-next` core-web-vitals + typescript)
- No test runner is configured.

## Runtime prerequisites

The app reads AWS credentials from the **local machine's `~/.aws/config` and `~/.aws/credentials`** via `@aws-sdk/credential-providers`' `fromIni`. There is no auth layer in the app itself — every API route impersonates whatever profile is passed in. Profiles are discovered dynamically (any non-`default` profile in `~/.aws/config`). Profile naming is project-specific (e.g. `myproject-master`, `myproject-prod`, `myproject-dev`).

All AWS clients are constructed against a **single hardcoded region** in `src/lib/constants.ts` (`ap-southeast-1`). Any new client must use the same region or it will silently hit the wrong region.

## Architecture

### Per-service vertical slice

Every AWS service is wired as a vertical slice with three pieces that share the service name:

1. `src/app/api/<service>/route.ts` — App-Router handler that calls AWS SDK v3 and returns JSON. Most accept a `?profile=` query param; when absent they fan out across all accounts via `Promise.all(accounts.map(fetchAccountData))`.
2. (Optional) `src/app/api/<service>/detail/route.ts` — detail view for a single resource.
3. `src/components/sections/<service>-section.tsx` — client component that fetches the route and renders it. Registered in the `section === "..."` switch in `src/app/page.tsx` and in the sidebar nav.

When adding a new AWS service, replicate this triple plus add entries to `page.tsx` and `src/components/sidebar.tsx`.

### Account discovery

`src/lib/aws-config-parser.ts` is the source of truth for accounts. It:

- Reads `~/.aws/config` via `@smithy/shared-ini-file-loader`.
- Skips `sso-session` entries (those without `sso_account_id`).
- Extracts the account ID from `role_arn` or `sso_account_id`; falls back to a live `STS:GetCallerIdentity` call.
- Derives a `group` from the profile-name prefix before the first `-` (e.g. `myproject-prod` → `myproject`).
- Caches the result in module-scope; call `invalidateCache()` to clear.

`src/lib/accounts.ts` re-exports `getAccounts()` and `REGION` — most API routes import from here. Use `createClient(Ctor, profile, region?)` from `src/lib/aws-clients.ts` instead of constructing SDK clients by hand.

### Client-side state

Three independent contexts (not a single store):

- `ProfileContext` (`src/context/profile-context.tsx`) — the currently-selected single profile for per-account drill-down views.
- `NavContext` (`src/context/nav-context.tsx`) — which section is visible; the `section` string keys the switch in `page.tsx`.
- `AccountsContext` (`src/context/accounts-context.tsx`) — full account list (fetched from `/api/profiles`) plus the user's enabled groups, persisted in `localStorage` under `aws-dashboard-enabled-groups` (defaults to all discovered groups when no preference is stored).

`page.tsx` wraps the tree in `ProfileProvider` + `NavProvider` only; `AccountsProvider` is mounted separately where needed. Verify what's actually wrapping a component before assuming a context is available.

### UI conventions

- Tailwind CSS v4 (PostCSS plugin) — no `tailwind.config.*`; styles live in `src/app/globals.css`.
- shadcn/ui style `base-nova`, Lucide icons, `cn()` helper from `src/lib/utils.ts`. Path alias `@/*` → `src/*`.
- Dark mode via `next-themes` (`src/components/theme-provider.tsx`).

## Security constraints

**Local use only — do not deploy to a server or expose via any tunnel.** The app has no auth layer; every API route impersonates whatever AWS profile the caller names. The middleware (`src/middleware.ts`) enforces loopback-only access via Host and Origin header checks. The `dev` script binds to `127.0.0.1`. These must not be weakened.

**Read-only proxy.** All API routes call AWS `List*` / `Describe*` / `Get*` operations only. Do not add endpoints that create, update, or delete AWS resources.

## Things to watch for

- **Next.js 16.2.4 with React 19.** Several App Router / Server Component APIs differ from older versions. Per `AGENTS.md`, consult `node_modules/next/dist/docs/` before writing route or rendering code from memory.
- **No error boundaries in API routes** — most catch errors and return empty arrays or `{ error: string }`. When fanning out across accounts, one bad profile must not break the whole response; preserve this pattern.
- **Region is hardcoded.** For multi-region needs, plumb the region through `createClient`'s third argument rather than changing `constants.ts`.
- **Account list is cached in-process.** After editing `~/.aws/config` while the dev server is running, restart the server or call `invalidateCache()` — the cache survives across requests.
