---
name: docs-verbosity-audit
description: Scan existing documentation for verbosity gaps — missing items, summarization language, unexpanded enumerables.
argument-hint: "--depth quick|standard|deep [scope]"
context: fork
agent: docs-verbosity
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Operation: audit

Read the instruction file at `framework/instructions/verbosity/audit.md` and follow it exactly.

User request: $ARGUMENTS
