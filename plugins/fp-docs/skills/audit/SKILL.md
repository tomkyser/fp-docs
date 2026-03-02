---
name: audit
description: Compare documentation against source code and report discrepancies. Supports quick, standard, and deep audit depths.
argument-hint: "--depth quick|standard|deep [scope]"
context: fork
agent: docs-validate
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Operation: audit

Read the instruction file at `framework/instructions/validate/audit.md` and follow it exactly.

User request: $ARGUMENTS
