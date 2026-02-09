#!/bin/bash
# When Claude stops responding, audit for console.log in recently edited TS/JS files.
# Desktop notifications are handled by the Notification hook in settings.json.
#
# Stop hook. Stderr messages are shown to the agent.

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Find TS/JS files modified in the current git session (uncommitted changes)
MODIFIED_TS=$(git diff --name-only --diff-filter=M HEAD 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' || true)
STAGED_TS=$(git diff --cached --name-only --diff-filter=M 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$' || true)

ALL_TS=$(echo -e "$MODIFIED_TS\n$STAGED_TS" | sort -u | grep -v '^$' || true)

if [ -n "$ALL_TS" ]; then
  # Check for console.log in modified files
  CONSOLE_LOG_FILES=""
  while IFS= read -r file; do
    full_path="$PROJECT_DIR/$file"
    if [ -f "$full_path" ] && grep -q "console\.log" "$full_path" 2>/dev/null; then
      CONSOLE_LOG_FILES="$CONSOLE_LOG_FILES $file"
    fi
  done <<< "$ALL_TS"

  if [ -n "$CONSOLE_LOG_FILES" ]; then
    echo "[Hook] Audit: console.log found in:$CONSOLE_LOG_FILES" >&2
  fi
fi

exit 0
