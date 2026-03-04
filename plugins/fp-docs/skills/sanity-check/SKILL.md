---
description: Validate that documentation claims match actual source code. Zero-tolerance mode flags any discrepancy.
argument-hint: "scope like docs/06-helpers/posts.md"
context: fork
agent: orchestrate
---

Engine: validate
Operation: sanity-check
Instruction: framework/instructions/validate/sanity-check.md

User scope: $ARGUMENTS
