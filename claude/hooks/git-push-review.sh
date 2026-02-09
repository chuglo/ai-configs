#!/bin/bash
# Remind to review changes before git push.
#
# PreToolUse hook for Bash tool when command contains "git push".
# Stderr messages are shown to the agent.
#
# Input (stdin JSON):
#   { "tool_name": "Bash", "tool_input": { "command": "git push ..." } }

set -e

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

if echo "$COMMAND" | grep -q "git push"; then
  echo "[Hook] Review before push: git diff origin/main...HEAD" >&2
fi

exit 0
