---
description: Auto-detect code changes since last documentation update and handle everything. Scans git diff, identifies affected docs, and updates them.
argument-hint: "optional scope restriction"
context: fork
agent: orchestrate
---

Engine: modify
Operation: auto-update
Instruction: framework/instructions/modify/auto-update.md

Changed files since last docs update:
!`git diff --name-only HEAD~5 -- themes/foreign-policy-2017/`!

User scope restriction (if any): $ARGUMENTS
