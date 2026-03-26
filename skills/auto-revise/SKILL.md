---
description: Batch-process all items listed in the needs-revision-tracker. Reads the tracker, processes each item, and marks them complete.
argument-hint: "optional flags like --dry-run"
context: fork
agent: orchestrate
---

Engine: modify
Operation: auto-revise
Instruction: framework/instructions/modify/auto-revise.md

User flags: $ARGUMENTS
