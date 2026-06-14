# Kotlin / Ktor — Run Locally

## Detection
File: `build.gradle.kts`

## Commands

### Build
```bash
./gradlew build -x test   # compile + shadowJar, skip tests (tests run in Step 3)
```
Success signal: `BUILD SUCCESSFUL`
Failure signal: `BUILD FAILED` or `error:` lines

### Test
```bash
./gradlew test
```
Success signal: `BUILD SUCCESSFUL` + `X tests completed`
Failure signal: `X tests failed` or `FAILED`
Coverage check (optional, non-blocking):
```bash
./gradlew koverLog 2>/dev/null | grep -E "line coverage"
```

### Run

**Option A — Gradle (no Docker needed, no live AWS):**
```bash
./gradlew run
```
Startup signal: `Application started` or `Responding at http`
Port: 8082 (read from `src/main/resources/application.yaml` → `ktor.deployment.port`)
Log file: `/tmp/run-locally-piccolo.log`

**Option B — Docker with AWS profile (full local environment):**
```bash
./docker-dev-build-run.sh --aws-profile digigov-master
```
Use Option B when:
- `./docker-dev-build-run.sh` exists and is executable (`[ -x docker-dev-build-run.sh ]` succeeds)
- Docker daemon is running (`docker ps` succeeds)
- User needs live AWS services (Cognito, S3, DynamoDB)
- `.env.dev` exists

Use Option A otherwise (faster, no Docker needed for unit development).

Offer the choice if Docker is running and the script exists:
```
Run mode:
  [1] Gradle only  (fast, no Docker, no live AWS) ← default
  [2] Docker + AWS  (full environment, requires Docker + digigov-master profile)
```

### Port
Default: **8082**
Override: check `src/main/resources/application.yaml` → `ktor.deployment.port`

### Startup log signal
Watch for: `Application started in` or `Responding at http://0.0.0.0:8082`

### Health check (verify it's up)
```bash
curl -s http://localhost:8082/piccolo/health | head -1
```
Expected: `{"status":"UP"}` or `200 OK`
