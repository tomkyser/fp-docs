---
description: Run documentation operations in parallel across multiple files using Agent Teams. Opt-in feature — falls back to sequential if teams are disabled.
argument-hint: "operation scope flags"
context: fork
agent: orchestrate
---

Engine: orchestrate
Operation: parallel
Instruction: framework/instructions/orchestrate/delegate.md

## Parallel Documentation Operations

Parse the arguments to determine:
1. **Operation**: Which docs operation to run (revise, audit, citations generate, etc.)
2. **Scope**: Which files/sections to target
3. **Flags**: Any operation-specific flags

Use the team protocol to execute the operation in parallel across all target files.

User request: $ARGUMENTS
