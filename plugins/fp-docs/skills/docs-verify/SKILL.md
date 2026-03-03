---
name: docs-verify
description: Run the 10-point verification checklist on documentation files without making changes. Reports pass/fail for each check.
argument-hint: "optional scope like docs/06-helpers/"
context: fork
agent: docs-validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Operation: verify

Read the instruction file at `framework/instructions/validate/verify.md` and follow it exactly.

User scope: $ARGUMENTS
