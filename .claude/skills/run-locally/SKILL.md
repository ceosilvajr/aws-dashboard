---
name: run-locally
description: "Use this skill to build, test, and run any application locally. Auto-detects the project type (Kotlin/Ktor, NestJS, FastAPI, Laravel, Flutter, React/Next.js, AWS Lambda/SAM) from manifest files and runs the correct build → test → run sequence. Trigger immediately whenever the user types /run-locally, 'run this app', 'start the app locally', 'run it', 'start it', 'can you run this for me', 'launch the dev server', or anything implying they want the application running on their machine."
---

# Run Locally

Build, test, and start the application — in that order. If build fails, stop. If tests fail, ask before proceeding. Once running, show the server URL and tail output.

---

## Step 1 — Detect the stack

Read the current working directory's manifest files:

```bash
[ -f "build.gradle.kts" ] && echo "kotlin-ktor"
[ -f "pom.xml" ]           && echo "kotlin-jvm-maven"
[ -f "pubspec.yaml" ]      && echo "flutter"
[ -f "template.yml" ] || [ -f "serverless.yml" ] && echo "lambda-sam"
[ -f "composer.json" ]     && echo "php-laravel"
[ -f "pyproject.toml" ] || [ -f "requirements.txt" ] && echo "python"
[ -f "package.json" ]      && echo "nodejs"
```

For `nodejs`, further distinguish by reading `package.json`:
- `dependencies.next` or `devDependencies.next` → **nextjs**
- `dependencies.react` (no next) → **reactjs** (Vite or CRA)
- `dependencies.@nestjs/core` → **nestjs**
- Otherwise → generic Node

Read the stack-specific reference file for the exact commands:

| Stack | Reference |
|-------|-----------|
| `kotlin-ktor` | `references/kotlin-ktor.md` |
| `nestjs` | `references/nodejs.md` |
| `nextjs` | `references/nodejs.md` |
| `reactjs` | `references/nodejs.md` |
| `python` (FastAPI/bordock) | `references/python.md` |
| `php-laravel` | `references/php-laravel.md` |
| `flutter` | `references/flutter.md` |
| `lambda-sam` | `references/lambda-sam.md` |

If multiple manifests are found (monorepo), ask the user which service to run.

---

## Step 2 — Build

Run the build command from the reference file. Capture output and exit code.

**On success:**
```
✅ BUILD PASSED  (<time>)
```

**On failure:** print the relevant error lines (not the full log — find the `error:` or `FAILED` lines), then stop:
```
❌ BUILD FAILED

<error summary — 5–10 most relevant lines>

Fix the build errors before running.
```

Do not proceed to test or run after a build failure.

---

## Step 3 — Test

Run the test command from the reference file. Capture output and exit code.

**On success:**
```
✅ TESTS PASSED  (<N> tests, <time>)
```

**On failure:** show the failing test names and errors, then ask:
```
⚠️  TESTS FAILED  (<M> failed / <N> total)

<failing test names and short error messages>

Run the app anyway? [y/n]
```

- **y** → proceed to Step 4
- **n** → stop. Print: "Fix the failing tests, then run /run-locally again."

Failing tests mean something is broken, but the user might still want to see the app running for debugging. Let them decide.

---

## Step 4 — Run

Start the development server using the run command from the reference file.

Start in the **background** (so this conversation stays interactive) and tail the output:

```bash
# Example — use stack-appropriate command
./gradlew run &>> /tmp/run-locally-<project>.log &
RUN_PID=$!
```

Then wait for the "server started" signal — each stack has a different startup log line to watch for (documented in the reference files). Once seen, print:

```
🚀 <Project name> is running

  URL  : http://localhost:<port>
  PID  : <pid>
  Logs : tail -f /tmp/run-locally-<project>.log

Press Ctrl+C in your terminal to stop (or kill <pid>)
```

**If the server crashes on startup**, capture the last 20 lines of the log and report them. Offer to show the full log.

**Ports by stack** (defaults — override from config if found):
| Stack | Default port |
|-------|-------------|
| Kotlin/Ktor | 8081 |
| NestJS | 3000 |
| Next.js | 3000 |
| React (Vite) | 5173 |
| React (CRA) | 3000 |
| FastAPI | 8000 / 8123 |
| Laravel | 8000 |
| Flutter (web) | — (opens device) |
| Lambda/SAM | 3000 (API GW emulator) |

---

## Step 5 — Monitor (optional)

After reporting the URL, ask:
```
Monitor live logs? [y/n]
```

- **y** → tail the log file in real time until the user stops you
- **n** → leave the server running silently in the background

---

## Phase summary format

Always print a 3-line summary at the end of the sequence:

```
BUILD  ✅ passed (<time>)
TESTS  ✅ <N> passed (<time>)
RUN    🚀 http://localhost:<port>  (PID <pid>)
```
