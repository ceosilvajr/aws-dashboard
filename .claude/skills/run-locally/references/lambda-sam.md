# Lambda / SAM — Run Locally

## Detection
Files: `template.yml` or `serverless.yml`

## Pre-flight
Docker must be running (SAM local invoke uses Docker):
```bash
docker ps >/dev/null 2>&1 || (echo "Docker daemon required — run: open -a Docker" && exit 1)
```

AWS credentials must be configured:
```bash
aws sts get-caller-identity 2>&1 | grep -q "Account" || echo "WARNING: no AWS credentials — some functions may fail"
```

---

## Build
```bash
sam build
```
Success signal: `Build Succeeded`
Failure signal: `Build Failed` — shows which resource failed

For Kotlin/JVM Lambda (e.g., majinbuu), SAM build calls `./gradlew shadowJar` internally. If it fails, check `./gradlew shadowJar` first to get the full error.

## Test

For **JVM Lambda** (Kotlin):
```bash
./gradlew test
```

For **Node Lambda**:
```bash
npm test
```

For **Python Lambda**:
```bash
pytest tests/ --tb=short 2>/dev/null || echo "no tests found"
```

Success signal: stack-appropriate test output.

## Run

Two modes — choose based on what the Lambda does:

### HTTP API (API Gateway emulator)
```bash
sam local start-api --port 3000
```
Startup signal: `Running on http://127.0.0.1:3000`
Test: `curl http://localhost:3000/<your-path>`

### Single function invoke
```bash
sam local invoke <FunctionName> -e events/sample.json
```
Replace `<FunctionName>` with the logical name from `template.yml`.
If no event file exists, create a minimal one:
```json
{}
```

### Which mode to use?
- Template has `Events:` with type `Api` or `HttpApi` → use `start-api`
- Template has `Events:` with type `DynamoDB`, `S3`, `SQS`, etc. → use `invoke` with a sample event
- No `Events:` → use `invoke`

Read `template.yml` to determine the event type before choosing.

## Port
`start-api` default: **3000**
Override: `--port <N>`

## Environment variables
SAM local passes `--env-vars env.json` for local overrides. Check if `env.json` or `.env.local` exists:
```bash
[ -f "env.json" ] && ENV_FLAG="--env-vars env.json"
sam local start-api $ENV_FLAG --port 3000
```

## Startup signal
`Running on http://127.0.0.1:3000` (start-api) or function output JSON (invoke)
