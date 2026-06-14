# Node.js — Run Locally (NestJS, Next.js, React)

## Detection
File: `package.json`

Distinguish by reading `package.json` dependencies:
- `@nestjs/core` → NestJS
- `next` → Next.js
- `react` (no next) + `vite` → React (Vite)
- `react` (no next, no vite) → React (CRA)
- Otherwise → generic Node

## Pre-flight
Check `node_modules/` exists. If missing, run `npm install` before build.

```bash
[ -d "node_modules" ] || npm install
```

---

## NestJS

### Build
```bash
npm run build
```
Success signal: `Successfully compiled` or exit 0
Output: `dist/` directory created

### Test
```bash
npm test -- --passWithNoTests
```
Success: `Tests: X passed`
Failure: `Tests: X failed`

### Run
```bash
npm run start:dev
```
Startup signal: `Application is running on` or `Listening on port`
Port: 3000 (or read from `src/main/ts/main.ts` → `app.listen(...)`)
Log file: `/tmp/run-locally-nestjs.log`

---

## Next.js

### Build
```bash
npm run build
```
Success signal: `Route (app)` table appears, exit 0

### Test
```bash
npm test -- --passWithNoTests 2>/dev/null || npm run test:ci 2>/dev/null || echo "NO_TESTS"
```

### Run
```bash
npm run dev
```
Startup signal: `Local:` or `ready started server`
Port: 3000 (or next.config.js `port`)
Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`

---

## React (Vite)

### Build
```bash
npm run build
```
Success signal: `built in`

### Test
```bash
npm test -- --passWithNoTests 2>/dev/null || echo "NO_TESTS"
```

### Run
```bash
npm run dev
```
Startup signal: `Local:   http://localhost:`
Port: 5173 (Vite default) — read from `vite.config.*` if present

---

## React (Create React App)

### Build
```bash
npm run build
```
Success signal: `The build folder is ready`

### Test
```bash
CI=true npm test
```

### Run
```bash
npm start
```
Startup signal: `Compiled successfully`
Port: 3000
