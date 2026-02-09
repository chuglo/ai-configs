#!/bin/bash
# After a Bash tool call, check if a PR was created.
#
# PostToolUse hook for Bash tool.
# Stderr messages are shown to the agent.

set -e

INPUT=$(cat)

# Check if the bash output mentions a PR URL
HAS_PR=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
output = data.get('tool_output', {})
if isinstance(output, dict):
    text = str(output.get('stdout', '')) + str(output.get('result', ''))
else:
    text = str(output)
if 'github.com' in text and '/pull/' in text:
    print('yes')
else:
    print('no')
" 2>/dev/null || echo "no")

if [ "$HAS_PR" = "yes" ]; then
  echo "[Hook] PR created - check CI status" >&2
fi

exit 0
