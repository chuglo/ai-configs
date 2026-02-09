#!/bin/bash
# Write rich session notes on session end or before compaction.
# Gathers git state, edited files, and activity from the daily state file.
#
# Used by: PreCompact hook, SessionEnd hook, or called manually.
# Arg: $1 = trigger reason (e.g., "compaction", "session-end", "manual")
#
# Stdout is injected into compaction context (PreCompact) or shown to agent.

set -e

TRIGGER="${1:-manual}"
PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SESSIONS_DIR="$PROJECT_DIR/.claude/sessions"
STATE_DIR="$SESSIONS_DIR/.state"
MAX_SESSION_FILES=10

# Find the most recent state file (could be session-scoped or daily)
STATE_FILE=$(ls -t "$STATE_DIR"/activity-*.json 2>/dev/null | head -1 || echo "")
if [ -z "$STATE_FILE" ]; then
  STATE_FILE="$STATE_DIR/activity-$(date +%Y%m%d).json"
fi

mkdir -p "$SESSIONS_DIR"

# Gather git state
BRANCH=$(git branch --show-current 2>/dev/null || echo "(unknown)")
GIT_STATUS=$(git status --short 2>/dev/null || echo "(unable to get status)")
GIT_LOG=$(git log --oneline -10 2>/dev/null || echo "(no commits)")
GIT_DIFF_STAT=$(git diff --stat 2>/dev/null || echo "(no changes)")
GIT_STASH=$(git stash list 2>/dev/null || echo "")

# Export all variables so the python heredoc can read them via os.environ
export TRIGGER PROJECT_DIR SESSIONS_DIR STATE_FILE MAX_SESSION_FILES
export BRANCH GIT_STATUS GIT_LOG GIT_DIFF_STAT GIT_STASH

# Read activity state and write notes
python3 << 'PYEOF'
import json, os, sys
from datetime import datetime

project_dir = os.environ.get("PROJECT_DIR", os.getcwd())
state_file = os.environ.get("STATE_FILE", "")
sessions_dir = os.environ.get("SESSIONS_DIR", "")
trigger = os.environ.get("TRIGGER", "manual")
branch = os.environ.get("BRANCH", "(unknown)")
git_status = os.environ.get("GIT_STATUS", "")
git_log = os.environ.get("GIT_LOG", "")
git_diff_stat = os.environ.get("GIT_DIFF_STAT", "")
git_stash = os.environ.get("GIT_STASH", "")
max_files = int(os.environ.get("MAX_SESSION_FILES", "10"))

# Load state
state = {"count": 0, "go_files": [], "ts_files": [], "start": "", "doc_edits": [], "errors": [], "prompts": 0, "slash_commands": []}
if state_file and os.path.exists(state_file):
    try:
        with open(state_file) as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError):
        pass

count = state.get("count", 0)
go_files = state.get("go_files", [])
ts_files = state.get("ts_files", [])
doc_edits = state.get("doc_edits", [])
errors = state.get("errors", [])
prompts = state.get("prompts", 0)
slash_commands = state.get("slash_commands", [])
start_time = state.get("start", "")

# Calculate duration
duration = "unknown"
if start_time:
    try:
        start = datetime.fromisoformat(start_time)
        mins = int((datetime.now() - start).total_seconds() / 60)
        if mins < 60:
            duration = f"{mins}m"
        else:
            duration = f"{mins // 60}h {mins % 60}m"
    except ValueError:
        pass

# Derive session name from edited files
all_edited = go_files + ts_files
domains = set()
for f in all_edited:
    parts = f.replace(project_dir + "/", "").split("/")
    meaningful = [p for p in parts if p not in ("internal", "web", "src", "app", "components", "lib", "store")]
    if meaningful:
        seg = meaningful[0].rsplit(".", 1)[0]
        if seg and len(seg) > 1:
            domains.add(seg)

session_name = "-".join(list(domains)[:3]) if domains else "session"
session_name = "".join(c if c.isalnum() or c == "-" else "-" for c in session_name.lower())[:50]

timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")

# Build edited files section
if all_edited:
    rel_edited = [f.replace(project_dir + "/", "") for f in all_edited]
    edited_section = "\n".join(f"- `{f}`" for f in rel_edited)
else:
    edited_section = "_No files edited this session_"

# Uncommitted changes
uncommitted = f"Yes\n```\n{git_status}\n```" if git_status.strip() else "No uncommitted changes"

# Stash section
stash_section = f"\n### Stashes\n```\n{git_stash}\n```\n" if git_stash.strip() else ""

# DocWatch section
doc_section = ""
if doc_edits:
    rel_docs = [f.replace(project_dir + "/", "") for f in doc_edits]
    doc_section = f"\n### Documentation Watch\nArchitecture-relevant files were edited:\n" + "\n".join(f"- `{f}`" for f in rel_docs) + "\nRun `/update-docs` to sync documentation.\n"

# Errors section
error_section = ""
if errors:
    error_section = "\n### Errors Encountered\n" + "\n".join(
        f"- `{e.get('time', '?')}` [{e.get('tool', '?')}] {e.get('error', '?')}" for e in errors
    ) + "\n"

# Slash commands section
slash_section = ""
if slash_commands:
    slash_section = "\n### Slash Commands Used\n" + "\n".join(f"- `{c}`" for c in slash_commands) + "\n"

# Build notes
notes = f"""# Session Notes — {timestamp.replace("_", " ")}

> Auto-generated on **{trigger}** | {duration} session | {count} tool calls | {prompts} prompts | {len(go_files)} Go, {len(ts_files)} TS/JS files edited

## Current State
- **Branch**: `{branch}`
- **Uncommitted changes**: {uncommitted}
- **Session duration**: {duration}
- **Tool calls**: {count}
{stash_section}
## Files Edited This Session
{edited_section}

## Git State

### Recent Commits
```
{git_log}
```

### Diff Summary
```
{git_diff_stat}
```
{doc_section}{error_section}{slash_section}
---

*For richer notes with conversation context and decisions, run `/session-notes` manually before ending a session.*
"""

# Check if session had substantial work (50+ tool calls AND files edited)
has_substantial_work = count >= 50 and len(all_edited) > 0

if has_substantial_work:
    # Write to file
    filename = f"SESSION_{timestamp}_{session_name}.md"
    filepath = os.path.join(sessions_dir, filename)
    with open(filepath, "w") as f:
        f.write(notes)
    print(f"[SessionNotes] Written: {filename}", file=sys.stderr)

    # Prune old files
    try:
        existing = sorted(
            f for f in os.listdir(sessions_dir)
            if f.startswith("SESSION_") and f.endswith(".md")
        )
        if len(existing) > max_files:
            for old in existing[:len(existing) - max_files]:
                os.remove(os.path.join(sessions_dir, old))
                print(f"[SessionNotes] Pruned: {old}", file=sys.stderr)
    except OSError:
        pass
else:
    print(f"[SessionNotes] Skipped file write ({count} tool calls, {len(all_edited)} files — below threshold)", file=sys.stderr)

# Output context for compaction (stdout goes to agent)
if trigger == "compaction":
    print(f"""
## Session State (auto-captured before compaction)

**Session duration**: {duration}
**Tool calls**: {count}
**Files edited**: {len(go_files)} Go, {len(ts_files)} TS/JS

### Files Edited
{edited_section}
{doc_section}{error_section}{slash_section}
**IMPORTANT**: After compaction, read the latest file in `.claude/sessions/` for full session context.
""")

PYEOF

exit 0
