/**
 * Security Audit Tool - {{PROJECT_NAME}}
 *
 * Custom OpenCode tool to run security audits across Go backend and Next.js frontend.
 * Combines dependency auditing, secret scanning, and project-specific security checks.
 *
 * NOTE: This tool SCANS for security anti-patterns - it does not introduce them.
 * The regex patterns below are used to DETECT potential issues in user code.
 */

import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import * as fs from "fs"

export default tool({
  description:
    "Run a comprehensive security audit including dependency vulnerabilities, secret scanning, and project-specific security checks (multi-tenancy, auth, file uploads).",
  args: {
    type: tool.schema
      .enum(["all", "dependencies", "secrets", "code", "project"])
      .optional()
      .describe("Type of audit: all, dependencies, secrets, code patterns, or project-specific checks (default: all)"),
    severity: tool.schema
      .enum(["low", "moderate", "high", "critical"])
      .optional()
      .describe("Minimum severity level to report (default: moderate)"),
  },
  async execute(args, context) {
    const auditType = args.type ?? "all"
    const severity = args.severity ?? "moderate"
    const cwd = context.worktree || context.directory

    const results: AuditResults = {
      timestamp: new Date().toISOString(),
      directory: cwd,
      checks: [],
      summary: { passed: 0, failed: 0, warnings: 0 },
    }

    // Dependency audit
    if (auditType === "all" || auditType === "dependencies") {
      results.checks.push({
        name: "Go Module Vulnerabilities",
        description: "Check Go modules for known vulnerabilities",
        command: "govulncheck ./...",
        status: "pending",
      })
      results.checks.push({
        name: "npm Dependency Vulnerabilities",
        description: "Check npm packages for known vulnerabilities",
        command: "cd web && npm audit",
        severityFilter: severity,
        status: "pending",
      })
    }

    // Secret scanning
    if (auditType === "all" || auditType === "secrets") {
      const secretFindings = await scanForSecrets(cwd)
      if (secretFindings.length > 0) {
        results.checks.push({
          name: "Secret Detection",
          description: "Scan for hardcoded secrets, API keys, and credentials",
          status: "failed",
          findings: secretFindings,
        })
        results.summary.failed++
      } else {
        results.checks.push({
          name: "Secret Detection",
          description: "Scan for hardcoded secrets, API keys, and credentials",
          status: "passed",
        })
        results.summary.passed++
      }
    }

    // Code security patterns
    if (auditType === "all" || auditType === "code") {
      const codeFindings = await scanCodeSecurity(cwd)
      if (codeFindings.length > 0) {
        results.checks.push({
          name: "Code Security Patterns",
          description: "Check for common security anti-patterns in Go and TypeScript",
          status: "warning",
          findings: codeFindings,
        })
        results.summary.warnings++
      } else {
        results.checks.push({
          name: "Code Security Patterns",
          description: "Check for common security anti-patterns",
          status: "passed",
        })
        results.summary.passed++
      }
    }

    // Project-specific security checks
    if (auditType === "all" || auditType === "project") {
      const projectFindings = await scanProjectSecurity(cwd)
      if (projectFindings.length > 0) {
        results.checks.push({
          name: "Project Security (Multi-Tenancy & Auth)",
          description: "Check for project-specific security issues: org_id derivation, RBAC, file uploads, CSRF",
          status: "warning",
          findings: projectFindings,
        })
        results.summary.warnings++
      } else {
        results.checks.push({
          name: "Project Security (Multi-Tenancy & Auth)",
          description: "Project-specific security checks passed",
          status: "passed",
        })
        results.summary.passed++
      }
    }

    results.recommendations = generateRecommendations(results)
    return results
  },
})

interface AuditCheck {
  name: string
  description: string
  command?: string
  severityFilter?: string
  status: "pending" | "passed" | "failed" | "warning"
  findings?: Array<{ file: string; issue: string; line?: number }>
}

interface AuditResults {
  timestamp: string
  directory: string
  checks: AuditCheck[]
  summary: { passed: number; failed: number; warnings: number }
  recommendations?: string[]
}

// -- Secret scanning --

async function scanForSecrets(
  cwd: string
): Promise<Array<{ file: string; issue: string; line?: number }>> {
  const findings: Array<{ file: string; issue: string; line?: number }> = []

  // Patterns to DETECT potential secrets (security scanning)
  const secretPatterns = [
    { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/gi, name: "API Key" },
    { pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi, name: "Hardcoded Password" },
    { pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/gi, name: "Secret Value" },
    { pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, name: "JWT Token" },
    { pattern: /sk-[a-zA-Z0-9]{32,}/g, name: "OpenAI API Key" },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub Token" },
    { pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, name: "AWS Secret" },
    { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },
  ]

  const ignorePatterns = [
    "node_modules", ".git", "dist", "build", ".next",
    ".env.example", ".env.template", "vendor",
    "internal/store/sqlc", // generated
    "web/src/components/ui", // shadcn
  ]

  // Scan Go source
  const goDir = path.join(cwd, "internal")
  if (fs.existsSync(goDir)) {
    await scanDirectory(goDir, secretPatterns, ignorePatterns, findings, [".go"])
  }

  // Scan frontend source
  const webSrc = path.join(cwd, "web", "src")
  if (fs.existsSync(webSrc)) {
    await scanDirectory(webSrc, secretPatterns, ignorePatterns, findings, [".ts", ".tsx", ".js", ".jsx"])
  }

  // Check root config files
  const rootConfigs = ["docker-compose.yml", "docker-compose.dev.yml", "Makefile"]
  for (const configFile of rootConfigs) {
    const filePath = path.join(cwd, configFile)
    if (fs.existsSync(filePath)) {
      await scanFile(filePath, secretPatterns, findings)
    }
  }

  return findings
}

// -- Code security patterns --

async function scanCodeSecurity(
  cwd: string
): Promise<Array<{ file: string; issue: string; line?: number }>> {
  const findings: Array<{ file: string; issue: string; line?: number }> = []

  // Go-specific anti-patterns
  const goPatterns = [
    { pattern: /fmt\.Sprintf\(.*%s.*\+.*sql/gi, name: "Potential SQL injection via string formatting" },
    { pattern: /exec\.Command\(/g, name: "Shell command execution - verify input sanitization" },
    { pattern: /template\.HTML\(/g, name: "Unescaped HTML template - verify sanitization" },
    { pattern: /http\.ListenAndServe\(/g, name: "HTTP without TLS - ensure reverse proxy handles TLS" },
  ]

  // TypeScript/React anti-patterns
  const tsPatterns = [
    { pattern: /dangerouslySetInnerHTML/g, name: "dangerouslySetInnerHTML - potential XSS" },
    { pattern: /innerHTML\s*=/g, name: "innerHTML assignment - potential XSS" },
    { pattern: /\beval\s*\(/g, name: "eval() usage - potential code injection" },
    { pattern: /document\.write/g, name: "document.write - potential XSS" },
  ]

  const ignorePatterns = ["node_modules", ".git", "dist", "build", ".next", "vendor", "internal/store/sqlc", "web/src/components/ui"]

  const goDir = path.join(cwd, "internal")
  if (fs.existsSync(goDir)) {
    await scanDirectory(goDir, goPatterns, ignorePatterns, findings, [".go"])
  }

  const webSrc = path.join(cwd, "web", "src")
  if (fs.existsSync(webSrc)) {
    await scanDirectory(webSrc, tsPatterns, ignorePatterns, findings, [".ts", ".tsx", ".js", ".jsx"])
  }

  return findings
}

// -- Project-specific security checks --

async function scanProjectSecurity(
  cwd: string
): Promise<Array<{ file: string; issue: string; line?: number }>> {
  const findings: Array<{ file: string; issue: string; line?: number }> = []

  const projectPatterns = [
    // Multi-tenancy: org_id should come from context, not request body
    {
      pattern: /r\.Body.*organization_id|json:"organization_id"/g,
      name: "organization_id in request body - must derive from session context",
    },
    // Raw SQL strings (should use sqlc)
    {
      pattern: /db\.(Query|Exec|QueryRow)\s*\(\s*ctx\s*,\s*"/g,
      name: "Raw SQL query - use sqlc generated queries instead",
    },
    // Missing HTML sanitization on user markdown
    {
      pattern: /goldmark\.New\(\)\.Convert/g,
      name: "Markdown rendering without HTML sanitization",
    },
    // File upload without content-type validation
    {
      pattern: /r\.FormFile\(/g,
      name: "File upload detected - verify content-type and size validation",
    },
  ]

  const ignorePatterns = ["node_modules", ".git", "dist", "vendor", "internal/store/sqlc", "_test.go"]

  const goDir = path.join(cwd, "internal")
  if (fs.existsSync(goDir)) {
    await scanDirectory(goDir, projectPatterns, ignorePatterns, findings, [".go"])
  }

  return findings
}

// -- Shared scanning utilities --

async function scanDirectory(
  dir: string,
  patterns: Array<{ pattern: RegExp; name: string }>,
  ignorePatterns: string[],
  findings: Array<{ file: string; issue: string; line?: number }>,
  extensions: string[]
): Promise<void> {
  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (ignorePatterns.some((p) => fullPath.includes(p))) continue

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, patterns, ignorePatterns, findings, extensions)
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      await scanFile(fullPath, patterns, findings)
    }
  }
}

async function scanFile(
  filePath: string,
  patterns: Array<{ pattern: RegExp; name: string }>,
  findings: Array<{ file: string; issue: string; line?: number }>
): Promise<void> {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { pattern, name } of patterns) {
        pattern.lastIndex = 0
        if (pattern.test(line)) {
          findings.push({ file: filePath, issue: name, line: i + 1 })
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

function generateRecommendations(results: AuditResults): string[] {
  const recommendations: string[] = []

  for (const check of results.checks) {
    if (check.status === "failed" && check.name === "Secret Detection") {
      recommendations.push("CRITICAL: Remove hardcoded secrets and use environment variables")
      recommendations.push("Ensure .env files are in .gitignore")
      recommendations.push("Use docker-compose env_file or Docker secrets for production")
    }

    if (check.status === "warning" && check.name.includes("Project")) {
      recommendations.push("Review org_id derivation - must come from middleware.OrgID(ctx), never request body")
      recommendations.push("Ensure all SQL goes through sqlc - no raw db.Query/Exec calls")
      recommendations.push("Sanitize user-generated HTML/markdown before rendering")
      recommendations.push("Validate file upload content-type against allowlist")
    }

    if (check.status === "warning" && check.name === "Code Security Patterns") {
      recommendations.push("Review flagged code patterns for potential vulnerabilities")
      recommendations.push("Go: use html/template (not text/template) for HTML output")
      recommendations.push("Frontend: use React's default escaping, avoid dangerouslySetInnerHTML")
    }

    if (check.status === "pending") {
      recommendations.push(`Run manually: ${check.command}`)
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("No critical security issues found. Continue following the project security checklist.")
  }

  return recommendations
}
