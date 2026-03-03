---
description: Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy.
argument-hint: "scope like docs/06-helpers/posts.md"
context: fork
agent: validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Operation: sanity-check

Read the instruction file at `framework/instructions/validate/sanity-check.md` and follow it exactly.

User scope: $ARGUMENTS
