---
name: mod-orchestration
description: "Shared module defining orchestration thresholds, delegation protocol, batching strategy, and report formats. Preloaded by the orchestrate engine. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# Orchestration Module

Defines delegation thresholds, batching strategy, aggregation report formats, team naming conventions, and error recovery protocol for the orchestrate engine.

## Delegation Thresholds

These values are the runtime defaults. System-config §6 may override them.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `orchestration.enabled` | `true` | Master switch for multi-agent orchestration |
| `orchestration.max_concurrent_subagents` | `5` | Maximum concurrent subagent spawns in fan-out |
| `orchestration.max_teammates` | `5` | Maximum concurrent teammates in a team |
| `orchestration.max_files_per_batch` | `5` | Maximum files per subagent batch or teammate |
| `orchestration.pipeline_delegation` | `true` | Whether pipeline stages delegate to specialists |
| `orchestration.validation_retry_limit` | `1` | Max retries if validation finds LOW confidence |
| `orchestration.single_commit` | `true` | Aggregate all changes into one git commit |
| `orchestration.default_batch_mode` | `subagent` | Default execution mode (subagent, team, sequential) |

## Execution Mode Selection (D-08)

The execution mode is determined by the `--batch-mode` flag, NOT by file count thresholds.

```
--batch-mode subagent (default):
  1 file -> single Agent call
  2-8 files -> parallel Agent calls (fan-out, max concurrent per threshold)
  9+ files -> parallel Agent calls in batches (waves of max_concurrent_subagents)

--batch-mode team (or --use-agent-team):
  Any scope -> TeamCreate + teammates
  Confirmation prompt required unless flag explicitly passed (D-07)
  Teammates work directly as specialists (no nested subagent spawning)

--batch-mode sequential:
  Any scope -> sequential Agent calls (one at a time)
```

## Context Offloading Rules (D-09)

The orchestrator extracts only summary metrics from delegation results:

| Extract | Discard |
|---------|---------|
| File paths modified | Detailed change descriptions |
| Stage PASS/FAIL status | Full enforcement stage output |
| Issue count | Full issue text |
| Overall success/failure | Debug context |

For batch operations, maintain running totals instead of accumulating individual results.

Target: Orchestrator context usage stays below 15% during operations.

## Pipeline Phase Grouping

| Phase | Stages | Agent | Rationale |
|-------|--------|-------|-----------|
| Write Phase | Primary op + Stages 1-3 | Primary engine (delegated) | Needs write access + fresh context |
| Review Phase | Stages 4-5 | Validate engine | Independent quality review |
| Finalize Phase | Stages 6-8 | Orchestrator | Administrative — no domain expertise needed |

## Agent Count Per Command Type

| Command Type | Examples | Min Agents | Breakdown |
|---|---|---|---|
| Write operations | revise, add, auto-update | 3 | orchestrate + primary + validate |
| Read-only operations | audit, verify, test | 2 | orchestrate + specialist |
| Batch operations | parallel, large auto-update | N+2 | orchestrate + N teammates + validate |
| Specialist write ops | citations generate, locals annotate | 3 | orchestrate + specialist + validate |
| Remediation ops | remediate | N+2 | orchestrate + N specialists + validate |
| Administrative ops | setup, sync, update-skills | 2 | orchestrate + specialist |

## Batching Strategy

### File Partitioning
When scope exceeds thresholds, partition files into batches:

1. Group files by documentation section (e.g., all helper docs together)
2. Each batch should contain files from the same section when possible
3. Maximum files per batch: `max_files_per_teammate` (default 5)
4. Maximum batches: `max_teammates` (default 5)
5. If total files exceed max_teammates × max_files_per_teammate, increase files per batch

### Team Naming Convention
- Format: `fp-docs-{operation}-{timestamp}`
- Example: `fp-docs-auto-update-20260304`

### Teammate Naming Convention
- Format: `{engine}-worker-{N}`
- Example: `modify-worker-1`, `modify-worker-2`

## Delegation Result Format

Primary engines in delegated mode return:

```markdown
## Delegation Result
### Files Modified
- {path}: {description of change}
### Enforcement Stages
- Verbosity: {PASS|FAIL|SKIPPED}
- Citations: {PASS|FAIL|SKIPPED}
- API Refs: {PASS|FAIL|SKIPPED|N/A}
### Issues
- {any concerns or [NEEDS INVESTIGATION] items}

Delegation complete: [verbosity: {status}] [citations: {status}] [api-refs: {status}]
```

## Pipeline Validation Report Format

The validate engine in pipeline validation mode returns:

```markdown
## Pipeline Validation Report
### Sanity Check
- Overall confidence: {HIGH|MEDIUM|LOW}
- {file}: {confidence} — {details}
### Verification Checklist
- {file}: {PASS|FAIL} — {results per check}
### Issues Requiring Remediation
- {specific issues with file paths and descriptions}
```

## Orchestration Report Format

The orchestrator aggregates into:

```markdown
## Orchestration Report

### Command: /fp-docs:{operation}
### Strategy: {single|fan-out|team} ({N} agents used)

### Write Phase
{Summary of delegation results}

### Review Phase
{Summary of validation results}

### Finalization
- Changelog: {updated|skipped}
- Index: {updated|skipped}
- Docs Commit: {committed|skipped}
- Docs Push: {pushed|skipped|halted}

### Issues
{Any concerns from any phase}

Pipeline complete: [verbosity: {status}] [citations: {status}] [sanity: {status}] [verify: {status}] [changelog: {status}] [docs-pull: {status}] [docs-commit: {status}] [docs-push: {status}]
```

## Error Recovery Protocol

| Failure Type | Action | Max Retries |
|---|---|---|
| Specialist engine failure | Log error, report to user, do not commit | 0 |
| Validation LOW confidence | Retry primary op with fix prompt | 1 |
| Validation FAIL after retry | Report issues, do not commit | 0 |
| Git pull failure | Halt with diagnostic | 0 |
| Git push failure | Halt with diagnostic | 0 |
| Teammate failure (batch) | Collect successful results, note failure | 0 |
| Teammate timeout | Treat as failure, proceed with completed work | 0 |

## Read-Only Fast Path

For read-only commands (audit, verify, sanity-check, test, verbosity-audit, citations verify/audit, api-ref audit, locals cross-ref/validate/coverage):

1. Spawn the specialist engine in **standalone mode** (no Mode: DELEGATED header)
2. The specialist runs its full standard workflow
3. Return the specialist's report directly. The specialist's report includes per-issue command recommendations and a Remediation Summary (see audit, verify, sanity-check instruction files).
4. No pipeline stages, no changelog, no git operations
5. Minimum 2 agents: orchestrator + specialist
