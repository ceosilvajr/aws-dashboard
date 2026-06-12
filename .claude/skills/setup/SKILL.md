---
name: setup
description: "Run /setup to take a developer from a fresh clone to a running app on their machine — independently, without needing a teammate. Stages: environment health check (tools, GitLab creds, superpowers skills) → install dependencies → configure env files (flags exactly which secret values to request from the team lead) → start local backing services (DynamoDB local, PostgreSQL/Redis) → code generation → build/test verification → run the app and smoke-check its health endpoint. Trigger immediately when the user types /setup, 'onboard me', 'set up this project', 'first time setup', 'check my env', 'am I set up?', or 'help me run this locally for the first time'."
---

# Project Setup — Fresh Clone to Running App

Take the developer through seven stages. Stop and report at any stage that fails after fixes were offered; otherwise continue automatically to the next. The goal is **the app running locally** (or, for Lambda repos, the test suite green), with a clear checklist of anything that still needs a human.

**Two rules above all:**
1. **Never invent or guess secret values.** When an env var needs a real credential, name it, say where it comes from (team lead, AWS console, Alchemy, …), and leave it for the developer.
2. **Never print secret values** back into the conversation — confirm them as "set" only.

---

## STAGE 0 — Identify the project

```bash
basename "$PWD"; git branch --show-current
```

Read `.claude/rules/project-context.md` (purpose, port, prefix, quirks) and `.claude/rules/testing.md` (verification commands). Detect the stack from manifest files:

```bash
[ -f "build.gradle.kts" ] && echo "STACK:kotlin"
[ -f "package.json" ] && echo "STACK:nodejs"
{ [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; } && echo "STACK:python"
[ -f "composer.json" ] && echo "STACK:php-laravel"
[ -f "pubspec.yaml" ] && echo "STACK:flutter"
[ -f "hardhat.config.ts" ] && echo "STACK:hardhat"
{ [ -f "template.yml" ] || [ -f "template.yaml" ]; } && echo "STACK:lambda-sam"
```

---

## STAGE 1 — Environment health check

Run the three checks **in parallel**, then print the health report (format below):

1. **Superpowers skills** — verify the plugin's key skills exist:
   ```bash
   SUPERPOWERS_BASE=$(ls -d ~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills 2>/dev/null | tail -1)
   for skill in brainstorming writing-plans using-git-worktrees test-driven-development executing-plans systematic-debugging dispatching-parallel-agents requesting-code-review receiving-code-review verification-before-completion finishing-a-development-branch; do
     [ -f "$SUPERPOWERS_BASE/$skill/SKILL.md" ] && echo "OK: $skill" || echo "MISSING: $skill"
   done
   ```
2. **VCS credentials** — `ANALITIKA_GITLAB_TOKEN` set (test against `https://gitlab.com/api/v4/user`, never print it), `glab` installed and authenticated.
3. **Stack prerequisites** — run the "Checks" block for the detected stack from `references/stacks.md` (Java 21, Node 20, Python 3.10+, PHP 8.2, Flutter SDK, Docker daemon, AWS profile `digigov-master`, …).

For every ❌, offer the fix from the Fix Commands table (bottom of this file) interactively: `Run this now? [y/n/skip-all]`. Re-check after each accepted fix.

---

## STAGE 2 — Install dependencies

Run the "Install" block for the stack from `references/stacks.md` (e.g. `npm install`, `python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt`, `composer install`, `flutter pub get`, `./gradlew build -x test`). Report what was installed and any failures.

---

## STAGE 3 — Environment files (the human-dependency stage)

1. Find the example file: `.env.example`, `env.example`, or per-org files (broly: `config/env/.env.*`). If a `.env` is required and absent, copy the example.
2. Parse the copied file for **empty values** and classify each var:
   - **Derivable** — generate locally (`php artisan key:generate`, `npm run generate-wallet -- --save`) or safe defaults documented in `references/stacks.md`. Fill these.
   - **Secret / external** — API keys, upstream URLs, Cognito pool IDs. **Do not fill.** Collect into the "request from team lead" list.
3. **Empty-value trap (Laravel especially):** an empty `VAR=` line is NOT the same as an unset var — it overrides framework defaults with `""` and can break boot (e.g. `APP_TIMEZONE=`). Either fill a sane value or delete the empty line; never leave required vars empty.
4. Check the project quirks in `rules/project-context.md` for extra env needs (krillin `MAPS_API_KEY` + `./tools/setup-ios-maps.sh` for iOS; broly crashes at startup without its dotenv files).

---

## STAGE 4 — Local backing services

Start what the stack needs (details + exact commands in `references/stacks.md`):

| Stack | Services |
|---|---|
| NestJS | DynamoDB local on :8000 + `npm run create-table` (+ seeds where defined) |
| Laravel (bulma) | DynamoDB local on :7100 + `database/dynamodb/create-tables.sh` |
| FastAPI (bordock) | `make -f Makerfile start` — PostgreSQL + Redis + API via docker compose |
| FastAPI (pan), Flutter, Next.js, Hardhat, Kotlin | none required for local dev/tests |

Docker must be running for any of these — that was checked in Stage 1.

---

## STAGE 5 — Code generation (Flutter only)

krillin: `flutter packages pub run build_runner build --delete-conflicting-outputs`. broly: `make gen`. Skip silently for other stacks.

---

## STAGE 6 — Verify build + tests

Run the project's QA commands from `.claude/rules/testing.md` (build, lint, tests). **Pre-existing test debt does not block onboarding** — if `project-context.md` marks the suite as under repair (krillin), run what works (`dart analyze`) and note the rest. Report pass/fail per command.

---

## STAGE 7 — Run it

Invoke the **run-locally** skill (`.claude/skills/run-locally/`) — it knows the stack's run command, port, startup signal, and health endpoint. Then smoke-check:

```bash
curl -s http://localhost:<port><prefix>/health | head -1
```

For Kotlin Lambda repos there is no server — a green `./gradlew test` from Stage 6 is the success state. For Flutter, a successful run on a connected device/simulator (krillin via `./tools/run.sh`, broly via `make run-scpl`) is the success state.

---

## Final report

```
╔══════════════════════════════════════════════╗
║            PROJECT SETUP — <name>            ║
╚══════════════════════════════════════════════╝
Stage 1  Environment      ✅ (or: ❌ 2 issues, 1 fixed)
Stage 2  Dependencies     ✅
Stage 3  Env files        ⚠️ 3 values needed from team lead
Stage 4  Local services   ✅ dynamodb-local :8000
Stage 5  Codegen          — (n/a)
Stage 6  Build + tests    ✅ lint clean · 120 tests green
Stage 7  Running          ✅ http://localhost:3000/mr-pogi/health → UP

📋 ASK YOUR TEAM LEAD FOR:
  1. CHAT_API_KEY        (.env — upstream chat gateway key)
  2. ...

📋 REMAINING MANUAL STEPS:
  1. ...

STATUS: READY TO DEVELOP / BLOCKED ON <n> ITEMS
```

Use ✅ pass, ❌ fail, ⚠️ needs a human. Warnings are reported, never auto-fixed.

---

## Fix commands reference

| Failure | Fix |
|---------|-----|
| `ANALITIKA_GITLAB_TOKEN` not set | `echo 'export ANALITIKA_GITLAB_TOKEN=<your-token>' >> ~/.zshrc && source ~/.zshrc` (ask for the value — never invent) |
| glab missing / unauthenticated | `brew install glab` / `glab auth login` |
| Java missing or <21 | `brew install --cask temurin21` + set `JAVA_HOME` |
| Node missing / <20 | `brew install node@20` or `nvm install 20` |
| pnpm <9 (goku) | `npx -y pnpm@9 <command>` or `corepack enable && corepack prepare pnpm@9 --activate` |
| Python <3.10 | `brew install python@3.11` |
| PHP <8.2 / Composer missing | `brew install php@8.2` / `brew install composer` |
| pcov missing (bulma coverage) | `pecl install pcov && docker-php-ext-enable pcov` (or `extension=pcov` in php.ini) |
| Flutter missing | https://docs.flutter.dev/get-started/install |
| Docker not running / missing | `open -a Docker` / `brew install --cask docker` |
| AWS profile missing | `aws configure --profile digigov-master` (region `ap-southeast-1`) |
| SAM missing | `brew install aws-sam-cli` |
| `./gradlew` not executable | `chmod +x ./gradlew` |

---

## Scope notes

- Treats the **current working directory** as the project root; in a multi-stack repo, runs every detected stack's checks.
- Stage 6 runs the gate commands once for verification — it is not a substitute for the QA pipeline.
- Tooling and auth checks live here; per-stack install/env/service/run detail lives in `references/stacks.md` and the `run-locally` skill.
