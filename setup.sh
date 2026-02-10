#!/usr/bin/env bash
set -euo pipefail

# AI Configs Setup Script
# Sets up OpenCode and/or Claude Code configuration for a Go + Next.js + PostgreSQL project.
#
# Usage:
#   ./setup.sh /path/to/project [opencode|claude|both]
#
# Placeholders replaced during setup:
#   {{PROJECT_NAME}}  — Project name (derived from directory name or prompted)
#   {{DATABASE_URL}}   — PostgreSQL connection string
#   {{PROJECT_ROOT}}   — Absolute path to the project root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:?Usage: $0 /path/to/project [opencode|claude|both]}"
TOOL="${2:-both}"

# Resolve absolute path
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

# Derive project name from directory
DEFAULT_NAME="$(basename "$TARGET_DIR")"

echo "=== AI Configs Setup ==="
echo "Target: $TARGET_DIR"
echo "Tool:   $TOOL"
echo ""

# Prompt for placeholders
read -rp "Project name [$DEFAULT_NAME]: " PROJECT_NAME
PROJECT_NAME="${PROJECT_NAME:-$DEFAULT_NAME}"

read -rp "Database URL [postgresql://user:pass@localhost:5432/${PROJECT_NAME}_dev]: " DATABASE_URL
DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/${PROJECT_NAME}_dev}"

PROJECT_ROOT="$TARGET_DIR"

echo ""
echo "Configuration:"
echo "  PROJECT_NAME:  $PROJECT_NAME"
echo "  DATABASE_URL:  $DATABASE_URL"
echo "  PROJECT_ROOT:  $PROJECT_ROOT"
echo ""

# Helper: replace placeholders in a file
replace_placeholders() {
    local file="$1"
    sed -i "s|{{PROJECT_NAME}}|$PROJECT_NAME|g" "$file"
    sed -i "s|{{DATABASE_URL}}|$DATABASE_URL|g" "$file"
    sed -i "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" "$file"
}

# Helper: create symlink (relative)
# Handles the case where target already exists as a real directory —
# ln -sfn would create the symlink *inside* the directory instead of
# replacing it. We remove the existing directory first.
make_link() {
    local source="$1"
    local target="$2"
    local rel_source
    rel_source="$(python3 -c "import os.path; print(os.path.relpath('$source', os.path.dirname('$target')))")"

    # If target exists as a real directory (not a symlink), remove it first.
    # Without this, ln -sfn creates a symlink inside the directory instead
    # of replacing it (e.g., commands/commands instead of commands -> ...).
    if [[ -d "$target" && ! -L "$target" ]]; then
        rm -rf "$target"
    fi

    ln -sfn "$rel_source" "$target"
}

# ─── OpenCode Setup ───────────────────────────────────────────────────────────

setup_opencode() {
    echo "Setting up OpenCode..."
    local oc="$TARGET_DIR/.opencode"

    mkdir -p "$oc"/{agents,plugins,tools,instructions,prompts,sessions,skills}

    # Symlink shared content
    make_link "$SCRIPT_DIR/shared/commands" "$oc/commands"

    # Symlink each skill directory individually
    for skill_dir in "$SCRIPT_DIR"/shared/skills/*/; do
        local skill_name
        skill_name="$(basename "$skill_dir")"
        make_link "$skill_dir" "$oc/skills/$skill_name"
    done

    # Symlink shared prompts
    make_link "$SCRIPT_DIR/shared/prompts/planner.txt" "$oc/prompts/planner.txt"

    # Copy files that need placeholder replacement
    cp "$SCRIPT_DIR/shared/instructions/INSTRUCTIONS.md" "$oc/instructions/INSTRUCTIONS.md"
    replace_placeholders "$oc/instructions/INSTRUCTIONS.md"

    # Copy OpenCode-specific files
    cp "$SCRIPT_DIR/opencode/opencode.json" "$oc/opencode.json"
    replace_placeholders "$oc/opencode.json"

    for agent_file in "$SCRIPT_DIR"/opencode/agents/*.md; do
        cp "$agent_file" "$oc/agents/"
        replace_placeholders "$oc/agents/$(basename "$agent_file")"
    done

    cp "$SCRIPT_DIR/opencode/plugins/hooks.js" "$oc/plugins/hooks.js"
    # hooks.js doesn't have placeholders but replace just in case
    replace_placeholders "$oc/plugins/hooks.js"

    for tool_file in "$SCRIPT_DIR"/opencode/tools/*; do
        cp "$tool_file" "$oc/tools/"
        replace_placeholders "$oc/tools/$(basename "$tool_file")"
    done

    cp "$SCRIPT_DIR/opencode/package.json" "$oc/package.json"
    cp "$SCRIPT_DIR/opencode/.gitignore" "$oc/.gitignore"
    touch "$oc/sessions/.gitkeep"

    # Install plugin dependencies
    if command -v bun &>/dev/null; then
        (cd "$oc" && bun install --silent)
    elif command -v npm &>/dev/null; then
        (cd "$oc" && npm install --silent)
    fi

    echo "  OpenCode configured at $oc"
}

# ─── Claude Code Setup ────────────────────────────────────────────────────────

setup_claude() {
    echo "Setting up Claude Code..."
    local cc="$TARGET_DIR/.claude"

    mkdir -p "$cc"/{skills,sessions,hooks}

    # Symlink shared commands
    make_link "$SCRIPT_DIR/shared/commands" "$cc/commands"

    # Symlink each skill directory individually
    for skill_dir in "$SCRIPT_DIR"/shared/skills/*/; do
        local skill_name
        skill_name="$(basename "$skill_dir")"
        make_link "$skill_dir" "$cc/skills/$skill_name"
    done

    # Copy and customize CLAUDE.md
    cp "$SCRIPT_DIR/claude/CLAUDE.md" "$cc/CLAUDE.md"
    replace_placeholders "$cc/CLAUDE.md"

    # Copy and customize instructions
    cp "$SCRIPT_DIR/shared/instructions/INSTRUCTIONS.md" "$cc/INSTRUCTIONS.md"
    replace_placeholders "$cc/INSTRUCTIONS.md"

    # Copy settings.json (includes hooks configuration)
    cp "$SCRIPT_DIR/claude/settings.json" "$cc/settings.json"

    # Copy hook scripts
    for hook_file in "$SCRIPT_DIR"/claude/hooks/*.sh; do
        cp "$hook_file" "$cc/hooks/"
        chmod +x "$cc/hooks/$(basename "$hook_file")"
    done

    # Create sessions state directory
    mkdir -p "$cc/sessions/.state"
    touch "$cc/sessions/.gitkeep"

    echo "  Claude Code configured at $cc"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

case "$TOOL" in
    opencode)
        setup_opencode
        ;;
    claude)
        setup_claude
        ;;
    both)
        setup_opencode
        setup_claude
        ;;
    *)
        echo "Unknown tool: $TOOL (use: opencode, claude, or both)"
        exit 1
        ;;
esac

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Review the generated config files"
echo "  2. Update INSTRUCTIONS.md with project-specific details"
if [[ "$TOOL" == "opencode" || "$TOOL" == "both" ]]; then
    echo "  3. Enable the postgres MCP in .opencode/opencode.json if needed"
fi
echo ""
echo "Shared content is symlinked — updates to ai_configs/ propagate automatically."
echo "Tool-specific files (opencode.json, CLAUDE.md, agents/) are copies — edit them per-project."
