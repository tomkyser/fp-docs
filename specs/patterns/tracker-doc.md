# Tracker Doc Pattern

> Design document for the operation tracker system.
> Created: 2026-03-30 (Round 2, Phase 1)
> Status: Pattern spec for CJS implementation

---

## Purpose

A tracker doc is a JSON file that follows an operation from scope assessment through finalization. It serves as:

1. **Shared state** across agents -- each agent reads the tracker to understand what happened before it, and writes to record what it did
2. **Progress ledger** -- the workflow can check the tracker to know which phases completed, which targets were processed, and what issues were found
3. **Post-operation artifact** -- after completion, the tracker is the authoritative record of what happened during the operation

Tracker docs are created by scope assessment (for medium/high complexity) and updated by every subsequent agent in the workflow.

---

## Storage

```
{docs-root}/.fp-docs/trackers/
├── tracker-a1b2c3d4.json     # Active tracker
├── tracker-e5f6g7h8.json     # Completed tracker
└── ...
```

Same directory pattern as `plans.cjs` (under `.fp-docs/`). Trackers use the `tracker-` prefix with 8-char hex IDs.

---

## CJS Interface: `lib/tracker.cjs`

### CLI Surface

```
fp-tools tracker create  --operation <cmd> --targets <json> --complexity <tier>
fp-tools tracker update  <tracker-id> --phase <name> --agent <name> --status <status> [--content <json>]
fp-tools tracker read    <tracker-id>
fp-tools tracker summary <tracker-id>
fp-tools tracker close   <tracker-id> --status <completed|failed|aborted>
fp-tools tracker list    [--status active|completed|all]
fp-tools tracker prune   [--days <N>]
```

### Data Structure

```json
{
  "id": "tracker-a1b2c3d4",
  "operation": "revise",
  "complexity": "medium",
  "status": "active",
  "created": "2026-03-30T14:00:00.000Z",
  "updated": "2026-03-30T14:05:00.000Z",
  "closed": null,
  "targets": [
    {
      "docPath": "docs/06-helpers/posts.md",
      "sourcePaths": ["helpers/posts.php"],
      "status": "pending"
    }
  ],
  "phases": {
    "scope-assess": {
      "status": "completed",
      "agent": "cli",
      "timestamp": "2026-03-30T14:00:00.000Z",
      "result": {
        "complexity": "medium",
        "researcherCount": 1,
        "estimatedFiles": 2
      }
    },
    "research": {
      "status": "completed",
      "agent": "fp-docs-researcher",
      "timestamp": "2026-03-30T14:01:00.000Z",
      "result": {
        "analysisPath": ".fp-docs/analyses/analysis-xxx.json",
        "findings": ["posts.php has 15 functions, doc covers 12"]
      }
    },
    "plan": {
      "status": "completed",
      "agent": "fp-docs-planner",
      "timestamp": "2026-03-30T14:02:00.000Z",
      "result": {
        "planId": "plan-xxx",
        "planPath": ".fp-docs/plans/plan-xxx.json"
      }
    },
    "write": {
      "status": "completed",
      "agent": "fp-docs-modifier",
      "timestamp": "2026-03-30T14:03:00.000Z",
      "result": {
        "filesModified": ["docs/06-helpers/posts.md"],
        "stages": {
          "verbosity": "PASS",
          "citations": "PASS",
          "apiRefs": "PASS"
        }
      }
    },
    "review": {
      "status": "completed",
      "agent": "fp-docs-validator",
      "timestamp": "2026-03-30T14:04:00.000Z",
      "result": {
        "sanityCheck": "HIGH",
        "verification": "PASS",
        "issues": []
      }
    },
    "finalize": {
      "status": "completed",
      "agent": "workflow",
      "timestamp": "2026-03-30T14:05:00.000Z",
      "result": {
        "changelog": "updated",
        "index": "skipped",
        "docsCommit": "abc1234"
      }
    }
  },
  "issues": [],
  "notes": []
}
```

### API Functions

#### `create(options)` -> `{ id, path }`

Creates a new tracker. Called by scope-assess step in the workflow.

```js
create({
  operation: 'revise',
  complexity: 'medium',
  targets: [{ docPath: '...', sourcePaths: ['...'] }]
})
```

#### `update(trackerId, phaseUpdate)` -> `{ ok: true }`

Updates a specific phase in the tracker. Called by each agent at the end of its work.

```js
update('tracker-a1b2c3d4', {
  phase: 'research',
  agent: 'fp-docs-researcher',
  status: 'completed',
  result: { analysisPath: '...', findings: [...] }
})
```

Status values: `pending`, `in-progress`, `completed`, `failed`, `skipped`.

#### `read(trackerId)` -> full tracker JSON

Returns the complete tracker document. Used by agents to understand prior phase results.

#### `summary(trackerId)` -> condensed summary

Returns a condensed view: operation, complexity, phase statuses, issue count, target statuses. Designed for agent prompt injection (small token footprint).

```json
{
  "id": "tracker-a1b2c3d4",
  "operation": "revise",
  "complexity": "medium",
  "phaseStatuses": {
    "scope-assess": "completed",
    "research": "completed",
    "plan": "in-progress"
  },
  "issueCount": 0,
  "targetCount": 1,
  "targetsCompleted": 0
}
```

#### `close(trackerId, status)` -> `{ ok: true }`

Marks the tracker as completed/failed/aborted. Sets `closed` timestamp. Called by the workflow finalize step.

#### `addIssue(trackerId, issue)` -> `{ ok: true }`

Appends an issue to the issues array. Used by any agent that discovers a problem.

```js
addIssue('tracker-a1b2c3d4', {
  phase: 'review',
  severity: 'warning',
  message: 'Sanity check confidence is LOW for docs/06-helpers/posts.md',
  target: 'docs/06-helpers/posts.md'
})
```

#### `addNote(trackerId, note)` -> `{ ok: true }`

Appends a freeform note. Used for observations that aren't issues.

#### `list(filter)` -> array of tracker summaries

Lists trackers, optionally filtered by status.

#### `prune(days)` -> `{ pruned: N }`

Removes completed/failed trackers older than N days. Same pattern as plans.cjs prune.

---

## How Agents Use the Tracker

### In Agent Spawn Prompts

When a tracker exists, the workflow passes the tracker ID and a summary to each spawned agent:

```
Agent(
  prompt="...
    Tracker: {tracker-id}
    Tracker Summary: {summary-json}

    When you complete your phase, update the tracker:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {tracker-id} --phase {phase} --agent {your-name} --status completed --content '{result-json}'

    If you encounter an issue:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {tracker-id} --phase {phase} --agent {your-name} --status failed --content '{error-json}'
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker add-issue {tracker-id} --phase {phase} --severity {level} --message '{msg}'
    ...",
  agent="fp-docs-{name}",
  model="${MODEL}"
)
```

### Phase-to-Agent Mapping

| Phase | Agent | What it records |
|-------|-------|----------------|
| scope-assess | CLI (not an agent) | Complexity, researcher count, target list |
| research | fp-docs-researcher (1-N) | Analysis file paths, source code findings |
| plan | fp-docs-planner | Plan ID, plan file path, execution strategy |
| write | fp-docs-modifier / specialist | Files modified, pipeline stage results (1-3) |
| review | fp-docs-validator | Sanity-check confidence, verification results |
| finalize | workflow (not an agent) | Changelog, index, git commit hash |

---

## Lifecycle

1. **Created** during scope-assess step (status: `active`)
2. **Updated** by each agent as phases complete
3. **Closed** by the workflow finalize step (status: `completed` / `failed` / `aborted`)
4. **Pruned** by periodic cleanup (configurable retention, default 30 days)

If the workflow is interrupted (agent crash, user abort), the tracker stays in `active` status. A stale active tracker (older than 1 hour) can be detected by `tracker list --status active` and manually closed.

---

## Configuration (in config.json under `system.tracker`)

```json
{
  "tracker": {
    "enabled": true,
    "auto_create_threshold": "medium",
    "retention_days": 30,
    "max_trackers": 200
  }
}
```

- `auto_create_threshold`: Minimum complexity tier that triggers tracker creation. `low` = always, `medium` = medium+high, `high` = high only.
- When `enabled` is false, all tracker CLI calls are no-ops (return empty/success).

---

## Relationship to Other Modules

| Module | Interaction |
|--------|-------------|
| `scope-assess.cjs` | Creates the tracker when complexity >= threshold |
| `plans.cjs` | Tracker references plan IDs; plans don't reference trackers |
| `pipeline.cjs` | Finalize phase updates tracker with stage results |
| `state.cjs` | Independent -- trackers don't overlap with operation state |
| `core.cjs` | Uses `safeReadFile`, `safeJsonParse`, `output`, `error` |
| `paths.cjs` | Uses `getDocsRoot` for storage path resolution |

---

## Design Decisions

1. **JSON not markdown**: Trackers are JSON files, not markdown. They are machine-readable state documents consumed by CLI tools and agent prompts, not human-authored reference docs.

2. **Summary endpoint for agents**: The `summary` command exists specifically to keep agent prompt payloads small. A full tracker can grow to hundreds of lines for heavy operations; the summary is always under 20 lines.

3. **Phase-level granularity**: Phases map 1:1 to workflow steps. We don't track individual pipeline stages inside the write phase -- that detail lives in the agent's Delegation Result output.

4. **No locking**: Trackers use atomic writes (write-to-tmp, rename) like plans.cjs. Since agents run sequentially within a workflow (except parallel researchers), there is no concurrent write contention.

5. **Graceful degradation**: If tracker operations fail (disk full, permissions), agents continue their work. The tracker is observability, not a gate.
