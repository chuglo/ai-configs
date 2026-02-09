#!/bin/bash
# Track tool call count and suggest strategic compaction.
# Also tracks edited files for session notes.
#
# PreToolUse hook (matcher: .*). Runs on every tool call.
# Uses session_id from Claude Code input to scope state per-session.
#
# Stderr messages are shown to the agent.
#
# Input (stdin JSON):
#   { "session_id": "abc123", "tool_name": "Edit", "tool_input": { "file_path": "..." } }

set -e

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
STATE_DIR="$PROJECT_DIR/.claude/sessions/.state"
mkdir -p "$STATE_DIR"

INPUT=$(cat)

# Extract session_id and tool info using jq
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"' 2>/dev/null || echo "unknown")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // empty' 2>/dev/null || echo "")

# Use session_id for state file if available, fall back to daily
if [ -n "$SESSION_ID" ]; then
  # Use first 12 chars of session_id for filename
  STATE_FILE="$STATE_DIR/activity-${SESSION_ID:0:12}.json"
else
  STATE_FILE="$STATE_DIR/activity-$(date +%Y%m%d).json"
fi

# Update state with Python (jq can't easily do read-modify-write on files)
python3 << PYEOF
import json, os, sys
from datetime import datetime

state_file = "$STATE_FILE"
tool = "$TOOL_NAME"
file_path = """$FILE_PATH"""

# Load or initialize state
state = {"count": 0, "go_files": [], "ts_files": [], "start": "", "doc_edits": []}
if os.path.exists(state_file):
    try:
        with open(state_file) as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

if not state.get("start"):
    state["start"] = datetime.now().isoformat()

state["count"] = state.get("count", 0) + 1

# Track edited files (Edit, Write, and MultiEdit)
if tool in ("Edit", "Write", "MultiEdit") and file_path:
    if file_path.endswith(".go") and file_path not in state.get("go_files", []):
        state.setdefault("go_files", []).append(file_path)
    if any(file_path.endswith(ext) for ext in (".ts", ".tsx", ".js", ".jsx")):
        if file_path not in state.get("ts_files", []):
            state.setdefault("ts_files", []).append(file_path)

    # Track doc-relevant edits
    doc_prefixes = [
        "internal/domain", "internal/handler", "internal/worker",
        "internal/store/migrations", "internal/store/queries",
        "internal/middleware", "internal/config", "internal/email",
        "internal/storage", "internal/server", "web/src/app", "docker",
    ]
    for prefix in doc_prefixes:
        if prefix in file_path:
            if file_path not in state.get("doc_edits", []):
                state.setdefault("doc_edits", []).append(file_path)
            break

# Write state
with open(state_file, "w") as f:
    json.dump(state, f)

# Strategic compact suggestions
count = state["count"]
if count == 50:
    print("[StrategicCompact] 50 tool calls - consider /session-notes then /compact if transitioning phases", file=sys.stderr)
elif count > 50 and count % 25 == 0:
    print(f"[StrategicCompact] {count} tool calls - good checkpoint for /session-notes and /compact", file=sys.stderr)
PYEOF

exit 0
