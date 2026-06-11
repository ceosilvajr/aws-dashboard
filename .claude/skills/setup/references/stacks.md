# Stack-Specific Setup Checks

Run these commands for each detected stack. Capture output and interpret as PASS / FAIL / WARN.

---

## Kotlin / Ktor / JVM (`build.gradle.kts`)

```bash
# Java version — must be 21+
java -version 2>&1

# Gradle wrapper present and executable
ls -la ./gradlew 2>/dev/null

# Gradle works (this also compiles the build script)
./gradlew --version 2>&1 | head -8

# Docker daemon running (needed for docker-dev-build-run.sh)
docker info --format 'Docker {{.ServerVersion}}' 2>/dev/null || echo "DOCKER_DOWN"

# AWS profile digigov-master (needed for local Cognito/DynamoDB)
aws configure list --profile digigov-master 2>&1 | grep -E "region|access_key"

# kover threshold (read from build file)
grep -A 5 "minBound\|fail_under\|line.*=" build.gradle.kts 2>/dev/null | head -5
```

**Interpret results:**
- Java `openjdk version "21.*"` → ✅; lower → ❌; higher → ✅
- `./gradlew` exists + executable → ✅; not found → ❌
- Gradle outputs version → ✅; error → ❌
- Docker outputs version → ✅; `DOCKER_DOWN` → ❌ (warn: needed for `docker-dev-build-run.sh`)
- AWS profile shows `ap-southeast-1` → ✅; shows `<not set>` → ⚠️ (can still run unit tests without it)
- kover threshold found → show it informatively; not found → info only

---

## Node.js / TypeScript / NestJS (`package.json`)

```bash
# Node version — must be 18+
node --version 2>&1

# npm version
npm --version 2>&1

# Dependencies installed?
ls node_modules/.bin 2>/dev/null | wc -l

# Check scripts available
node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).join(','))" 2>/dev/null
```

**Interpret results:**
- Node `v18.*` or higher → ✅; lower → ❌
- `node_modules/.bin` has entries → ✅; empty/missing → ❌ "run `npm install`"
- Scripts include `start:dev`, `test` → ✅; missing → ⚠️

---

## Python / FastAPI (`pyproject.toml` or `requirements.txt`)

```bash
# Python version — must be 3.10+
python3 --version 2>&1

# pip or uv available
pip3 --version 2>/dev/null || uv --version 2>/dev/null || echo "NO_PACKAGE_MANAGER"

# Virtual env active?
echo "${VIRTUAL_ENV:-NOT_ACTIVE}"

# Makefile targets (bordock uses make)
[ -f "Makefile" ] && make -n start 2>/dev/null | head -3 || echo "NO_MAKEFILE"
```

**Interpret results:**
- Python 3.10+ → ✅; lower → ❌; missing → ❌
- pip or uv found → ✅
- VIRTUAL_ENV set → ✅; NOT_ACTIVE → ⚠️ "activate your venv: `source .venv/bin/activate`"
- Makefile with `start` target → ✅; missing → info only

---

## PHP / Laravel (`composer.json`)

```bash
# PHP version — must be 8.2+
php --version 2>&1 | head -1

# Composer
composer --version 2>&1 | head -1

# Vendor dir installed?
ls vendor/autoload.php 2>/dev/null && echo "VENDOR_OK" || echo "VENDOR_MISSING"

# Laravel artisan available?
php artisan --version 2>/dev/null | head -1

# .env file exists?
ls .env 2>/dev/null && echo "ENV_OK" || echo "ENV_MISSING"
```

**Interpret results:**
- PHP 8.2+ → ✅; lower → ❌
- Composer found → ✅; missing → ❌
- `VENDOR_OK` → ✅; `VENDOR_MISSING` → ❌ "run `composer install`"
- `.env` exists → ✅; missing → ⚠️ "copy `.env.example` to `.env`"

---

## Dart / Flutter (`pubspec.yaml`)

```bash
# Flutter SDK
flutter --version 2>&1 | head -3

# Dart version
dart --version 2>&1

# Flutter doctor (machine-readable)
flutter doctor 2>&1 | grep -E "^\[|✓|✗|!"

# Pub deps installed?
ls .dart_tool/package_config.json 2>/dev/null && echo "DEPS_OK" || echo "DEPS_MISSING"
```

**Interpret results:**
- Flutter found with version → ✅; missing → ❌
- Flutter doctor ✓ lines → ✅; ✗ lines → ❌ with the specific failure shown
- `.dart_tool/package_config.json` exists → ✅; missing → ❌ "run `flutter pub get`"

---

## Lambda / SAM (`template.yml` or `serverless.yml`)

```bash
# AWS CLI
aws --version 2>&1

# SAM CLI
sam --version 2>&1

# Docker (needed for sam local invoke)
docker --version 2>&1

# Active AWS credentials
aws sts get-caller-identity 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Account: {d['Account']} ARN: {d['Arn']}\")" 2>/dev/null || echo "NO_CREDS"
```

**Interpret results:**
- AWS CLI v2 → ✅; v1 → ⚠️; missing → ❌
- SAM CLI found → ✅; missing → ❌ "brew install aws-sam-cli"
- Docker running → ✅; not running → ⚠️ "needed for `sam local invoke`"
- `Account: ...` → ✅; `NO_CREDS` → ❌ "run `aws configure` or export AWS_PROFILE"
