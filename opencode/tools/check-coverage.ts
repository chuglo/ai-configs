/**
 * Check Coverage Tool - {{PROJECT_NAME}}
 *
 * Custom OpenCode tool to analyze test coverage for both Go backend and Next.js frontend.
 * Reads coverage reports from standard locations.
 */

import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

export default tool({
  description:
    "Check test coverage for Go backend and/or Next.js frontend against a threshold. Identifies files with low coverage.",
  args: {
    stack: tool.schema
      .enum(["go", "web", "both"])
      .optional()
      .describe("Which stack to check: go (backend), web (frontend), or both (default: both)"),
    threshold: tool.schema
      .number()
      .optional()
      .describe("Minimum coverage percentage required (default: 80)"),
    showUncovered: tool.schema
      .boolean()
      .optional()
      .describe("Show list of uncovered files (default: true)"),
  },
  async execute(args, context) {
    const stack = args.stack ?? "both"
    const threshold = args.threshold ?? 80
    const showUncovered = args.showUncovered ?? true
    const cwd = context.worktree || context.directory

    const results: CoverageResults = {
      threshold,
      stacks: [],
      overallPassed: true,
    }

    // Go backend coverage
    if (stack === "go" || stack === "both") {
      const goResult = checkGoCoverage(cwd, threshold, showUncovered)
      results.stacks.push(goResult)
      if (!goResult.passed) results.overallPassed = false
    }

    // Next.js frontend coverage
    if (stack === "web" || stack === "both") {
      const webResult = checkWebCoverage(cwd, threshold, showUncovered)
      results.stacks.push(webResult)
      if (!webResult.passed) results.overallPassed = false
    }

    // Generate suggestions
    results.suggestions = generateSuggestions(results)

    return results
  },
})

interface StackCoverage {
  stack: string
  passed: boolean
  percentage: number | null
  reportFound: boolean
  reportPath: string | null
  uncoveredFiles?: Array<{ file: string; percentage: number }>
  generateCommand: string
}

interface CoverageResults {
  threshold: number
  stacks: StackCoverage[]
  overallPassed: boolean
  suggestions?: string[]
}

function checkGoCoverage(cwd: string, threshold: number, showUncovered: boolean): StackCoverage {
  const coverageFile = path.join(cwd, "coverage.out")

  if (!fs.existsSync(coverageFile)) {
    return {
      stack: "go",
      passed: false,
      percentage: null,
      reportFound: false,
      reportPath: null,
      generateCommand: "go test -cover -coverprofile=coverage.out ./...",
    }
  }

  try {
    const content = fs.readFileSync(coverageFile, "utf-8")
    const lines = content.split("\n").filter((l) => !l.startsWith("mode:") && l.trim().length > 0)

    if (lines.length === 0) {
      return {
        stack: "go",
        passed: false,
        percentage: 0,
        reportFound: true,
        reportPath: "coverage.out",
        generateCommand: "go test -cover -coverprofile=coverage.out ./...",
      }
    }

    // Parse Go coverage format: file:startLine.startCol,endLine.endCol numStatements count
    const fileStats = new Map<string, { total: number; covered: number }>()
    let totalStatements = 0
    let coveredStatements = 0

    for (const line of lines) {
      const match = line.match(/^(.+?):[\d.]+,[\d.]+ (\d+) (\d+)$/)
      if (!match) continue

      const [, file, statementsStr, countStr] = match
      const statements = parseInt(statementsStr, 10)
      const count = parseInt(countStr, 10)

      totalStatements += statements
      if (count > 0) coveredStatements += statements

      const existing = fileStats.get(file) || { total: 0, covered: 0 }
      existing.total += statements
      if (count > 0) existing.covered += statements
      fileStats.set(file, existing)
    }

    const percentage = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
    const passed = percentage >= threshold

    const result: StackCoverage = {
      stack: "go",
      passed,
      percentage: Math.round(percentage * 10) / 10,
      reportFound: true,
      reportPath: "coverage.out",
      generateCommand: "go test -cover -coverprofile=coverage.out ./...",
    }

    if (showUncovered) {
      result.uncoveredFiles = Array.from(fileStats.entries())
        .map(([file, stats]) => ({
          file,
          percentage: stats.total > 0 ? Math.round((stats.covered / stats.total) * 1000) / 10 : 0,
        }))
        .filter((f) => f.percentage < threshold)
        .sort((a, b) => a.percentage - b.percentage)
        .slice(0, 20)
    }

    return result
  } catch {
    return {
      stack: "go",
      passed: false,
      percentage: null,
      reportFound: true,
      reportPath: "coverage.out",
      generateCommand: "go test -cover -coverprofile=coverage.out ./...",
    }
  }
}

function checkWebCoverage(cwd: string, threshold: number, showUncovered: boolean): StackCoverage {
  const coveragePaths = [
    "web/coverage/coverage-summary.json",
    "web/coverage/coverage-final.json",
    "web/.nyc_output/coverage.json",
  ]

  for (const coveragePath of coveragePaths) {
    const fullPath = path.join(cwd, coveragePath)
    if (!fs.existsSync(fullPath) || !coveragePath.endsWith(".json")) continue

    try {
      const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
      const parsed = parseIstanbulCoverage(content)

      const passed = parsed.percentage >= threshold

      const result: StackCoverage = {
        stack: "web",
        passed,
        percentage: Math.round(parsed.percentage * 10) / 10,
        reportFound: true,
        reportPath: coveragePath,
        generateCommand: "cd web && npm test -- --coverage",
      }

      if (showUncovered) {
        result.uncoveredFiles = parsed.files
          .filter((f) => f.percentage < threshold)
          .sort((a, b) => a.percentage - b.percentage)
          .slice(0, 20)
      }

      return result
    } catch {
      continue
    }
  }

  return {
    stack: "web",
    passed: false,
    percentage: null,
    reportFound: false,
    reportPath: null,
    generateCommand: "cd web && npm test -- --coverage",
  }
}

function parseIstanbulCoverage(data: Record<string, unknown>): {
  percentage: number
  files: Array<{ file: string; percentage: number }>
} {
  const files: Array<{ file: string; percentage: number }> = []
  let totalLines = 0
  let coveredLines = 0

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "object" || value === null) continue

    const fileData = value as Record<string, { total?: number; covered?: number }>

    if (key === "total" && fileData.lines) {
      totalLines = fileData.lines.total || 0
      coveredLines = fileData.lines.covered || 0
    } else if (fileData.lines) {
      const ft = fileData.lines.total || 0
      const fc = fileData.lines.covered || 0
      files.push({
        file: key,
        percentage: ft > 0 ? Math.round((fc / ft) * 1000) / 10 : 100,
      })
    }
  }

  return {
    percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    files,
  }
}

function generateSuggestions(results: CoverageResults): string[] {
  const suggestions: string[] = []

  for (const stack of results.stacks) {
    if (!stack.reportFound) {
      suggestions.push(`[${stack.stack}] No coverage report found. Run: ${stack.generateCommand}`)
    } else if (!stack.passed && stack.percentage !== null) {
      suggestions.push(
        `[${stack.stack}] Coverage ${stack.percentage}% is below ${results.threshold}% threshold.`
      )
      if (stack.uncoveredFiles && stack.uncoveredFiles.length > 0) {
        const top3 = stack.uncoveredFiles.slice(0, 3)
        suggestions.push(
          `[${stack.stack}] Focus on: ${top3.map((f) => `${f.file} (${f.percentage}%)`).join(", ")}`
        )
      }
    }
  }

  if (suggestions.length === 0) {
    suggestions.push("All stacks meet the coverage threshold.")
  }

  return suggestions
}
