---
description: Create documentation for entirely new code that doesn't have docs yet. Describe the new code and the engine will analyze it and generate complete documentation.
argument-hint: "description of new code to document"
context: fork
agent: orchestrate
---

Engine: modify
Operation: add
Instruction: framework/instructions/modify/add.md

User request: $ARGUMENTS
