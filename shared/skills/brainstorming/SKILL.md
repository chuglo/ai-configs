---
name: brainstorming
description: "Collaborative design exploration before implementation. Explores user intent, requirements, and design through structured dialogue before handing off to /plan."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

### Phase 1: Understand the Idea

- **Check project context first** — Read relevant docs (`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/PRD.md`), recent git history, and existing code in the affected area
- **Ask questions one at a time** — Don't overwhelm with a wall of questions
- **Prefer multiple choice** — Easier to answer than open-ended when possible; use the question tool to present structured choices
- **Only one question per message** — If a topic needs more exploration, break it into multiple questions
- **Focus on understanding**: purpose, constraints, success criteria, who benefits, what changes

### Phase 2: Explore Approaches

- **Propose 2-3 different approaches** with clear trade-offs
- **Lead with your recommendation** and explain why
- Present options conversationally — this isn't a formal document yet
- Consider: complexity, risk, reuse of existing patterns, future flexibility
- **Apply YAGNI ruthlessly** — If a capability isn't needed for the stated goal, cut it

### Phase 3: Present the Design

Once you believe you understand what you're building:

- **Break the design into sections of 200-300 words**
- **Ask after each section** whether it looks right so far
- Cover the areas relevant to the feature:
  - Architecture and component boundaries
  - Data model and storage
  - API contract (endpoints, request/response shapes)
  - Frontend UX flow
  - Error handling and edge cases
  - Security and multi-tenancy implications
  - Testing strategy
- **Be ready to go back** — If something doesn't make sense, revisit earlier decisions

### Phase 4: Document and Hand Off

After the design is validated:

1. **Save the design** to `.plans/YYYY-MM-DD-<topic>-design.md`
   - Include: problem statement, chosen approach with rationale, rejected alternatives, design sections as validated, open questions
   - Set status to `Draft` (it becomes `Approved` after `/plan` expands it)

2. **Bridge to implementation** — Ask:
   > "Design looks solid. Want me to run `/plan` to expand this into a detailed implementation plan with SQL, API contracts, and frontend components?"

   The brainstorm output becomes the input to `/plan`, which handles the detailed implementation breakdown.

## Key Principles

- **One question at a time** — Don't overwhelm with multiple questions
- **Multiple choice preferred** — Easier to answer than open-ended when possible
- **YAGNI ruthlessly** — Remove unnecessary features from all designs
- **Explore alternatives** — Always propose 2-3 approaches before settling
- **Incremental validation** — Present design in sections, validate each
- **Be flexible** — Go back and clarify when something doesn't make sense
- **Don't duplicate /plan** — Brainstorming produces the *what* and *why*; `/plan` produces the *how*
