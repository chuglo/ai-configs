/**
 * {{PROJECT_NAME}} - OpenCode Plugin Hooks
 *
 * Hooks for a Go + Next.js + PostgreSQL stack:
 *   - Audit console.log statements on session idle (batched)
 *   - Block edits to sqlc generated files
 *   - Warn on shadcn/ui component edits
 *   - Git push review reminder
 *   - Strategic compact counter
 *   - Desktop notification on session idle
 *   - PR creation logging
 *   - Session notes on compaction (rolling window of 10, descriptive filenames)
 *   - Session activity tracking (commands, errors, files read/written)
 *   - Rich context injection into compaction summaries
 *   - Session continuity hints on session start
 *   - DocWatch: detect architecture-relevant file edits and nudge for doc updates
 *   - DecisionWatch: detect project decisions (deferrals, promotions, arch choices) and nudge for doc updates
 *
 * NOTE: Auto session notes on idle are intentionally disabled. The manual
 * `/session-notes` command produces far richer notes with conversation context
 * and decisions. Auto notes only fire on compaction as a safety net.
 */

export const plugin = async ({ client, $, worktree }) => {
  console.log("[PROJECT-HOOKS] Plugin loaded (sqlc protection, strategic compact, rich session notes, DocWatch, DecisionWatch)")

  // ---------------------------------------------------------------------------
  // Session state tracking
  // ---------------------------------------------------------------------------

  const editedGoFiles = new Set()
  const editedTsFiles = new Set()
  const filesRead = new Set()
  const filesWritten = new Set()
  let toolCallCount = 0
  let sessionNotesWritten = false
  let currentTodos = []

  // ---------------------------------------------------------------------------
  // DocWatch — detect edits to architecture-relevant directories
  // ---------------------------------------------------------------------------

  const docRelevantEdits = new Map() // prefix -> Set<relative paths>

  // Directories whose edits may affect project documentation.
  // Standard for Go + Next.js projects. Add project-specific paths as needed.
  const DOC_RELEVANT_PREFIXES = [
    'internal/domain',
    'internal/handler',
    'internal/worker',
    'internal/store/migrations',
    'internal/store/queries',
    'internal/middleware',
    'internal/config',
    'internal/email',
    'internal/storage',
    'internal/server',
    'web/src/app',
    'docker',
    '.opencode/agents',
    '.opencode/commands',
    '.opencode/skills',
  ]

  function trackDocRelevantEdit(filePath) {
    const relPath = filePath.replace(worktree + "/", "")
    for (const prefix of DOC_RELEVANT_PREFIXES) {
      if (relPath.startsWith(prefix)) {
        if (!docRelevantEdits.has(prefix)) {
          docRelevantEdits.set(prefix, new Set())
        }
        docRelevantEdits.get(prefix).add(relPath)
        break
      }
    }
  }

  // Activity log — capped ring buffer of recent activity for rich notes
  const MAX_ACTIVITY_LOG = 100
  const activityLog = []

  // Error tracking
  const errorsEncountered = []
  const MAX_ERRORS = 20

  // Bash command tracking
  const bashCommands = []
  const MAX_BASH_COMMANDS = 30

  // Slash commands executed
  const slashCommands = []

  // ---------------------------------------------------------------------------
  // DecisionWatch — detect project decisions in conversation activity
  // ---------------------------------------------------------------------------

  const decisionsDetected = []
  const MAX_DECISIONS = 20

  // Patterns that suggest a project-level decision was made.
  // Matched against todo content, bash descriptions, and activity summaries.
  const DECISION_PATTERNS = [
    /\bdefer(?:red|ring)?\b/i,
    /\bpromot(?:ed|ing|e)\b/i,
    /\bmov(?:ed|ing|e)\s+(?:to|from)\s+phase\b/i,
    /\bdecid(?:ed|ing|e)\s+(?:to|against|not\s+to)\b/i,
    /\binstead\s+of\b/i,
    /\bswitch(?:ed|ing)?\s+(?:to|from)\b/i,
    /\breplac(?:ed|ing|e)\s+(?:with|by)\b/i,
    /\bdrop(?:ped|ping)?\s+(?:the|this|that)?\s*(?:feature|requirement|approach)\b/i,
    /\bchose\b|\bchoose\b|\bchosen\b/i,
    /\barchitectur(?:al|e)\s+decision\b/i,
    /\btrade-?off\b/i,
    /\bout\s+of\s+scope\b/i,
    /\bwon't\s+(?:do|implement|build|add)\b/i,
    /\bphase\s+\d/i,
    /\bprioritiz(?:ed|ing|e)\b/i,
    /\bde-?prioritiz(?:ed|ing|e)\b/i,
  ]

  function checkForDecision(text, source) {
    if (!text || text.length < 10) return
    for (const pattern of DECISION_PATTERNS) {
      if (pattern.test(text)) {
        decisionsDetected.push({
          time: new Date().toISOString().slice(11, 19),
          source,
          text: String(text).slice(0, 200),
        })
        if (decisionsDetected.length > MAX_DECISIONS) {
          decisionsDetected.shift()
        }
        return // one match per text is enough
      }
    }
  }

  // Session timing
  let sessionStartTime = null

  const SESSIONS_DIR = `${worktree}/.opencode/sessions`
  const MAX_SESSION_FILES = 10

  // ---------------------------------------------------------------------------
  // Activity logging helpers
  // ---------------------------------------------------------------------------

  function logActivity(type, summary) {
    const entry = {
      time: new Date().toISOString().slice(11, 19), // HH:MM:SS
      type,
      summary,
    }
    activityLog.push(entry)
    if (activityLog.length > MAX_ACTIVITY_LOG) {
      activityLog.shift()
    }

    // DecisionWatch: check activity summaries for decision-like language
    checkForDecision(summary, type)
  }

  function trackError(context, message) {
    errorsEncountered.push({
      time: new Date().toISOString().slice(11, 19),
      context,
      message: String(message).slice(0, 200),
    })
    if (errorsEncountered.length > MAX_ERRORS) {
      errorsEncountered.shift()
    }
  }

  function trackBashCommand(cmd, succeeded) {
    bashCommands.push({
      time: new Date().toISOString().slice(11, 19),
      cmd: String(cmd).slice(0, 150),
      succeeded,
    })
    if (bashCommands.length > MAX_BASH_COMMANDS) {
      bashCommands.shift()
    }
  }

  // ---------------------------------------------------------------------------
  // Session Notes helpers
  // ---------------------------------------------------------------------------

  function getTimestamp() {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
  }

  /**
   * Derive a descriptive session name from edited file domains.
   * Examples: "handler-auth", "frontend-dashboard", "migrations-store"
   * Falls back to "session" if nothing meaningful can be inferred.
   */
  function deriveSessionName() {
    const parts = []

    // Extract domain hints from edited files
    const allEdited = [...editedGoFiles, ...editedTsFiles].map((f) =>
      f.replace(worktree + "/", "")
    )

    if (allEdited.length > 0) {
      // Collect unique domain segments from file paths
      const domains = new Set()
      for (const f of allEdited) {
        // Extract meaningful path segments (skip common prefixes)
        const segments = f.split("/").filter(
          (s) => !["internal", "web", "src", "app", "components", "lib", "store"].includes(s)
        )
        // Take the first meaningful segment
        if (segments.length > 0) {
          const seg = segments[0].replace(/\.(go|ts|tsx|js|jsx)$/, "")
          if (seg && seg.length > 1) domains.add(seg)
        }
      }
      // Take up to 3 domain hints
      parts.push(...[...domains].slice(0, 3))
    }

    // If we got nothing from files, try to extract from todo content
    if (parts.length === 0 && currentTodos.length > 0) {
      const firstTodo = currentTodos[0].content.toLowerCase()
      // Extract first few meaningful words
      const words = firstTodo
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["the", "and", "for", "with", "from", "that", "this"].includes(w))
        .slice(0, 3)
      if (words.length > 0) parts.push(...words)
    }

    if (parts.length === 0) return "session"

    return parts
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 50)
  }

  function getSessionDuration() {
    if (!sessionStartTime) return "unknown"
    const ms = Date.now() - sessionStartTime
    const mins = Math.floor(ms / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  async function safeShell(cmd, fallback = "") {
    try {
      const result = await $`bash -c ${cmd}`.text()
      return result.trim()
    } catch {
      return fallback
    }
  }

  async function gatherGitState() {
    const [branch, status, log, diffStat, stashList] = await Promise.all([
      safeShell("git branch --show-current", "(unknown)"),
      safeShell("git status --short", "(unable to get status)"),
      safeShell("git log --oneline -10", "(no commits)"),
      safeShell("git diff --stat", "(no changes)"),
      safeShell("git stash list 2>/dev/null", ""),
    ])
    return { branch, status, log, diffStat, stashList }
  }

  /**
   * Build rich session notes from all tracked state.
   */
  function buildSessionNotes({ timestamp, git, trigger }) {
    const goFiles = [...editedGoFiles].map((f) => f.replace(worktree + "/", ""))
    const tsFiles = [...editedTsFiles].map((f) => f.replace(worktree + "/", ""))
    const allEdited = [...goFiles, ...tsFiles]
    const allRead = [...filesRead].map((f) => f.replace(worktree + "/", ""))
    const allWritten = [...filesWritten].map((f) => f.replace(worktree + "/", ""))

    // --- Sections ---

    const todoSection = currentTodos.length > 0
      ? currentTodos.map((t) => {
          const check = t.status === "completed" ? "x" : " "
          const priority = t.priority ? ` (${t.priority})` : ""
          return `- [${check}] ${t.content}${priority}`
        }).join("\n")
      : "_No todos tracked_"

    const editedSection = allEdited.length > 0
      ? allEdited.map((f) => `- \`${f}\``).join("\n")
      : "_No files edited this session_"

    const uncommitted = git.status.trim()
      ? `Yes\n\`\`\`\n${git.status}\n\`\`\``
      : "No uncommitted changes"

    const stashSection = git.stashList
      ? `\n### Stashes\n\`\`\`\n${git.stashList}\n\`\`\`\n`
      : ""

    // Files read (deduplicated against edited — only show files that were read but not edited)
    const editedSet = new Set(allEdited)
    const readOnly = allRead.filter((f) => !editedSet.has(f))
    const readSection = readOnly.length > 0
      ? `\n### Files Read (not edited)\n${readOnly.slice(0, 30).map((f) => `- \`${f}\``).join("\n")}${readOnly.length > 30 ? `\n- _...and ${readOnly.length - 30} more_` : ""}\n`
      : ""

    // New files created
    const newFiles = allWritten.filter((f) => !editedSet.has(f) || !allRead.includes(f))
    const newFilesSection = newFiles.length > 0
      ? `\n### Files Created\n${newFiles.map((f) => `- \`${f}\``).join("\n")}\n`
      : ""

    // Bash commands summary
    const bashSection = bashCommands.length > 0
      ? `\n### Commands Run\n${bashCommands.map((c) => `- \`${c.time}\` ${c.succeeded ? "OK" : "FAIL"}: \`${c.cmd}\``).join("\n")}\n`
      : ""

    // Errors encountered
    const errorSection = errorsEncountered.length > 0
      ? `\n### Errors Encountered\n${errorsEncountered.map((e) => `- \`${e.time}\` [${e.context}] ${e.message}`).join("\n")}\n`
      : ""

    // Slash commands
    const slashSection = slashCommands.length > 0
      ? `\n### Slash Commands Used\n${slashCommands.map((c) => `- \`${c}\``).join("\n")}\n`
      : ""

    // Decisions detected
    const decisionSection = decisionsDetected.length > 0
      ? `\n### Decisions Detected\n${decisionsDetected.map((d) => `- \`${d.time}\` [${d.source}] ${d.text}`).join("\n")}\n`
      : ""

    // Activity timeline (last 30 entries for readability)
    const recentActivity = activityLog.slice(-30)
    const activitySection = recentActivity.length > 0
      ? `\n### Activity Timeline (last ${recentActivity.length} events)\n${recentActivity.map((a) => `- \`${a.time}\` **${a.type}**: ${a.summary}`).join("\n")}\n`
      : ""

    return `# Session Notes — ${timestamp.replace("_", " ")}

> Auto-generated on **${trigger}** | ${getSessionDuration()} session | ${toolCallCount} tool calls | ${editedGoFiles.size} Go, ${editedTsFiles.size} TS/JS files edited

## Current State
- **Branch**: \`${git.branch}\`
- **Uncommitted changes**: ${uncommitted}
- **Session duration**: ${getSessionDuration()}
- **Tool calls**: ${toolCallCount}
${stashSection}
## Todo List
${todoSection}

## Files Edited This Session
${editedSection}
${newFilesSection}${readSection}
## Git State

### Recent Commits
\`\`\`
${git.log}
\`\`\`

### Diff Summary
\`\`\`
${git.diffStat}
\`\`\`
${bashSection}${errorSection}${decisionSection}${slashSection}${activitySection}
---

*For richer notes with conversation context and decisions, run \`/session-notes\` manually before ending a session.*
`
  }

  /**
   * Write session notes to disk and prune old files.
   * @param {string} trigger - What triggered the notes (e.g. "compaction", "manual")
   * @param {string} [nameOverride] - Optional descriptive name (from /session-notes argument)
   */
  async function writeSessionNotes(trigger, nameOverride) {
    try {
      const timestamp = getTimestamp()
      const git = await gatherGitState()
      const notes = buildSessionNotes({ timestamp, git, trigger })
      const sessionName = nameOverride
        ? nameOverride.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50)
        : deriveSessionName()
      const filename = `SESSION_${timestamp}_${sessionName}.md`
      const filepath = `${SESSIONS_DIR}/${filename}`

      await $`mkdir -p ${SESSIONS_DIR}`
      await $`bash -c ${`cat > "${filepath}" << 'SESSIONEOF'\n${notes}\nSESSIONEOF`}`

      console.log(`[PROJECT-HOOKS] Session notes written: ${filename}`)

      // Prune old files — keep only the last MAX_SESSION_FILES
      try {
        const files = await safeShell(`ls -1 "${SESSIONS_DIR}"/SESSION_*.md 2>/dev/null | sort`)
        if (files) {
          const fileList = files.split("\n").filter((f) => f.trim())
          if (fileList.length > MAX_SESSION_FILES) {
            const toDelete = fileList.slice(0, fileList.length - MAX_SESSION_FILES)
            for (const f of toDelete) {
              await $`rm -f ${f}`
            }
            console.log(`[PROJECT-HOOKS] Pruned ${toDelete.length} old session note(s)`)
          }
        }
      } catch {
        // Pruning is best-effort
      }

      sessionNotesWritten = true
      return { filepath, notes }
    } catch (error) {
      console.log(`[PROJECT-HOOKS] Failed to write session notes: ${error?.message || error}`)
      return null
    }
  }

  async function getLatestSessionNotes() {
    try {
      // SESSION files are named SESSION_YYYY-MM-DD_HH-MM_<name>.md
      // Sorting by name gives chronological order since timestamp is the prefix
      const latest = await safeShell(
        `ls -1 "${SESSIONS_DIR}"/SESSION_*.md 2>/dev/null | sort | tail -1`
      )
      return latest || null
    } catch {
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Hook implementations
  // ---------------------------------------------------------------------------

  return {
    /**
     * Generic event handler for session, file, and todo events.
     */
    event: async ({ event }) => {
      if (event.type === "session.created") {
        toolCallCount = 0
        editedGoFiles.clear()
        editedTsFiles.clear()
        filesRead.clear()
        filesWritten.clear()
        sessionNotesWritten = false
        currentTodos = []
        activityLog.length = 0
        errorsEncountered.length = 0
        bashCommands.length = 0
        slashCommands.length = 0
        docRelevantEdits.clear()
        decisionsDetected.length = 0
        sessionStartTime = Date.now()

        // Point the agent to the latest session notes for continuity
        const latest = await getLatestSessionNotes()
        if (latest) {
          const filename = latest.split("/").pop()
          console.log(`[PROJECT-HOOKS] [SessionNotes] Previous session notes available: .opencode/sessions/${filename}`)
          console.log(`[PROJECT-HOOKS] [SessionNotes] Read it for continuity context from the last session.`)
        }
      }

      if (event.type === "session.idle") {
        if (editedTsFiles.size > 0 || editedGoFiles.size > 0) {
          // Batched console.log audit — single grep across all edited TS/JS files
          if (editedTsFiles.size > 0) {
            try {
              const files = [...editedTsFiles]
              const result = await $`grep -rl "console\\.log" ${files} 2>/dev/null`.text()
              const matchedFiles = result.trim().split("\n").filter((f) => f.trim())
              if (matchedFiles.length > 0) {
                console.log(`[PROJECT-HOOKS] Audit: console.log found in ${matchedFiles.length} file(s): ${matchedFiles.join(", ")}`)
              }
            } catch {
              // No console.log found (grep returns non-zero when no matches)
            }
          }

          console.log(`[PROJECT-HOOKS] Session idle. ${editedGoFiles.size} Go, ${editedTsFiles.size} TS/JS files edited. ${toolCallCount} tool calls. Duration: ${getSessionDuration()}`)
        }

        // NOTE: Auto session notes on idle are intentionally disabled.
        // The manual /session-notes command produces far richer notes.
        // Auto notes only fire on compaction (see experimental.session.compacting).

        // DocWatch: one-line nudge if architecture-relevant files were edited
        if (docRelevantEdits.size > 0) {
          const dirs = [...docRelevantEdits.keys()].map(d => d.split('/').pop()).join(', ')
          console.log(`[PROJECT-HOOKS] [DocWatch] Edited: ${dirs} — consider /update-docs`)
        }

        // DecisionWatch: nudge if project decisions were detected in this session
        if (decisionsDetected.length > 0) {
          const unique = [...new Set(decisionsDetected.map(d => d.source))]
          console.log(`[PROJECT-HOOKS] [DecisionWatch] ${decisionsDetected.length} decision(s) detected (from: ${unique.join(', ')}) — consider /update-docs to capture rationale in ROADMAP.md`)
        }

        // Desktop notification (Linux)
        try {
          await $`notify-send "OpenCode" "Task completed!" 2>/dev/null`
        } catch {
          // not available
        }
      }

      if (event.type === "session.compacted") {
        console.log(`[PROJECT-HOOKS] Context compacted at ${toolCallCount} tool calls. Duration: ${getSessionDuration()}`)
      }

      if (event.type === "session.deleted") {
        editedGoFiles.clear()
        editedTsFiles.clear()
        filesRead.clear()
        filesWritten.clear()
        toolCallCount = 0
        sessionNotesWritten = false
        currentTodos = []
        activityLog.length = 0
        errorsEncountered.length = 0
        bashCommands.length = 0
        slashCommands.length = 0
        docRelevantEdits.clear()
        decisionsDetected.length = 0
        sessionStartTime = null
      }

      if (event.type === "file.edited") {
        const file = event.properties.file

        if (file.endsWith(".go")) {
          editedGoFiles.add(file)
        }

        if (/\.(ts|tsx|js|jsx)$/.test(file)) {
          editedTsFiles.add(file)
        }

        // DocWatch: track if this file is in a doc-relevant directory
        trackDocRelevantEdit(file)
      }

      if (event.type === "file.watcher.updated") {
        const file = event.properties.file
        if (event.properties.event !== "change") return
        if (file.endsWith(".go")) editedGoFiles.add(file)
        if (/\.(ts|tsx|js|jsx)$/.test(file)) editedTsFiles.add(file)
        trackDocRelevantEdit(file)
      }

      if (event.type === "todo.updated") {
        const todos = event.properties.todos
        currentTodos = todos
        const completed = todos.filter((t) => t.status === "completed").length
        const total = todos.length
        if (total > 0) {
          console.log(`[PROJECT-HOOKS] Progress: ${completed}/${total} tasks completed`)
        }

        // DecisionWatch: scan todo content for decision-like language
        for (const todo of todos) {
          checkForDecision(todo.content, "todo")
        }
      }
    },

    /**
     * Hook that fires BEFORE context compaction.
     * Writes rich session notes to disk, injects detailed context into the
     * compaction summary, and customizes the compaction prompt to produce
     * session-notes-quality output.
     */
    "experimental.session.compacting": async (input, output) => {
      console.log("[PROJECT-HOOKS] [SessionNotes] Compaction starting — capturing rich session state...")

      // Only write session notes to disk if the session had substantial work
      // (50+ tool calls AND at least one file edited). This prevents junk notes
      // from read-only or trivial sessions.
      const hasSubstantialWork = toolCallCount >= 50 && (editedGoFiles.size > 0 || editedTsFiles.size > 0)
      const result = hasSubstantialWork && !sessionNotesWritten
        ? await writeSessionNotes("compaction")
        : null

      if (!hasSubstantialWork) {
        console.log(`[PROJECT-HOOKS] [SessionNotes] Skipping file write (${toolCallCount} tool calls, ${editedGoFiles.size + editedTsFiles.size} files edited — below threshold)`)
      }

      // --- Build rich context for the compaction summary ---

      const goFiles = [...editedGoFiles].map((f) => f.replace(worktree + "/", ""))
      const tsFiles = [...editedTsFiles].map((f) => f.replace(worktree + "/", ""))
      const allEdited = [...goFiles, ...tsFiles]

      const todoSummary = currentTodos.length > 0
        ? currentTodos.map((t) => {
            const check = t.status === "completed" ? "x" : " "
            const priority = t.priority ? ` [${t.priority}]` : ""
            return `- [${check}] (${t.status})${priority} ${t.content}`
          }).join("\n")
        : "No todos tracked"

      const editedSummary = allEdited.length > 0
        ? allEdited.map((f) => `- \`${f}\``).join("\n")
        : "No files edited"

      // Include bash command history for context
      const bashSummary = bashCommands.length > 0
        ? bashCommands.slice(-15).map((c) => `- ${c.succeeded ? "OK" : "FAIL"}: \`${c.cmd}\``).join("\n")
        : "No commands run"

      // Include errors for context
      const errorSummary = errorsEncountered.length > 0
        ? errorsEncountered.map((e) => `- [${e.context}] ${e.message}`).join("\n")
        : "No errors"

      // Include slash commands for context
      const slashSummary = slashCommands.length > 0
        ? slashCommands.map((c) => `- \`${c}\``).join("\n")
        : "None"

      // Recent activity for context
      const recentActivity = activityLog.slice(-20)
      const activitySummary = recentActivity.length > 0
        ? recentActivity.map((a) => `- \`${a.time}\` **${a.type}**: ${a.summary}`).join("\n")
        : "No activity recorded"

      // Read the latest previous session notes for cross-session continuity
      let previousNotesHint = ""
      try {
        const files = await safeShell(`ls -1 "${SESSIONS_DIR}"/SESSION_*.md 2>/dev/null | sort`)
        if (files) {
          const fileList = files.split("\n").filter((f) => f.trim())
          // Get second-to-last (the one before the one we just wrote)
          if (fileList.length >= 2) {
            const prevFile = fileList[fileList.length - 2]
            const prevContent = await safeShell(`head -30 "${prevFile}" 2>/dev/null`)
            if (prevContent) {
              previousNotesHint = `\n### Previous Session Summary\n\`\`\`\n${prevContent}\n\`\`\`\n`
            }
          }
        }
      } catch {
        // Best-effort
      }

      output.context.push(`
## Session State (auto-captured before compaction)

**Session duration**: ${getSessionDuration()}
**Tool calls**: ${toolCallCount}
**Files edited**: ${editedGoFiles.size} Go, ${editedTsFiles.size} TS/JS

### Files Edited
${editedSummary}

### Todo List
${todoSummary}

### Commands Run (recent)
${bashSummary}

### Errors Encountered
${errorSummary}

### Slash Commands Used
${slashSummary}

### Recent Activity
${activitySummary}
${docRelevantEdits.size > 0
  ? `\n### Documentation Watch\nArchitecture-relevant files were edited. Documentation may need updating.\nAffected areas:\n${
      [...docRelevantEdits.entries()]
        .map(([dir, files]) => `- **${dir}/**: ${[...files].map(f => '`' + f + '`').join(', ')}`)
        .join('\n')
    }\nRun \`/update-docs\` or ask the agent to update affected documentation.\n`
  : ''}
${decisionsDetected.length > 0
  ? `### Decisions Detected\nProject-level decisions were made during this session. Ensure these are captured in ROADMAP.md or relevant docs:\n${
      decisionsDetected.map(d => `- [${d.source}] ${d.text}`).join('\n')
    }\nRun \`/update-docs\` to capture decision rationale.\n`
  : ''}
${previousNotesHint}
### Session Notes File
${result ? `Full session notes written to: \`.opencode/sessions/${result.filepath.split("/").pop()}\`` : hasSubstantialWork ? "Failed to write session notes" : "Skipped (session below threshold — use `/session-notes` for manual capture)"}

**IMPORTANT**: After compaction, read the latest file in \`.opencode/sessions/\` for full session context. The file contains git state, file edit history, command history, errors, and todo state.
`)

      console.log("[PROJECT-HOOKS] [SessionNotes] Rich session state injected into compaction context")
    },

    /**
     * Pre-tool execution hook.
     * Tracks tool calls, logs activity, and enforces protections.
     */
    "tool.execute.before": async (input, output) => {
      toolCallCount++

      const args = output.args || {}

      // --- Activity tracking ---

      if (input.tool === "read") {
        const fp = String(args.filePath || "")
        if (fp) {
          filesRead.add(fp)
          logActivity("read", fp.replace(worktree + "/", ""))
        }
      }

      if (input.tool === "write") {
        const fp = String(args.filePath || "")
        if (fp) {
          filesWritten.add(fp)
          logActivity("write", fp.replace(worktree + "/", ""))
        }
      }

      if (input.tool === "edit") {
        const fp = String(args.filePath || "")
        if (fp) {
          logActivity("edit", fp.replace(worktree + "/", ""))
        }
      }

      if (input.tool === "bash") {
        const cmd = String(args.command || "")
        const desc = String(args.description || cmd).slice(0, 80)
        logActivity("bash", desc)
      }

      if (input.tool === "glob") {
        logActivity("search", `glob: ${String(args.pattern || "").slice(0, 60)}`)
      }

      if (input.tool === "grep") {
        logActivity("search", `grep: ${String(args.pattern || "").slice(0, 60)}`)
      }

      if (input.tool === "task") {
        const desc = String(args.description || "").slice(0, 60)
        const agent = String(args.subagent_type || "")
        logActivity("task", `${agent}: ${desc}`)
      }

      // Track slash commands (detected via command tool or bash curl to /command)
      if (input.tool === "command") {
        const cmd = String(args.command || "")
        if (cmd) {
          slashCommands.push(cmd)
          logActivity("command", `/${cmd}`)
        }
      }

      // Strategic compact suggestions (now also suggest /session-notes)
      if (toolCallCount === 50) {
        console.log("[PROJECT-HOOKS] [StrategicCompact] 50 tool calls - consider /session-notes then /compact if transitioning phases")
      } else if (toolCallCount > 50 && toolCallCount % 25 === 0) {
        console.log(`[PROJECT-HOOKS] [StrategicCompact] ${toolCallCount} tool calls - good checkpoint for /session-notes and /compact`)
      }

      // Git push review
      if (input.tool === "bash") {
        const cmd = String(args.command || "")
        if (cmd.includes("git push")) {
          console.log("[PROJECT-HOOKS] Review before push: git diff origin/main...HEAD")
        }
      }

      // Protect sqlc generated files
      if (input.tool === "edit" || input.tool === "write") {
        const filePath = String(args.filePath || "")

        if (filePath.includes("internal/store/sqlc/")) {
          throw new Error(
            `Cannot edit sqlc-generated file: ${filePath}. Edit internal/store/queries/*.sql instead, then run 'sqlc generate'.`
          )
        }

        if (filePath.includes("web/src/components/ui/")) {
          console.log(`[PROJECT-HOOKS] ${filePath} is a shadcn/ui component. Modify via shadcn CLI, not by hand.`)
        }
      }
    },

    /**
     * Post-tool execution hook.
     * Tracks results, errors, and runs automated checks.
     */
    "tool.execute.after": async (input, output) => {
      const metadata = output.metadata || {}

      // Track bash command results
      // NOTE: In the after hook, the original tool args are on `input.args`,
      // not `output.args`. The output contains the result/error.
      if (input.tool === "bash") {
        const cmd = String(input.args?.command || output.args?.command || "").slice(0, 150)
        const succeeded = !output.error
        trackBashCommand(cmd, succeeded)

        if (output.error) {
          trackError("bash", `\`${cmd.slice(0, 80)}\`: ${String(output.error).slice(0, 120)}`)
        }

        // PR creation logging
        const bashOutput = String(output.output || output.result || "")
        if (
          bashOutput.includes("github.com") &&
          bashOutput.includes("/pull/")
        ) {
          console.log("[PROJECT-HOOKS] PR created - check GitHub Actions status")
          logActivity("pr", "Pull request created")
        }
      }

      // Track tool errors
      if (output.error && input.tool !== "bash") {
        trackError(input.tool, String(output.error).slice(0, 200))
      }
    },
  }
}

export default plugin
