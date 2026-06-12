#!/usr/bin/env bash
# PostToolUse hook: format the file Claude just edited with the repo's own
# formatter. Always fail-open — formatting problems must never block edits.
set -u

INPUT=$(cat) || exit 0

if command -v jq >/dev/null 2>&1; then
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
elif command -v python3 >/dev/null 2>&1; then
  FILE=$(printf '%s' "$INPUT" | python3 -c \
    'import json,sys;print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)
else
  exit 0
fi
[ -n "${FILE:-}" ] && [ -f "$FILE" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# Never touch generated or vendored files.
case "$FILE" in
  *.freezed.dart|*.g.dart|*.gen.dart|*/injection.config.dart) exit 0 ;;
  */node_modules/*|*/build/*|*/.dart_tool/*|*/vendor/*|*/.venv/*|*/coverage/*|*/dist/*) exit 0 ;;
esac

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    [ -x "$ROOT/node_modules/.bin/prettier" ] && \
      "$ROOT/node_modules/.bin/prettier" --write "$FILE" >/dev/null 2>&1 ;;
  *.dart)
    command -v dart >/dev/null 2>&1 && dart format "$FILE" >/dev/null 2>&1 ;;
  *.php)
    [ -x "$ROOT/vendor/bin/pint" ] && "$ROOT/vendor/bin/pint" "$FILE" >/dev/null 2>&1 ;;
  *.py)
    if [ -x "$ROOT/.venv/bin/ruff" ]; then
      "$ROOT/.venv/bin/ruff" format "$FILE" >/dev/null 2>&1
      "$ROOT/.venv/bin/ruff" check --fix "$FILE" >/dev/null 2>&1
    fi ;;
  *.kt|*.kts)
    # Intentionally skipped: the only formatter is ./gradlew ktlintFormat,
    # which is too slow per-edit. ktlintCheck still gates at QA.
    : ;;
esac
exit 0
