#!/bin/bash
# Log user prompts for session notes context.
# Also detects slash commands for activity tracking.
#
# UserPromptSubmit hook. Fires when the user sends a message.
# Exit 0 = allow prompt through. Stdout added to Claude's context.
#
# Input (stdin JSON):
#   { "session_id": "abc123", "prompt": "Fix the auth handler" }

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="$PROJECT_DIR/.claude/sessions/.state"
mkdir -p "$STATE_DIR"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || echo "")

# Nothing to log
if [ -z "$PROMPT" ]; then
  exit 0
fi

# Use session_id for state file if available
if [ -n "$SESSION_ID" ]; then
  STATE_FILE="$STATE_DIR/activity-${SESSION_ID:0:12}.json"
else
  STATE_FILE="$STATE_DIR/activity-$(date +%Y%m%d).json"
fi

# Track slash commands and prompt count
python3 << PYEOF
import json, os
from datetime import datetime

state_file = "$STATE_FILE"
prompt = """$PROMPT"""[:500]

state = {"count": 0, "go_files": [], "ts_files": [], "start": "", "doc_edits": [], "prompts": 0, "slash_commands": []}
if os.path.exists(state_file):
    try:
        with open(state_file) as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

state["prompts"] = state.get("prompts", 0) + 1

# Track slash commands
if prompt.startswith("/"):
    cmd = prompt.split()[0]
    state.setdefault("slash_commands", []).append(cmd)

with open(state_file, "w") as f:
    json.dump(state, f)
PYEOF

exit 0
