#!/bin/bash
# Track tool failures for session notes context.
#
# PostToolUseFailure hook. Fires when a tool execution fails.
# Appends errors to the session state file for inclusion in session notes.
#
# Input (stdin JSON):
#   {
#     "session_id": "abc123",
#     "tool_name": "Bash",
#     "tool_input": { "command": "go build ./..." },
#     "error": "Command exited with non-zero status code 1",
#     "is_interrupt": false
#   }

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="$PROJECT_DIR/.claude/sessions/.state"
mkdir -p "$STATE_DIR"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")
ERROR_MSG=$(echo "$INPUT" | jq -r '.error // "unknown error"' 2>/dev/null || echo "unknown error")
IS_INTERRUPT=$(echo "$INPUT" | jq -r '.is_interrupt // false' 2>/dev/null || echo "false")

# Skip user interrupts — those aren't real errors
if [ "$IS_INTERRUPT" = "true" ]; then
  exit 0
fi

# Use session_id for state file if available
if [ -n "$SESSION_ID" ]; then
  STATE_FILE="$STATE_DIR/activity-${SESSION_ID:0:12}.json"
else
  STATE_FILE="$STATE_DIR/activity-$(date +%Y%m%d).json"
fi

# Append error to state
python3 << PYEOF
import json, os
from datetime import datetime

state_file = "$STATE_FILE"
tool = "$TOOL_NAME"
error = """$ERROR_MSG"""[:200]

state = {"count": 0, "go_files": [], "ts_files": [], "start": "", "doc_edits": [], "errors": []}
if os.path.exists(state_file):
    try:
        with open(state_file) as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

state.setdefault("errors", []).append({
    "time": datetime.now().strftime("%H:%M:%S"),
    "tool": tool,
    "error": error,
})

# Cap at 20 errors
if len(state["errors"]) > 20:
    state["errors"] = state["errors"][-20:]

with open(state_file, "w") as f:
    json.dump(state, f)
PYEOF

exit 0
