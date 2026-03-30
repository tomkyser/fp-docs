# Agent Team Workflow

> Reusable process for running a 3-person parallel agent team on any multi-phase task.
> First used during fp-docs GSD architecture conversion (2026-03-29).
> Updated with Round 2 process improvements (2026-03-30).

---

## Team Structure

| Role | Perspective | Focus |
|------|-------------|-------|
| **Architect** | Structural thinking, pattern consistency, design decisions | Markdown files, workflows, agents, references, documentation, architectural patterns |
| **Engineer** | Implementation precision, code correctness, test-driven | CJS/JS code, hooks, tests, configs, CLIs, runtime behavior |
| **Lead (Principal)** | Quality gate, correctness, completeness, labor optimization | Review, verification, git operations, team coaching, subagent research delegation |

The Lead is senior to both dev teammates. The Lead's word is final on quality. All three communicate freely throughout the process, like an IRL team.

---

## Phase Status Board

A shared markdown file (`PHASE-STATUS.md`) maintained throughout execution. Every teammate reads and writes to it. This is the single source of truth for what's happening.

### Structure

```markdown
# Phase Status Board

## Current Phase: {N} — {name}
**Status**: planning | in-progress | review | complete
**Started**: {timestamp}

### Task Claims
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| {task description} | {name} | claimed/in-progress/done | {observations, gotchas, discoveries} |

### Phase Completion Summary
Written jointly by Architect + Engineer after all tasks are done.
- Files created/modified/deleted: {list}
- Decisions made: {list}
- Issues discovered: {list}
- Items for Lead review: {list}

---
## Phase {N-1}: {name} — COMPLETE
{preserved from prior phase}
```

### Rules
- Before starting a phase: both dev teammates map out ALL tasks and claim them. No unclaimed tasks.
- During a phase: update task status and notes as you go. Flag discoveries immediately.
- After a phase: Architect + Engineer jointly write the completion summary.
- The board is append-only for completed phases (history is preserved).

---

## Non-Blocking Lead

The Lead reviews completed phases **in parallel** with dev teammates working on the next phase. The devs do NOT wait for review to start the next phase.

### Flow

```
Phase 1: Dev work → Dev work completes → Devs start Phase 2 immediately
                                        → Lead reviews Phase 1 in parallel
Phase 2: Dev work → Dev work completes → Devs start Phase 3 immediately
                                        → Lead reviews Phase 2 in parallel
...
Final Phase: Dev work → Dev work completes → ALL STOP
                                           → Lead reviews final phase
                                           → Lead reviews any pending phases
```

### Lead Review Outputs
- **PASS**: No issues. Commit and push.
- **PASS WITH NOTES**: Minor issues logged. Commit and push. Notes go to second pass.
- **BLOCKED**: Critical issue found. Message devs immediately. They pause current work to fix.

### Lead Coaching
As part of each review, the Lead should:
- Note if labor division could be improved (e.g., "Kai would be better suited for X type of work")
- Suggest rebalancing for future phases
- Flag if one teammate is consistently under/overloaded
- Spawn subagent researchers if needed to investigate questions that arise during review

---

## Task Claiming Protocol

Before each phase begins:

1. **Both dev teammates read the phase plan together**
2. **Map out every task** needed for the phase
3. **Claim tasks** — update PHASE-STATUS.md with owner assignments
4. **No task goes unclaimed** — if a task has no clear owner, discuss and assign
5. **No independent assumptions** — if unsure about anything, message your teammate first
6. **Read your claimed task list** before starting work — follow it, don't freestyle

During each phase:
- Update task status as you progress (claimed → in-progress → done)
- Add notes for anything unexpected
- Message your teammate if you discover something that affects their tasks
- Help each other — if one teammate finishes early, they assist the other

After each phase:
- Both dev teammates write the phase completion summary together
- Update PHASE-STATUS.md with the summary
- Message Lead that phase is ready for review

---

## Communication Norms

- **Dev-to-dev**: Message freely throughout. Coordinate on task boundaries. Share discoveries. Help each other. Never make assumptions in isolation.
- **Dev-to-Lead**: Report phase completion with summary. Escalate blocking issues. Ask for guidance.
- **Lead-to-devs**: Review feedback. Labor optimization notes. Phase advancement (after review). Blocking issue alerts.
- **Lead subagent use**: Lead can spawn subagent researchers to investigate review questions without blocking the devs.

---

## Git Protocol

- **Only the Lead commits and pushes.** Dev teammates never touch git.
- Commit after each phase review passes (even if devs have moved ahead).
- Commit messages: `{type}(phase-{N}): {description}`
- Push to designated branch after each commit.
- Types: `feat`, `refactor`, `docs`, `test`, `chore`, `fix`

---

## Second Pass + Retrospective

After the final phase:
1. **All stop.** Devs wait for Lead to finish all pending reviews.
2. **Second pass**: Lead presents all logged MINOR items. Devs address them.
3. **Retrospective**: All three discuss what went well, what to improve, patterns discovered, gotchas.
4. Record findings in a retrospective doc.

---

## Adapting This Workflow

### For different team sizes
- 2-person: Merge Lead into one dev role (that dev also reviews + commits)
- 4-person: Split Architect into design + documentation, or split Engineer into code + tests

### For different task types
- **Code refactoring**: Architect designs patterns, Engineer implements, Lead validates
- **Documentation**: Architect writes content, Engineer validates technical accuracy, Lead reviews
- **Bug investigation**: Engineer investigates, Architect designs fix, Lead reviews
- **New feature**: Architect designs, Engineer builds, Lead integrates

### For different repositories
- Update working directory, branch, and commit conventions
- Update file paths in task plans
- Keep the phase status board and communication norms unchanged
