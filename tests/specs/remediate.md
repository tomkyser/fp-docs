---
command: remediate
engine: orchestrate
operation: remediate
workflow: workflows/remediate.md
agent: none
type: write
pipeline_stages: stages 4-8 (validation + finalization after specialist execution)
subcommands: none
flags: --plan-only, --batch-mode
---

# /fp-docs:remediate - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:remediate` (optionally with plan-id, plan-number, plan-path, or `--plan-only`)
2. Command file loads workflow `workflows/remediate.md` via `@-reference`
3. Workflow determines remediation source: session audit results, saved plan, or `--plan-only` mode
5. If `--plan-only`: build plan from session audit results, save via `fp-tools.cjs remediate save`, display summary, stop
6. If plan-id/path/number: load saved plan via `fp-tools.cjs remediate load`
7. If no arguments: build plan from session audit results, proceed to execution
8. Display interactive selection table (issue list with categories, severity, commands)
9. User selects which issues to fix (all, skip N, only N, cancel)
10. For each selected issue group: spawn specialist engine subagent (Mode: DELEGATED)
11. After all specialists complete: spawn validate engine for stages 4-5 on all modified files
12. Orchestrate handles finalization (stages 6-8): changelog, index, docs commit as single batch

## Pipeline Stages

- Specialist subagents execute stages 1-3 per delegation protocol (verbosity, citations, API refs as applicable to the operation)
- Orchestrate spawns validate engine for stages 4-5 (sanity-check + 10-point verification)
- Orchestrate handles stages 6-8 directly (changelog, index, docs commit)

## Expected Markers

- Remediation Report heading with Plan ID and issue counts
- Per-issue status: RESOLVED, FAILED, or SKIPPED
- Plan status: complete, partial, or failed
- Pipeline completion marker from delegation results
- Finalization status: changelog, index, docs commit

## Files Typically Touched

- Documentation files from audit scope (varies by plan)
- .fp-docs-branch/changelog.md (stage 6)
- Possibly docs/PROJECT-INDEX.md (stage 7, if structural changes)
- .fp-docs/remediation-plans/{plan-id}.json (plan tracking)

## Error Paths

- No audit results and no plan-id: prompts user to run `/fp-docs:audit` first
- Plan ID not found: shows available plans via `fp-tools.cjs remediate list`
- User cancels at interactive selection: aborts without changes
- Specialist engine failure: marks issues as failed, continues with remaining
- All specialists fail: full failure report with plan status "failed"

## Edge Cases

- Stale plan (files changed since plan creation): warn but allow forced execution
- Empty plan (all issues already completed): report "nothing to do"
- Mix of selected and deselected issues: process only selected, mark others as SKIPPED
- Single issue in plan: skip interactive selection, proceed directly to execution
- Plan loaded after `/clear`: works correctly since plan is persisted to disk
- Multiple issues on same file with same command: grouped into single specialist invocation
