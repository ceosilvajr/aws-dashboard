# Next.js Conventions (goku, aws-dashboard)

| Project | What it is | Repo |
|---------|-----------|------|
| goku | pnpm + Turborepo monorepo: 3 Next.js 16 apps + shared packages, Cognito auth | `frontend/goku/` |
| aws-dashboard | Local-only AWS monitoring dashboard (Next.js App Router), read-only AWS proxy | `frontend/aws-dashboard/` |

Shared stack: Next.js 16 (App Router) + React 19 Server Components + TypeScript 5 strict + Tailwind CSS 4 (no `tailwind.config.*`) + Lucide icons + `cn()` class merging. Path alias `@/*`.

## goku

```
apps/digigov-website   :3000   public marketing site (no auth)
apps/digigov-console   :3001   form management & LGU admin (Cognito)
apps/digigov-internal  :3002   internal staff services (Cognito)
packages/              @goku/{auth,ui,types,lib,utils,tsconfig}
```

```bash
pnpm install                       # first time
pnpm dev                           # all apps
pnpm dev-website / dev-console / dev-internal
pnpm lint                          # ESLint across monorepo (flat config)
pnpm build                         # production build, all apps
turbo run build --filter=digigov-console   # single app via turbo
npx tsc --noEmit                   # type check (run inside apps/<app>)
```

Env: each app needs `.env` with `NEXT_PUBLIC_COGNITO_REGION`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_USER_POOL_WEB_CLIENT_ID` (copy from `.env.local.example`).

Rules:
- Route layout in auth'd apps: `app/(auth)/` public, `app/(protected)/` requires login. `middleware.ts` redirects unauthenticated users to `/login` — keep matchers in sync when adding protected routes.
- Auth utilities come from `@goku/auth` only — never duplicate in apps. Server Components use `runWithAmplifyServerContext()`; client uses `getSession`/`isAuthenticated`/`signOut`.
- HTTP via `createApiClient()` from `@goku/lib/api-client` — do not hand-roll fetch wrappers.
- Shared code goes in packages, not copied across apps: components → `packages/ui` (`import { Button } from "@goku/ui/button"`), types → `@goku/types`, utils → `@goku/utils` (`cn()`). Cross-package deps use `workspace:^`.
- TypeScript strict mode: no implicit `any`; typed props interfaces. ESLint errors block the Amplify build — `pnpm lint` before declaring done.
- Cache problems: `pnpm clean && pnpm install && pnpm build`.

## aws-dashboard

```bash
yarn dev          # dev server, binds 127.0.0.1:3000
yarn lint         # ESLint
```

Hard security constraints — never weaken:
- **Local-only.** No auth layer; API routes impersonate whatever AWS profile is named. `src/middleware.ts` enforces loopback-only access (Host/Origin checks) and `dev` binds `127.0.0.1`. Never deploy, tunnel, or relax these.
- **Read-only AWS proxy.** API routes may call `List*` / `Describe*` / `Get*` operations only. Never add create/update/delete endpoints.

Conventions:
- Profiles come from `~/.aws/config` via `src/lib/aws-config-parser.ts` (cached in-process — restart dev server or `invalidateCache()` after editing the file). Import `getAccounts()`/`REGION` from `src/lib/accounts.ts`.
- Region is hardcoded in `src/lib/constants.ts` (`ap-southeast-1`); construct clients via `createClient(Ctor, profile, region?)` from `src/lib/aws-clients.ts`, never by hand.
- New AWS service = vertical slice triple: `src/app/api/<service>/route.ts` (+ optional `detail/route.ts`) + `src/components/sections/<service>-section.tsx`, then register in `page.tsx` switch and `src/components/sidebar.tsx`.
- Fan-out routes (`Promise.all` over accounts) must tolerate one bad profile without breaking the whole response — preserve the catch-and-return-empty pattern.
- Client state: three separate contexts (`ProfileContext`, `NavContext`, `AccountsContext`) — verify which provider wraps a component before using a context.
