#!/bin/bash
# After a Bash tool call, check if a PR was created.
#
# PostToolUse hook for Bash tool.
# Exit 0 = success, stdout added to transcript.
# Stderr messages are shown to the agent.
#
# Input (stdin JSON):
#   { "tool_name": "Bash", "tool_input": { "command": "..." }, "tool_response": { ... } }

set -e

INPUT=$(cat)

# Check if the bash output mentions a PR URL
# tool_response contains the tool's output (not tool_output)
HAS_PR=$(echo "$INPUT" | jq -r '
  .tool_response // {} |
  [.stdout // "", .result // "", (. | tostring)] |
  join(" ") |
  if test("github\\.com.*/pull/") then "yes" else "no" end
' 2>/dev/null || echo "no")

if [ "$HAS_PR" = "yes" ]; then
  echo "[Hook] PR created - check CI status" >&2
fi

exit 0
