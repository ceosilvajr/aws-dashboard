# Stack-Specific Setup: Checks, Install, Env, Services, Run

For each detected stack: run **Checks** in Stage 1, **Install** in Stage 2, **Env** in Stage 3, **Services** in Stage 4, and hand **Run** to the `run-locally` skill in Stage 7. Interpret check output as ✅ PASS / ❌ FAIL / ⚠️ WARN.

---

## Kotlin / Ktor / JVM (`build.gradle.kts`)

### Checks
```bash
java -version 2>&1                                    # must be 21+
ls -la ./gradlew 2>/dev/null                          # wrapper present + executable
./gradlew --version 2>&1 | head -8
docker info --format 'Docker {{.ServerVersion}}' 2>/dev/null || echo "DOCKER_DOWN"
aws configure list --profile digigov-master 2>&1 | grep -E "region|access_key"
```
- Java 21+ → ✅; lower → ❌. Docker down → ⚠️ (only needed for `docker-dev-build-run.sh`). AWS profile `<not set>` → ⚠️ (unit tests still work without it).

### Install
```bash
./gradlew build -x test     # resolves deps + compiles; BUILD SUCCESSFUL = ✅
```

### Env
- All env vars use the `KTOR_` prefix; defaults work for unit development. Live AWS (Cognito/DynamoDB) needs the `digigov-master` profile and, where present, `.env.dev` (values from team lead).

### Services
None required for `./gradlew run` / tests.

### Run
Ktor services: `./gradlew run` (port from `src/main/resources/application.yaml`; see `rules/project-context.md`), or full env: `./docker-dev-build-run.sh --aws-profile digigov-master`. Health: `curl http://localhost:<port>/<prefix>/health`.
**Kotlin Lambda repos (`backend/lambda/*`): no local server** — success state is `./gradlew test` green; some repos have SAM scripts for local invoke.

---

## Node.js / TypeScript / NestJS (`package.json` with `@nestjs/*`)

### Checks
```bash
node --version 2>&1          # 20+
npm --version 2>&1
ls node_modules/.bin 2>/dev/null | wc -l    # 0/missing → run npm install
node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join(','))"
docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_DOWN   # needed for dynamodb-local
```

### Install
```bash
npm install
```

### Env
Copy `env.example`/`.env.example` → `.env` if present. Local dev needs `DYNAMODB_LOCAL=true` (and table name vars — see the service's CLAUDE.md). JWT/Cognito secrets → team lead list.

### Services
```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local
npm run create-table                 # idempotent, where the script exists
npm run seed-permissions             # mr-pogi only
```

### Run
`npm run start:dev` → health: `curl http://localhost:3000/<prefix>/health`.
Quirk: cell and trunks wrap jest via `node scripts/run-jest.cjs` — always use npm scripts.

---

## Python / FastAPI (`pyproject.toml` / `requirements.txt`)

### Checks
```bash
python3 --version 2>&1               # 3.10+
echo "${VIRTUAL_ENV:-NOT_ACTIVE}"    # info only — we use .venv explicitly
docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_DOWN   # bordock only
```

### Install
```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt    # includes requirements.txt via -r
```

### Env
- **pan**: copy `.env.example` → `.env`. `CHAT_API_URL` + `CHAT_API_KEY` → team lead list (app boots without them; chat returns the fallback message until set).
- **bordock**: settings have working local defaults (`app/core/config.py`); docker compose provides DB/Redis env.

### Services
- **pan**: none.
- **bordock**: `make -f Makerfile start` (the makefile is literally named `Makerfile`) — starts PostgreSQL + Redis + API. `make -f Makerfile migrate` then `make -f Makerfile seed-all` for data.

### Run
- **pan**: `.venv/bin/uvicorn main:app --reload` → `curl http://localhost:8000/pan/health`.
- **bordock**: already running via compose → `curl http://localhost:8123/api/v1/health`.

---

## PHP / Laravel (`composer.json`)

### Checks
```bash
php --version 2>&1 | head -1         # 8.2+
composer --version 2>&1 | head -1
ls vendor/autoload.php 2>/dev/null && echo VENDOR_OK || echo VENDOR_MISSING
ls .env 2>/dev/null && echo ENV_OK || echo ENV_MISSING
php -m | grep -i pcov || echo "PCOV_MISSING (coverage gate needs it)"
docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_DOWN
```

### Install
```bash
composer install
```

### Env
```bash
cp .env.example .env && php artisan key:generate
```
Then fill the derivable values — **bulma boots only when these are non-empty**:
- `ORG_ID` → one of `LGU_JAEN_NUEVA_ECIJA` | `PL_SENIOR_CITIZENS` (ask which org the dev works on)
- `AWS_CONNECTION=local`, `AWS_REGION=ap-southeast-1`, `APP_TIMEZONE=UTC`
- **Delete every remaining empty `VAR=` line** — empty strings override Laravel defaults and crash boot.
Team-lead list: `PICCOLO_BASE_URL`, `FILE_UPLOAD_ENDPOINT`/`FILE_UPLOAD_API_KEY`, `ENCRYPTION_KEY`, `ORG_*` table names for shared envs.

### Services
```bash
docker run -d -p 7100:8000 --name dynamodb-local amazon/dynamodb-local
cd database/dynamodb && ./create-tables.sh http://localhost:7100
```

### Run
`php artisan serve` → `curl http://localhost:8000/bulma/api/v1/...` (prefix `bulma/api/v1`). Tests need no DB (phpunit.xml provides the test env).

---

## Dart / Flutter (`pubspec.yaml`)

### Checks
```bash
flutter --version 2>&1 | head -3
flutter doctor 2>&1 | grep -E "^\[|✓|✗|!"
ls .dart_tool/package_config.json 2>/dev/null && echo DEPS_OK || echo DEPS_MISSING
```

### Install
```bash
flutter pub get
```

### Env
- **krillin**: `.env` with `MAPS_API_KEY=<key>` (team lead / Google Cloud console). iOS additionally: `./tools/setup-ios-maps.sh`, then `./tools/clean-ios-config.sh`.
- **broly**: `config/env/.env.staging`, `.env.scpl.prod`, `.env.ejaen.prod` — **all values from team lead; the app crashes at startup without them.**

### Services
None.

### Codegen (Stage 5 — mandatory before first run)
- krillin: `flutter packages pub run build_runner build --delete-conflicting-outputs`
- broly: `make gen`

### Run
- krillin: `./tools/run.sh android staging` (or ios) — never raw `flutter run`.
- broly: `make run-scpl` / `make run-ejaen` — `--flavor` and `--dart-define=ORG` must always travel together; the make targets guarantee it.
Success state: app boots on a connected device/simulator (`flutter devices` to list).

---

## Next.js (`next.config.*`)

### Checks
```bash
node --version 2>&1                  # 20+
# goku only — workspace pins pnpm >= 9:
pnpm --version 2>/dev/null || echo "PNPM_MISSING"
```

### Install
- **goku**: `npx -y pnpm@9 install` (or corepack-activated pnpm 9).
- **aws-dashboard**: `npm install`.

### Env
- **goku**: per app, copy `.env.local.example` → `.env` with `NEXT_PUBLIC_COGNITO_REGION` / `USER_POOL_ID` / `WEB_CLIENT_ID` → team lead list.
- **aws-dashboard**: no .env — reads `~/.aws/config` profiles directly (Stage 1 AWS check covers it). **LOCAL ONLY — never bind 0.0.0.0 or tunnel.**

### Services
None.

### Run
- goku: `npx -y pnpm@9 dev-console` (3001) / `dev-internal` (3002) / `dev-website` (3000) → open the port.
- aws-dashboard: `npm run dev` → http://127.0.0.1:3000 (loopback only).

---

## Hardhat / Solidity (`hardhat.config.ts`)

### Checks
```bash
node --version 2>&1                  # 20+
ls node_modules/.bin/hardhat 2>/dev/null || echo DEPS_MISSING
ls .env 2>/dev/null && echo ENV_OK || echo ENV_MISSING
```

### Install
```bash
npm install
```

### Env
Copy `.env.example` → `.env`. `requireEnv()` in `hardhat.config.ts` throws at compile time if required vars are missing:
- `DEPLOYER_PRIVATE_KEY` — derivable: `npm run generate-wallet -- --save` (test wallet; never reuse a funded key)
- `POLYGON_AMOY_RPC_URL`, `ETHEREUM_SEPOLIA_RPC_URL` — team lead list (or free Alchemy/Infura app)
- Explorer/CoinMarketCap keys — optional, leave for later.

### Services
None — tests run on the in-process Hardhat Network, no testnet funds needed.

### Run
```bash
npm run compile && npm test          # success state: 4 tests green
```
Toolchain is pinned to Hardhat 2 / CommonJS — never upgrade during setup.

---

## Lambda / SAM (`template.yml` / `template.yaml`)

### Checks
```bash
aws --version 2>&1                   # v2
sam --version 2>&1
docker --version 2>&1                # needed for sam local invoke
aws sts get-caller-identity 2>&1 | grep -o '"Account": "[0-9]*"' || echo NO_CREDS
```
- `NO_CREDS` → ❌ "run `aws configure --profile digigov-master` and export `AWS_PROFILE`".
