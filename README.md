# AI Configs

Portable AI coding assistant configuration for **Go + Next.js + PostgreSQL** projects. Compatible with both [OpenCode](https://opencode.ai) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Shared commands, skills, and instructions live in one place. A setup script symlinks shared content into your project so updates propagate automatically, while tool-specific files are copied for per-project customization.

## Directory Structure

```
ai_configs/
  shared/
    commands/          25 slash command markdown files (shared between OpenCode and Claude)
    skills/            13 skill directories with SKILL.md files
    instructions/      INSTRUCTIONS.md template (coding standards, conventions)
    prompts/           planner.txt (system prompt for planning agent)
  opencode/
    opencode.json      OpenCode main config (agents, commands, permissions, MCP servers)
    agents/            13 agent markdown definitions (OpenCode-only)
    plugins/hooks.js   JS plugin (session tracking, sqlc protection, DocWatch, etc.)
    tools/             3 TypeScript custom tools (OpenCode-only)
    package.json       Plugin dependencies
    .gitignore         Ignore ephemeral files
  claude/
    CLAUDE.md          Claude Code configuration (build agent + instructions)
    settings.json      Permissions and hook configuration
    hooks/             7 shell-based hook scripts (ported from OpenCode plugin)
  setup.sh             Unified setup script
  README.md            This file
```

## Quick Start

```bash
# Clone this repo
git clone <repo-url> ~/dev/ai_configs

# Set up a project with both tools
./setup.sh /path/to/your-project both

# Or set up just one
./setup.sh /path/to/your-project opencode
./setup.sh /path/to/your-project claude
```

The script will prompt for:
- **Project name** (defaults to directory name)
- **Database URL** (defaults to `postgresql://user:pass@localhost:5432/<name>_dev`)

## How Symlinks Work

The setup script creates two categories of files in your project:

**Symlinked (shared content)** — Updates to `ai_configs/` propagate automatically:
- `commands/` — All 25 slash commands
- `skills/` — All 13 skill directories

**Copied (tool-specific files)** — Edit per-project as needed:
- OpenCode: `opencode.json`, `agents/*.md`, `plugins/hooks.js`, `tools/*`, `instructions/INSTRUCTIONS.md`
- Claude: `CLAUDE.md`, `settings.json`, `hooks/*.sh`, `INSTRUCTIONS.md`

To update shared content across all projects, just `git pull` in your `ai_configs/` directory.

## Placeholders

The setup script replaces these placeholders in copied files:

| Placeholder | Description | Example |
|---|---|---|
| `{{PROJECT_NAME}}` | Project/module name | `myapp`, `acme-platform` |
| `{{DATABASE_URL}}` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/mydb` |
| `{{PROJECT_ROOT}}` | Absolute path to project root | `/home/user/dev/myapp` |

## Available Commands

All 25 commands work in both OpenCode (`/command`) and Claude Code (`/command`).

| Command | Description |
|---|---|
| `/plan` | Create a detailed implementation plan for complex features |
| `/code-review` | Review code for quality, patterns, and maintainability |
| `/security` | Run security-focused review (OWASP, auth, tenant isolation) |
| `/go-review` | Go-focused code review (idioms, concurrency, performance) |
| `/db-review` | Review PostgreSQL schema, queries, migrations, and RLS policies |
| `/build-fix` | Fix Go and/or TypeScript build errors with minimal changes |
| `/go-build` | Fix Go build, vet, and compilation errors |
| `/tdd` | Enforce TDD workflow with 80%+ test coverage |
| `/go-test` | Go TDD workflow with table-driven tests |
| `/e2e` | Generate and run E2E tests with Playwright |
| `/test-coverage` | Analyze test coverage across Go backend and Next.js frontend |
| `/verify` | Run comprehensive verification (build, lint, tests) |
| `/checkpoint` | Create or verify workflow checkpoint |
| `/update-docs` | Update architecture and API documentation |
| `/migrate` | Create or review database migrations with goose |
| `/orchestrate` | Orchestrate multiple agents for complex cross-stack tasks |
| `/refactor-clean` | Remove dead code and consolidate duplicates |
| `/learn` | Extract patterns and instincts from current session |
| `/instinct-status` | View learned instincts with confidence scores |
| `/instinct-import` | Import instincts from external sources |
| `/instinct-export` | Export instincts for sharing |
| `/evolve` | Cluster related instincts into skills |
| `/session-notes` | Generate session notes (work log + continuity context) |
| `/worktree` | Manage git worktrees for parallel multi-agent development |
| `/review-battle` | Dispatch competing code reviewers, then grade them |

## Available Agents (OpenCode Only)

Agents are OpenCode-specific — they define specialized sub-agents with constrained permissions and focused system prompts.

| Agent | Description |
|---|---|
| `build` | Primary coding agent for development (Go backend + Next.js frontend) |
| `plan` | Planning and architecture specialist. Implementation plans, design decisions, cross-stack breakdowns. |
| `code-reviewer` | General code review for quality and maintainability |
| `security-reviewer` | Security-focused review (OWASP, auth, tenant isolation) |
| `go-reviewer` | Go-specific code review (idioms, concurrency, performance) |
| `database-reviewer` | PostgreSQL schema, queries, migrations, and RLS review |
| `build-fixer` | Fix build errors with minimal changes |
| `go-build-resolver` | Fix Go build, vet, and compilation errors |
| `tdd-guide` | TDD workflow enforcement with coverage targets |
| `e2e-runner` | Generate and run E2E tests with Playwright |
| `doc-updater` | Update architecture and API documentation |
| `refactor-cleaner` | Remove dead code and consolidate duplicates |
| `review-coach` | Grade competing code reviews and synthesize best findings |
| `architect` | Software architecture specialist for system design and scalability |

## Available Skills

Skills provide domain-specific instructions loaded on demand. In OpenCode they're loaded via the skill loader; in Claude Code the agent reads the SKILL.md files directly.

| Skill | Description |
|---|---|
| `coding-standards` | Universal coding standards — Go conventions, TypeScript strict mode, API design, naming |
| `continuous-learning-v2` | Instinct-based learning system — observations, confidence scoring, evolution into skills |
| `frontend-design` | Create distinctive, production-grade frontend interfaces with high design quality |
| `frontend-patterns` | Next.js 16 + React 19 patterns — App Router, TanStack Query, shadcn/ui, form handling |
| `golang-patterns` | Idiomatic Go patterns — error handling, concurrency, interfaces, Chi handlers, sqlc usage |
| `golang-testing` | Go testing patterns — table-driven tests, HTTP handler testing, mock patterns, fuzz testing |
| `iterative-retrieval` | Progressive context retrieval pattern for solving subagent context problems |
| `parallel-worktrees` | Git worktree management for parallel multi-agent development |
| `postgres-patterns` | PostgreSQL patterns — multi-tenant queries, index design, RLS, full-text search, migrations |
| `security-review` | Security checklist — multi-tenancy, auth, input validation, OWASP Top 10, file uploads |
| `strategic-compact` | Suggests manual context compaction at logical workflow boundaries |
| `tdd-workflow` | TDD methodology — Red-Green-Refactor cycle, 80%+ coverage, Go + React Testing Library |
| `verification-loop` | Comprehensive verification — build, type check, lint, test, security scan across Go and Next.js |

## Tool Compatibility Matrix

| Feature | OpenCode | Claude Code |
|---|---|---|
| Commands (25) | `/command` via opencode.json | `/command` via commands/ directory |
| Skills (13) | Loaded via skill loader MCP tool | Agent reads SKILL.md files directly |
| Agents (14) | Agent definitions in agents/ | N/A — single agent with CLAUDE.md config |
| Plugin hooks | JS plugin (`hooks.js`) | Shell hooks in `hooks/` + `settings.json` config |
| Custom tools | 3 TypeScript tools (check-coverage, run-tests, security-audit) | N/A — use bash commands directly |
| MCP servers | Context7, PostgreSQL (configurable) | Configured separately in Claude Code settings |
| Instructions | `INSTRUCTIONS.md` in instructions/ | `INSTRUCTIONS.md` in `.claude/` |
| Permissions | Granular bash/edit/mcp rules in opencode.json | Allow/deny lists in settings.json |

## Custom Tools (OpenCode Only)

| Tool | Description |
|---|---|
| `check-coverage` | Analyze Go and Next.js test coverage against configurable thresholds |
| `run-tests` | Run test suites with coverage, race detection, pattern filtering, watch mode |
| `security-audit` | Secret detection, code pattern scanning, multi-tenancy violation checks |

## Hooks

Both tools have equivalent hook functionality. OpenCode uses a JS plugin; Claude Code uses shell scripts triggered by `settings.json`.

### Feature Parity

| Hook Feature | OpenCode (`hooks.js`) | Claude Code (`hooks/*.sh`) |
|---|---|---|
| **sqlc protection** — Block edits to generated files | `tool.execute.before` | `PreToolUse` → `protect-generated.sh` |
| **shadcn/ui warnings** — Warn on UI component edits | `tool.execute.before` | `PreToolUse` → `protect-generated.sh` |
| **Git push review** — Remind to review before push | `tool.execute.before` | `PreToolUse` → `git-push-review.sh` |
| **Activity tracking** — Track tool calls, edited files | `tool.execute.before` | `PreToolUse` → `track-activity.sh` |
| **Strategic compact** — Suggest compaction at milestones | `tool.execute.before` | `PreToolUse` → `track-activity.sh` |
| **PR detection** — Log when PRs are created | `tool.execute.after` | `PostToolUse` → `post-bash.sh` |
| **Console.log audit** — Find leftover debug logs | `event` (session.idle) | `Stop` → `stop-audit.sh` |
| **Desktop notification** — Notify on task completion | `event` (session.idle) | `Notification` → inline notify-send |
| **Session continuity** — Point to previous session notes | `event` (session.created) | `SessionStart` → `session-start.sh` |
| **Environment setup** — Persist PROJECT_DIR, GO_MODULE, GIT_BRANCH | N/A (JS state) | `SessionStart` → `session-start.sh` (CLAUDE_ENV_FILE) |
| **Error tracking** — Record tool failures for session notes | `tool.execute.after` | `PostToolUseFailure` → `track-error.sh` |
| **Prompt logging** — Track prompt count and slash commands | `event` (command) | `UserPromptSubmit` → `log-prompt.sh` |
| **Session notes on compaction** — Rich context injection | `experimental.session.compacting` | `PreCompact` → `session-notes.sh` |
| **DocWatch** — Detect architecture-relevant edits | `event` (session.idle) | `PreToolUse` → `track-activity.sh` |

### Claude Code Hook Scripts

| Script | Hook Type | Purpose |
|---|---|---|
| `protect-generated.sh` | PreToolUse (Edit/Write/MultiEdit) | Block sqlc edits (exit 2), warn on shadcn/ui |
| `git-push-review.sh` | PreToolUse (Bash) | Remind to review diff before pushing |
| `track-activity.sh` | PreToolUse (*) | Track tool calls, files, suggest compaction (session_id scoped) |
| `post-bash.sh` | PostToolUse (Bash) | Detect PR creation from gh CLI output |
| `track-error.sh` | PostToolUseFailure (*) | Track tool failures for session notes |
| `log-prompt.sh` | UserPromptSubmit (*) | Log prompt count and slash commands |
| `stop-audit.sh` | Stop (*) | Audit console.log in edited TS/JS files |
| `session-start.sh` | SessionStart (*) | Persist env vars (CLAUDE_ENV_FILE), check for previous session notes |
| `session-notes.sh` | PreCompact (*) | Write session notes, inject compaction context |

## Continuous Learning System

An instinct-based learning system that captures patterns from sessions and evolves them into reusable knowledge.

```
Session activity
    -> /learn (manual mid-session extraction)
    -> /evolve (clusters instincts into skills)
```

### Storage

```
.opencode/learning/     (or .claude/learning/)
  instincts/
    personal/           Auto-learned instincts (version controlled)
    inherited/          Imported from teammates (version controlled)
  evolved/
    skills/             Graduated skills from instinct clusters
    commands/           Generated commands
    agents/             Generated agents
```

### Confidence Scoring

```
confidence = (successes + 1) / (applications + 2)    # Bayesian smoothing
```

| Score | Meaning |
|---|---|
| 0.3 | Tentative — needs more evidence |
| 0.5 | Moderate — applied when relevant |
| 0.7 | Strong — auto-approved |
| 0.9 | Near-certain — core behavior |

## Customization

### Adding project-specific instructions
Edit `INSTRUCTIONS.md` (copied to your project) with project-specific architecture, API endpoints, domain models, deployment process, and team conventions.

### Adding new commands
1. Create a markdown file in `shared/commands/` (e.g., `my-command.md`)
2. For OpenCode: add an entry to `opencode.json` under `command` in the copied config
3. For Claude: the command is automatically available via the symlinked `commands/` directory

### Adding new skills
1. Create a directory in `shared/skills/` with a `SKILL.md` file
2. Re-run `./setup.sh` or manually create the symlink in your project

### Adding new agents (OpenCode only)
1. Create an agent markdown file in `opencode/agents/`
2. Reference it from commands via the `"agent"` field in `opencode.json`

### Adjusting permissions
- **OpenCode**: Edit the `permission` section in `opencode.json`
- **Claude**: Edit `settings.json` allow/deny lists

### Enabling PostgreSQL MCP (OpenCode only)
In the copied `opencode.json`, set `mcp.postgres.enabled` to `true` and ensure `{{DATABASE_URL}}` was replaced during setup.

## Updating

Shared content (commands, skills) is symlinked. To update all projects at once:

```bash
cd ~/dev/ai_configs
git pull
```

Symlinks automatically pick up the changes. Tool-specific files (`opencode.json`, `CLAUDE.md`, `agents/`, etc.) are copies — update them manually per-project if needed.

## Requirements

- [OpenCode](https://opencode.ai) CLI and/or [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- Node.js (for OpenCode plugin dependencies)
- Go 1.25+ (for backend)
- PostgreSQL 16+ (for database)
- Python 3 (for setup script relative path calculation)

## License

Use freely in any project. No attribution required.
