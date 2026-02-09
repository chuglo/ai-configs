/**
 * Run Tests Tool - {{PROJECT_NAME}}
 *
 * Custom OpenCode tool to run test suites for Go backend and/or Next.js frontend.
 * Automatically detects which stack to test based on arguments or runs both.
 */

import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

export default tool({
  description:
    "Run the test suite for Go backend, Next.js frontend, or both. Supports coverage, race detection, pattern filtering, and watch mode.",
  args: {
    stack: tool.schema
      .enum(["go", "web", "both"])
      .optional()
      .describe("Which stack to test: go (backend), web (frontend), or both (default: both)"),
    pattern: tool.schema
      .string()
      .optional()
      .describe("Test pattern - Go: package path or -run regex; Web: test file pattern"),
    coverage: tool.schema
      .boolean()
      .optional()
      .describe("Run with coverage reporting (default: false)"),
    race: tool.schema
      .boolean()
      .optional()
      .describe("Go only: enable race detector (default: true for Go)"),
    watch: tool.schema
      .boolean()
      .optional()
      .describe("Web only: run in watch mode (default: false)"),
    verbose: tool.schema
      .boolean()
      .optional()
      .describe("Verbose test output (default: false)"),
  },
  async execute(args, context) {
    const stack = args.stack ?? "both"
    const { pattern, coverage, watch, verbose } = args
    const race = args.race ?? true
    const cwd = context.worktree || context.directory

    const commands: Array<{ name: string; command: string; stack: string }> = []

    // Go backend tests
    if (stack === "go" || stack === "both") {
      const goCmd = buildGoTestCommand({ pattern, coverage, race, verbose })
      commands.push({ name: "Go Backend Tests", command: goCmd, stack: "go" })
    }

    // Next.js frontend tests
    if (stack === "web" || stack === "both") {
      const webCmd = buildWebTestCommand({ pattern, coverage, watch, verbose, cwd })
      commands.push({ name: "Next.js Frontend Tests", command: webCmd, stack: "web" })
    }

    return {
      commands,
      instructions: commands
        .map((c) => `## ${c.name}\n\`\`\`bash\n${c.command}\n\`\`\``)
        .join("\n\n"),
      options: {
        stack,
        pattern: pattern || "all tests",
        coverage: coverage || false,
        race: stack !== "web" ? race : undefined,
        watch: stack !== "go" ? (watch || false) : undefined,
        verbose: verbose || false,
      },
    }
  },
})

function buildGoTestCommand(opts: {
  pattern?: string
  coverage?: boolean
  race: boolean
  verbose?: boolean
}): string {
  const parts = ["go", "test"]

  if (opts.race) parts.push("-race")
  if (opts.coverage) parts.push("-cover", "-coverprofile=coverage.out")
  if (opts.verbose) parts.push("-v")

  parts.push("-count=1")

  if (opts.pattern) {
    // If pattern looks like a package path, use it directly
    if (opts.pattern.startsWith("./") || opts.pattern.startsWith("internal/")) {
      parts.push(opts.pattern.startsWith("./") ? opts.pattern : `./${opts.pattern}`)
    } else {
      // Otherwise treat as -run regex
      parts.push("./...", "-run", opts.pattern)
    }
  } else {
    parts.push("./...")
  }

  return parts.join(" ")
}

function buildWebTestCommand(opts: {
  pattern?: string
  coverage?: boolean
  watch?: boolean
  verbose?: boolean
  cwd: string
}): string {
  // Detect package manager for web/
  const webDir = path.join(opts.cwd, "web")
  const pm = detectPackageManager(webDir)

  const parts: string[] = []

  // Use Makefile target if available and no special options
  if (!opts.pattern && !opts.coverage && !opts.watch && !opts.verbose) {
    return "make test-web"
  }

  if (pm === "npm") {
    parts.push("cd web &&", "npm", "run", "test")
  } else {
    parts.push("cd web &&", pm, "test")
  }

  const testArgs: string[] = []
  if (opts.coverage) testArgs.push("--coverage")
  if (opts.watch) testArgs.push("--watch")
  if (opts.pattern) testArgs.push("--testPathPattern", opts.pattern)

  if (testArgs.length > 0) {
    if (pm === "npm") parts.push("--")
    parts.push(...testArgs)
  }

  return parts.join(" ")
}

function detectPackageManager(dir: string): string {
  const lockFiles: Record<string, string> = {
    "bun.lockb": "bun",
    "bun.lock": "bun",
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "yarn",
    "package-lock.json": "npm",
  }

  for (const [lockFile, pm] of Object.entries(lockFiles)) {
    if (fs.existsSync(path.join(dir, lockFile))) {
      return pm
    }
  }

  return "npm"
}
