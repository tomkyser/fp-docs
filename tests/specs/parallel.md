---
command: parallel
engine: orchestrate
operation: parallel
instruction: framework/instructions/orchestrate/delegate.md
agent: orchestrate
context: fork
type: batch
pipeline_stages: varies
subcommands: none
flags: none
---

# /fp-docs:parallel - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:parallel "operation scope flags"`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine
3. Orchestrate parses operation, scope, and flags from arguments
4. Orchestrate creates Agent Team via TeamCreate tool
5. Team members execute the specified operation in parallel across target files
6. TeammateIdle hook validates each teammate's completion
7. TaskCompleted hook validates each task's output
8. Orchestrate collects results and produces aggregated report

## Pipeline Stages

Varies based on the wrapped operation:
- If wrapping a write operation (e.g., revise): each team member runs full pipeline stages 1-8
- If wrapping a read operation (e.g., audit): each team member uses fast path (no pipeline)

## Expected Markers

- TeammateIdle markers: `## Delegation Result` per teammate
- TaskCompleted markers: `files modified` (for write tasks)
- Aggregated pipeline completion markers from each parallel execution

## Files Typically Touched

- Multiple documentation files (one per team member)
- docs/changelog.md (aggregated from team results, for write operations)

## Error Paths

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not enabled: engine falls back to sequential
- Individual team member failure: engine collects error, continues with others
- Team coordination failure: engine reports partial results

## Edge Cases

- Parallel with write operations: each team member produces delegation result
- Parallel with read operations: each team member produces read-only output
- Parallel when teams feature is disabled: graceful fallback to sequential execution
- Parallel with a single target file: effectively runs as non-parallel operation
