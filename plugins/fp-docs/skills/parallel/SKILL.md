---
name: parallel
description: Run documentation operations in parallel across multiple files using Agent Teams. Opt-in feature — falls back to sequential if teams are disabled.
argument-hint: "operation scope flags"
context: fork
agent: docs-system
---

## Parallel Documentation Operations

Parse the arguments to determine:
1. **Operation**: Which docs operation to run (revise, audit, citations generate, etc.)
2. **Scope**: Which files/sections to target
3. **Flags**: Any operation-specific flags

### Execution Strategy

1. Determine the set of target files from the scope
2. Group files into batches (max 5 per batch)
3. For each batch, create a Team with teammates running the appropriate engine
4. Assign each file/group as a task
5. Wait for all teammates to complete
6. Aggregate results into a unified report

### Fallback

If Agent Teams are unavailable or the scope is small (<3 files), fall back to sequential execution by invoking the appropriate skill for each file in order.

User request: $ARGUMENTS
