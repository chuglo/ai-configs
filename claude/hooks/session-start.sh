#!/bin/bash
# On session start:
#   1. Persist useful environment variables via CLAUDE_ENV_FILE
#   2. Check for previous session notes and hint at continuity
#
# SessionStart hook. Stdout is shown to the agent as context.
# CLAUDE_ENV_FILE is a special SessionStart-only variable for persisting env vars.

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SESSIONS_DIR="$PROJECT_DIR/.claude/sessions"

# Persist environment variables for the session
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PROJECT_DIR=$PROJECT_DIR" >> "$CLAUDE_ENV_FILE"

  # Detect Go module name
  if [ -f "$PROJECT_DIR/go.mod" ]; then
    GO_MODULE=$(head -1 "$PROJECT_DIR/go.mod" | awk '{print $2}')
    echo "export GO_MODULE=$GO_MODULE" >> "$CLAUDE_ENV_FILE"
  fi

  # Detect current git branch
  BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  if [ -n "$BRANCH" ]; then
    echo "export GIT_BRANCH=$BRANCH" >> "$CLAUDE_ENV_FILE"
  fi
fi

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
