---
description: "Check for and install fp-docs plugin updates. Shows changelog from GitHub release notes, confirms before updating."
argument-hint: "[--check-only | --force]"
context: fork
agent: orchestrate
---

Engine: system
Operation: update
Instruction: framework/instructions/system/update.md

User request: $ARGUMENTS
