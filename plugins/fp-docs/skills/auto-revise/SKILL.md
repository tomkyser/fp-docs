---
name: docs-auto-revise
description: Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete.
argument-hint: "optional flags like --dry-run"
context: fork
agent: docs-modify
---

Operation: auto-revise

Read the instruction file at `framework/instructions/modify/auto-revise.md` and follow it exactly.

User flags: $ARGUMENTS
