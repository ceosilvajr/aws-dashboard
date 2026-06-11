---
name: setup
description: "Run /setup to verify that the local development environment is correctly configured before starting work. Checks that superpowers skills are installed, GitLab credentials are set, and all stack-specific tools (JVM, Docker, AWS, Node, Python, PHP, Flutter) are available and working. Produces a health report and offers to interactively fix any issues found. Trigger immediately when the user types /setup, 'check my env', 'am I set up?', 'can I run this locally?', or 'environment check'."
---

# Project Setup Health Check

Run three checks in parallel, then print a unified health report, then interactively offer fixes for every failure.

---

## The three checks

### CHECK 1 — Superpowers Skills

Find the superpowers plugin and verify key skills exist:

```bash
SUPERPOWERS_BASE=$(ls -d ~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills 2>/dev/null | tail -1)
echo "Base: $SUPERPOWERS_BASE"

REQUIRED_SKILLS=(
  "brainstorming"
  "writing-plans"
  "using-git-worktrees"
  "test-driven-development"
  "executing-plans"
  "systematic-debugging"
  "dispatching-parallel-agents"
  "requesting-code-review"
  "receiving-code-review"
  "verification-before-completion"
  "finishing-a-development-branch"
)

for skill in "${REQUIRED_SKILLS[@]}"; do
  if [ -f "$SUPERPOWERS_BASE/$skill/SKILL.md" ]; then
    echo "OK: $skill"
  else
    echo "MISSING: $skill"
  fi
done
```

Also check project agent files reference the key pipeline skills:
```bash
grep -c "superpowers:brainstorming" .claude/agents/orchestrator.md 2>/dev/null || echo "0"
```

### CHECK 2 — VCS Credentials

```bash
# Check token env var
if [ -n "$ANALITIKA_GITLAB_TOKEN" ]; then
  # Test it against the API (don't print the token)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "PRIVATE-TOKEN: $ANALITIKA_GITLAB_TOKEN" \
    "https://gitlab.com/api/v4/user")
  echo "TOKEN_SET=yes TOKEN_API_STATUS=$STATUS"
else
  echo "TOKEN_SET=no"
fi

# Check glab CLI
which glab 2>/dev/null && glab --version || echo "glab: not found"
glab auth status 2>&1 | head -3
```

### CHECK 3 — Stack Detection + Prerequisites

Detect the stack from manifest files in the current directory:

```bash
# Detect stacks (can be multiple in a monorepo)
[ -f "build.gradle.kts" ] && echo "STACK:kotlin-ktor"
[ -f "pom.xml" ] && echo "STACK:kotlin-jvm-maven"
[ -f "package.json" ] && echo "STACK:nodejs"
[ -f "pyproject.toml" ] || [ -f "requirements.txt" ] && echo "STACK:python"
[ -f "composer.json" ] && echo "STACK:php-laravel"
[ -f "pubspec.yaml" ] && echo "STACK:flutter"
[ -f "template.yml" ] || [ -f "serverless.yml" ] && echo "STACK:lambda-sam"
```

Then for each detected stack, read and run the checks from `references/stacks.md`.

---

## Report format

Print a clear report before offering any fixes:

```
╔══════════════════════════════════════════════╗
║          PROJECT SETUP HEALTH CHECK          ║
╚══════════════════════════════════════════════╝

Project : <basename of $PWD>
Stack   : <detected stack(s)>
Date    : <today>

────────────────────────────────────────────────
🧩  SUPERPOWERS SKILLS
────────────────────────────────────────────────
  ✅  brainstorming
  ✅  writing-plans
  ✅  using-git-worktrees
  ✅  test-driven-development
  ✅  executing-plans
  ✅  systematic-debugging
  ✅  dispatching-parallel-agents
  ✅  requesting-code-review
  ✅  receiving-code-review
  ✅  verification-before-completion
  ✅  finishing-a-development-branch
  ✅  orchestrator.md references brainstorming

────────────────────────────────────────────────
🔑  VCS CREDENTIALS
────────────────────────────────────────────────
  ✅  ANALITIKA_GITLAB_TOKEN is set (API: 200)
  ✅  glab 1.51.0 installed
  ✅  glab authenticated (ariel@analitika.ph)

────────────────────────────────────────────────
⚙️   STACK: Kotlin / Ktor (JVM)
────────────────────────────────────────────────
  ✅  Java 21.0.3 (GraalVM)
  ✅  Gradle wrapper (build.gradle.kts found)
  ✅  ./gradlew --version → 8.5
  ✅  Docker 27.1.1 (daemon running)
  ✅  AWS profile digigov-master (configured)
  ❌  glab: not authenticated
     → Fix: glab auth login

════════════════════════════════════════════════
STATUS: 1 issue found
════════════════════════════════════════════════
```

Use ✅ for pass, ❌ for fail, ⚠️ for warning (present but unexpected version).

---

## Interactive fix flow

After printing the full report, work through each ❌ failure one by one:

For each failure:
1. Print: `\n❌ ISSUE: <description>`
2. Print: `   Proposed fix: <command or steps>`
3. Ask: `   Run this now? [y/n/skip-all]`
   - **y** → run the fix command, then re-run just that check and report new status
   - **n** → skip this fix, add it to the "manual steps" list
   - **skip-all** → stop offering fixes, print all remaining fixes as a manual checklist

After working through all failures (or after `skip-all`):
- If manual steps remain, print them as a numbered checklist under "📋 REMAINING MANUAL STEPS"
- If everything is fixed, print: `✅ All issues resolved — you're ready to develop!`

Warnings (⚠️) are never auto-offered for fixing — they appear in the report only. If the user asks about them directly, explain the concern.

---

## Fix commands reference

Keep these ready for each failure type:

| Failure | Fix command |
|---------|-------------|
| ANALITIKA_GITLAB_TOKEN not set | `echo 'export ANALITIKA_GITLAB_TOKEN=<your-token>' >> ~/.zshrc && source ~/.zshrc` |
| glab not found | `brew install glab` (macOS) or `apt-get install glab` (Linux) |
| glab not authenticated | `glab auth login` |
| Java not found | `brew install --cask temurin21` |
| Java wrong version | `brew install --cask temurin21` + set JAVA_HOME |
| gradlew not executable | `chmod +x ./gradlew` |
| Docker not running | `open -a Docker` (macOS) or `sudo systemctl start docker` |
| Docker not installed | `brew install --cask docker` |
| AWS profile missing | `aws configure --profile digigov-master` |
| Node not found / wrong version | `brew install node@20` or `nvm install 20` |
| npm deps missing | `npm install` |
| Python not found | `brew install python@3.11` |
| venv not active | `python3 -m venv .venv && source .venv/bin/activate` |
| PHP wrong version | `brew install php@8.2` |
| Composer not found | `brew install composer` |
| vendor/ missing | `composer install` |
| Flutter not found | See https://docs.flutter.dev/get-started/install |
| SAM not found | `brew install aws-sam-cli` |

For fixes that require a token value (like ANALITIKA_GITLAB_TOKEN), never run the command automatically — always ask the user to provide the value and confirm.

---

## Stack-specific check details

See `references/stacks.md` for the exact commands run for each stack.

---

## Scope notes

- This skill checks the **current working directory** as the project root.
- In a monorepo, it detects all stacks present (e.g., a repo with both `build.gradle.kts` and `package.json` gets both Kotlin and Node checks).
- It does **not** run the full test suite — use `./gradlew test` (or stack equivalent) for that.
- It does **not** check application-level secrets (DB passwords, S3 bucket names, etc.) — only tooling and auth.
