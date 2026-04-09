# Design: Rigid State Structure and Tracking Schema

> Task #2 deliverable. Architect (Phase 1).
> Defines the state management system for Agent Team Workflow: directory structure, schemas, lifecycle, and cleanup.

---

## State Directory Structure

```
{project-root}/.claude/team-state/
  config.json                     # Team config + lifecycle status
  PHASE-STATUS.md                 # Living status board (append-only for completed phases)
  retrospective.md                # Created at team-complete (final deliverable)
  archive/                        # Completed team runs
    {YYYY-MM-DD}-{team-name}/
      config.json
      PHASE-STATUS.md
      retrospective.md
```

Only three active files at any time. No subdirectories during execution. The `archive/` directory is created only when a completed run is archived.

---

## config.json Schema

```json
{
  "version": "1.0.0",
  "teamName": "string — user-provided or auto-generated",
  "startedAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp",
  "status": "init | active | review | complete | archived",
  "displayMode": "auto | in-process | tmux",
  "roles": {
    "architect": { "name": "Architect", "focus": "structural thinking, design" },
    "engineer": { "name": "Engineer", "focus": "implementation, code, tests" },
    "lead": { "name": "Lead", "focus": "review, git, quality gate" }
  },
  "phases": [
    {
      "number": 1,
      "name": "Phase name",
      "status": "pending | in-progress | review | complete",
      "startedAt": "ISO 8601 or null",
      "completedAt": "ISO 8601 or null",
      "reviewStatus": "pending | pass | pass-with-notes | blocked",
      "taskCount": 0,
      "tasksComplete": 0
    }
  ],
  "currentPhase": 1,
  "totalPhases": 0,
  "gitBranch": "string or null — branch at team start",
  "gitProtocol": {
    "commitPrefix": "{type}(phase-{N})",
    "onlyLeadCommits": true
  }
}
```

### Field Rules

| Field | Mutability | Updated By |
|-------|-----------|------------|
| `version` | Immutable | Set at init |
| `teamName` | Immutable | Set at init |
| `startedAt` | Immutable | Set at init |
| `updatedAt` | Every write | Any state mutation |
| `status` | Lifecycle transitions only | CJS module (see lifecycle below) |
| `displayMode` | Set at init, can be overridden | Skill or user |
| `roles` | Immutable | Set at init (extensible for 2/4-person teams) |
| `phases` | Append-only for new phases; fields update in-place | CJS module |
| `currentPhase` | Increments on phase advance | CJS module |
| `totalPhases` | Updated when phases are added | CJS module |
| `gitBranch` | Immutable | Set at init |
| `gitProtocol` | Immutable | Set at init |

---

## PHASE-STATUS.md Template

This is the exact template rendered by `team-templates.cjs`. Every section header and table column is fixed -- agents fill in the cells but cannot change the structure.

```markdown
# Phase Status Board

> Team: {teamName}
> Started: {startedAt}
> Status: {status}

---

## Current Phase: {N} -- {name}
**Status**: planning | in-progress | review | complete
**Started**: {timestamp}

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | {description} | {role} | pending | |

### Discoveries
- {timestamp}: {discovery}

### Phase Completion Summary
- **Files created**: {list}
- **Files modified**: {list}
- **Files deleted**: {list}
- **Decisions made**: {list}
- **Issues discovered**: {list}
- **Items for Lead review**: {list}

### Lead Review
- **Result**: PASS | PASS WITH NOTES | BLOCKED
- **Notes**: {review notes}
- **Commit**: {commit hash or "pending"}

---

## Phase {N-1}: {name} -- COMPLETE
{preserved from prior phase -- identical structure}
```

### Structural Rules

1. **Section headers are fixed.** Agents write content within sections but never add, remove, or rename section headers.
2. **Task Claims table columns are fixed.** Five columns: #, Task, Owner, Status, Notes. No additional columns.
3. **Task Status values are enumerated**: `pending`, `claimed`, `in-progress`, `done`, `blocked`.
4. **Owner values match role names**: `Architect`, `Engineer`, `Lead`.
5. **Discoveries section is append-only.** Each entry is timestamped. Never edit or remove prior entries.
6. **Phase Completion Summary is written once** by Architect + Engineer jointly after all tasks are done. Never edited after initial write (Lead may append review notes).
7. **Completed phases are separated by `---`** and preserved verbatim. Append-only history.
8. **Current phase is always at the top.** When a phase completes and a new one starts, the completed phase moves below the new current phase section.

---

## Task-to-Phase Mapping

Claude Code's `TaskCreate`/`TaskUpdate` system and PHASE-STATUS.md serve different purposes:

| Concern | Claude Tasks | PHASE-STATUS.md |
|---------|-------------|-----------------|
| Real-time tracking | Yes (visible in UI) | No (file-based) |
| Cross-session persistence | No (session-scoped) | Yes (on disk) |
| Claiming/ownership | Via `owner` field | Via table |
| Phase history | No | Yes (append-only) |
| Completion summaries | No | Yes |
| Review outcomes | No | Yes |

### Mapping Protocol

When a phase begins:
1. CJS module reads the phase from `config.json`
2. Slash command creates Claude Tasks for each task in the phase (via `TaskCreate`)
3. Task subjects match PHASE-STATUS.md task descriptions exactly
4. Task metadata includes `{ "phase": N, "phaseStatusRow": rowNumber }`

When a task completes:
1. Agent calls `TaskUpdate` to mark Claude task complete
2. `TaskCompleted` hook fires, reads the task metadata
3. Hook calls CJS module to update the corresponding PHASE-STATUS.md row status to `done`

This keeps both systems in sync without manual double-entry.

---

## Retrospective Template

Created at team-complete. Written jointly by all three roles.

```markdown
# Retrospective: {teamName}

> Date: {completedAt}
> Duration: {duration}
> Phases completed: {totalPhases}

## What Went Well
- {item}

## What Could Improve
- {item}

## Patterns Discovered
- {item}

## Labor Division Notes
- {item}

## Gotchas for Next Time
- {item}

## Metrics
| Phase | Duration | Tasks | Review Result |
|-------|----------|-------|---------------|
| 1 | {duration} | {count} | {result} |
```

---

## State Lifecycle

```
init --> active --> review --> complete --> archived
  |                  |                       |
  |                  +-- (per phase:         |
  |                  |   in-progress ->      |
  |                  |   review ->           |
  |                  |   complete)           |
  |                  |                       |
  +-- (abort) -------+---- (abort) ---------+-- (prune after N days)
```

### Transitions

| From | To | Trigger | What Happens |
|------|----|---------|-------------|
| (none) | `init` | `/team-work` invoked | `config.json` created with phases array. PHASE-STATUS.md rendered from template. |
| `init` | `active` | First task claimed | `status` flips to `active`. `phases[0].status` flips to `in-progress`. |
| `active` | `active` | Phase advances | `currentPhase` increments. New phase section prepended to PHASE-STATUS.md. |
| `active` | `review` | Final phase tasks complete | All devs stop. Lead reviews remaining phases. |
| `review` | `complete` | Lead finishes all reviews + second pass done | `status` flips to `complete`. Retrospective template rendered. |
| `complete` | `archived` | User invokes cleanup or next `/team-work` | Active files moved to `archive/{date}-{name}/`. State directory reset. |

### Abort Handling

If a team run is abandoned mid-execution:
- State files remain in `.claude/team-state/`
- Next `/team-work` invocation detects existing state via SessionStart hook
- User is prompted: "Active team state found for '{teamName}' (Phase {N}, started {date}). Resume, archive, or discard?"
- Resume: continues from current state
- Archive: moves to `archive/` as-is (incomplete)
- Discard: deletes state files (irreversible, requires confirmation)

---

## Cleanup Rules

### Automatic Cleanup

No automatic cleanup. State files are small (under 50KB total) and valuable for reference. Cleanup is always user-initiated.

### Manual Cleanup

| Action | Command | What It Does |
|--------|---------|-------------|
| Archive completed run | `/team-work --archive` or auto on next init | Moves active state to `archive/{date}-{name}/` |
| Prune old archives | `/team-work --prune [days]` | Removes archive entries older than N days (default: 90) |
| Full reset | `/team-work --reset` | Deletes all state in `.claude/team-state/` (requires confirm) |

### What Persists After Archive

| File | Persists | Why |
|------|----------|-----|
| `config.json` | Yes (in archive) | Records team configuration for reference |
| `PHASE-STATUS.md` | Yes (in archive) | Full execution history |
| `retrospective.md` | Yes (in archive) | Lessons learned |

### .gitignore Recommendation

The `.claude/` directory should be in `.gitignore`. Team state is local working state, not source-controlled. The skill's init step should check and advise if `.claude/` is not gitignored.

---

## Validation Rules

Hooks and CJS modules enforce these structural invariants:

**Halt conditions (blocking -- operation cannot proceed):**
1. **config.json must parse as valid JSON.** If corrupt, halt with diagnostic. Without parseable state, no operation is safe.

**Warning conditions (non-blocking -- warn and continue):**
2. **config.json.status must be a valid lifecycle value.** Warn on unknown values; treat as `active`.
3. **PHASE-STATUS.md must have exactly one "Current Phase" section.** Multiple current phases = warn, use config.json.currentPhase as truth.
4. **Task Status values in PHASE-STATUS.md must be from the enumerated set.** Warn on unknown values.
5. **Phase numbers must be sequential.** Gaps indicate corruption; warn but continue.
6. **config.json.currentPhase must match PHASE-STATUS.md's current phase header.** Mismatch = warn and trust config.json.

These are enforced at state-read time (beginning of operations), not continuously. Rule 1 is the only hard halt -- all other rules warn and continue.

---

## CJS Module API Surface (for Engineer)

The Engineer will implement `team-state.cjs` with these exports:

```
initState(teamName, phases, options)    -> creates config.json + PHASE-STATUS.md
readState(projectRoot)                  -> returns parsed config.json or null
updatePhaseStatus(projectRoot, phaseNum, updates)  -> updates phase in config.json
advancePhase(projectRoot)               -> increments currentPhase, renders new section
updateTaskRow(projectRoot, phaseNum, taskNum, updates)  -> updates PHASE-STATUS row
addDiscovery(projectRoot, text)         -> appends to current phase Discoveries
writeCompletionSummary(projectRoot, phaseNum, summary)  -> writes Phase Completion Summary
writeReviewResult(projectRoot, phaseNum, result)  -> writes Lead Review section
completeTeam(projectRoot)               -> transitions to complete, renders retrospective
archiveState(projectRoot)               -> moves to archive/
resetState(projectRoot)                 -> deletes team-state/ (requires prior confirm)
pruneArchives(projectRoot, maxAgeDays)  -> removes old archive entries
getStatePath(projectRoot)               -> returns .claude/team-state/ path
```

All functions are synchronous (fs operations). All functions validate state before mutating. All functions update `config.json.updatedAt` on write.
