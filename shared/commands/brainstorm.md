---
description: "Explore an idea through collaborative dialogue before implementation. Understands intent, explores approaches, validates design incrementally. Usage: /brainstorm <idea or feature description>"
---

# Brainstorm

Load the `brainstorming` skill and follow it exactly.

**Topic**: $ARGUMENTS

## Quick Reference

This command is for **divergent thinking** — exploring what to build and why, before committing to how.

- If you already know exactly what you want and just need an implementation plan, use `/plan` instead
- If the idea is vague or has multiple possible interpretations, `/brainstorm` first, then `/plan`

## Workflow

1. **Understand** — Read project context, ask questions one at a time
2. **Explore** — Propose 2-3 approaches with trade-offs and your recommendation
3. **Design** — Present in 200-300 word sections, validate each with the user
4. **Document** — Save to `.plans/YYYY-MM-DD-<topic>-design.md`
5. **Hand off** — Offer to run `/plan` for detailed implementation breakdown
