---
name: auto-update
description: Auto-detect code changes since last documentation update and handle everything. Scans git diff, identifies affected docs, and updates them.
argument-hint: "optional scope restriction"
context: fork
agent: docs-modify
---

Operation: auto-update

Changed files since last docs update:
!`git diff --name-only HEAD~5 -- themes/foreign-policy-2017/`!

Read the instruction file at `framework/instructions/modify/auto-update.md` and follow it exactly.

User scope restriction (if any): $ARGUMENTS
