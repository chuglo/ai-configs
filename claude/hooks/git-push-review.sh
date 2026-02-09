#!/bin/bash
# Remind to review changes before git push.
#
# PreToolUse hook for Bash tool when command contains "git push".
# Stderr messages are shown to the agent.

set -e

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
ti = data.get('tool_input', {})
print(ti.get('command', ''))
" 2>/dev/null || echo "")

if echo "$COMMAND" | grep -q "git push"; then
  echo "[Hook] Review before push: git diff origin/main...HEAD" >&2
fi

exit 0
