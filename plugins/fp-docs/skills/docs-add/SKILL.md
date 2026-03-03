---
name: docs-add
description: Create documentation for entirely new code that doesn't have docs yet. Describe the new code and the engine will analyze it and generate complete documentation.
argument-hint: "description of new code to document"
context: fork
agent: docs-modify
---

Operation: add

Read the instruction file at `framework/instructions/modify/add.md` and follow it exactly.

User request: $ARGUMENTS
