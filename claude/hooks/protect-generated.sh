#!/bin/bash
# Block edits to sqlc generated files and warn on shadcn/ui edits.
#
# PreToolUse hook for Edit/Write/MultiEdit tools.
# Exit code 2 = block the tool call (stderr fed back to Claude).
# Exit code 0 = allow the tool call.
#
# Input (stdin JSON):
#   { "tool_name": "Edit", "tool_input": { "file_path": "..." } }

set -e

INPUT=$(cat)

# Extract file_path from tool_input (Claude Code uses snake_case: file_path)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Block sqlc generated files
if echo "$FILE_PATH" | grep -q "internal/store/sqlc/"; then
  echo "[Hook] BLOCKED: Cannot edit sqlc-generated file: $FILE_PATH" >&2
  echo "[Hook] Edit internal/store/queries/*.sql instead, then run 'sqlc generate'." >&2
  exit 2
fi

# Warn on shadcn/ui component edits (don't block, just warn)
if echo "$FILE_PATH" | grep -q "web/src/components/ui/"; then
  echo "[Hook] Warning: $FILE_PATH is a shadcn/ui component. Modify via shadcn CLI, not by hand." >&2
fi

exit 0
