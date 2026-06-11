# Testing & Quality Gates — Next.js / Vitest (aws-dashboard)

## Frameworks

- **Vitest** with jsdom + React Testing Library (`@testing-library/react`, `jest-dom`, `user-event`); coverage via `@vitest/coverage-v8`.
- Config: `vitest.config.ts` at repo root (uses `vite-tsconfig-paths` for the `@/*` alias).
- Never hit real AWS in tests — mock the SDK clients / `createClient` from `src/lib/aws-clients.ts` and the `~/.aws/config` parser.
- For API route tests, cover the fan-out behavior: one failing profile must not break the whole response.

## Commands

```bash
npm run test              # vitest run — all tests
npm run test:watch        # watch mode
npm run test:coverage     # vitest run --coverage — QA GATE
npm run lint              # eslint — QA GATE
npx vitest run src/path/to/file.test.ts        # single file
npx vitest run -t "test name substring"        # single test
```

## Coverage

- **90%** lines / functions / branches / statements, enforced by `coverage.thresholds` in `vitest.config.ts`. **The vitest config is the source of truth.**
- Never lower the thresholds to make a build pass. If coverage drops, add tests.

## Quality Gates (work is NOT done until all pass)

1. `npm run test` — all tests green
2. `npm run lint` — zero errors
3. `npm run test:coverage` — **90%** lines/functions/branches/statements, enforced by `vitest.config.ts`
