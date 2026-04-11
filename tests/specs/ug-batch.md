---
command: ug-batch
engine: orchestrate
operation: ug-batch
workflow: workflows/ug-batch.md
agent: none
type: batch
pipeline_stages: varies
subcommands: validate, screenshot, update
flags: --section <name>, --all
---

# /fp-docs:ug-batch - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-batch <validate|screenshot|update> [--section <name>] [--all]`
2. Command file loads workflow `workflows/ug-batch.md` via `@-reference`
3. Workflow parses batch operation type and scope from arguments
4. Workflow enumerates target pages based on scope (--section, --all, or default)
5. If Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`): creates team via TeamCreate, assigns pages to teammates
6. If Agent Teams not enabled: executes sequentially across target pages
7. TeammateIdle hook validates each teammate's completion (team mode)
8. TaskCompleted hook validates each task's output (team mode)
9. Orchestrator aggregates results from all pages
10. If write operation (update, screenshot): commits all changes in single docs commit

## Pipeline Stages

Varies based on the wrapped operation:
- `ug-batch validate`: each page runs the 4 validation checks (UI path, screenshot, jargon, completeness) -- no pipeline, read-only
- `ug-batch screenshot`: each page runs the 5-stage user guide pipeline (ui-verify, screenshots, tone, completeness, commit)
- `ug-batch update`: each page runs the 5-stage user guide pipeline (ui-verify, screenshots, tone, completeness, commit)

Write operations (screenshot, update) produce a single aggregated commit at the end, not per-page commits.

## Expected Markers

- Team mode: TeammateIdle markers `## Delegation Result` per teammate
- Team mode: TaskCompleted markers per task
- Sequential mode: per-page result markers
- Aggregated report: `Batch complete: {N} pages processed, {pass} PASS, {warn} WARN, {fail} FAIL`
- Write operations: `docs commit` or `committed to docs repo` (single commit for all pages)

## Files Typically Touched

- For validate: no files modified (read-only)
- For screenshot: screenshot files in multiple page bundles, frontmatter updates (last_verified, screenshot_count)
- For update: `index.md` files in multiple page bundles, possibly screenshots

## Error Paths

- Missing batch operation argument: reports error with valid operations (validate, screenshot, update)
- Invalid --section value: reports error with valid section names
- No pages match scope: reports empty scope
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not enabled for large batch: falls back to sequential with warning
- Individual page failure: collects error, continues with remaining pages, reports partial results
- Playwright unavailable for batch screenshot: reports error -- screenshot requires Playwright

## Edge Cases

- Batch validate --all: validates every page in user-guide/content/, produces aggregate report
- Batch screenshot --section content-management: captures screenshots for all pages in that section
- Batch update --all: updates all pages, single commit at end
- Batch with single matching page: effectively runs as non-batch operation
- Batch with Agent Teams: distributes pages across teammates (max 5 teammates, max 5 pages per teammate per config)
- Batch without Agent Teams: sequential execution, same results but slower
- Batch validate produces no write operations: no commit stage, report only
- Batch with mixed results (some PASS, some FAIL): aggregated report shows per-page status, overall status is worst-case
