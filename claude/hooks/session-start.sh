#!/bin/bash
# On session start, check for previous session notes and hint at continuity.
#
# SessionStart hook. Stdout is shown to the agent as context.

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SESSIONS_DIR="$PROJECT_DIR/.claude/sessions"

# Check for previous session notes
if [ -d "$SESSIONS_DIR" ]; then
  LATEST=$(ls -1 "$SESSIONS_DIR"/SESSION_*.md 2>/dev/null | sort | tail -1)
  if [ -n "$LATEST" ]; then
    FILENAME=$(basename "$LATEST")
    echo "[SessionStart] Previous session notes available: .claude/sessions/$FILENAME"
    echo "[SessionStart] Read it for continuity context from the last session."
  fi
fi

exit 0
