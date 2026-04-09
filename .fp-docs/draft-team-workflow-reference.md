# Agent Team Workflow Reference

> Cross-project reference document loaded by the `/team-work` slash command.
> Defines the 3-person parallel team process, phase protocol, and communication norms.
> Location: `~/.claude/lib/team-workflow-reference.md`

---

## Team Structure

| Role | Agent | Perspective | Focus |
|------|-------|-------------|-------|
| **Architect** | `team-architect` | Structural thinking, pattern consistency | Design, documentation, architecture, workflows |
| **Engineer** | `team-engineer` | Implementation precision, code correctness | Code, tests, hooks, configs, CLIs |
| **Lead** | `team-lead` | Quality gate, labor optimization | Review, git operations, coaching, research delegation |

The Lead is senior to both dev teammates. The Lead's word is final on quality.

---

## Phase Protocol

### Phase Lifecycle

```
planning -> in-progress -> review -> complete
```

### At Phase Start
1. Both dev teammates read the phase plan
2. Map out every task for the phase
3. Claim tasks -- update PHASE-STATUS.md with owner assignments
4. No task goes unclaimed

### During a Phase
- Update task status as you progress: pending -> claimed -> in-progress -> done
- Add discoveries to PHASE-STATUS.md (append-only, timestamped)
- Message your teammate if you discover something that affects their tasks
- Help each other -- if one finishes early, assist the other

### At Phase End
1. Both dev teammates write the Phase Completion Summary jointly
2. Update PHASE-STATUS.md with the summary
3. Message Lead that phase is ready for review
4. Start next phase immediately (do not wait for review)

---

## Non-Blocking Lead Review

The Lead reviews completed phases in parallel with devs working on the next phase.

```
Phase 1: Dev work -> Complete -> Devs start Phase 2 immediately
                              -> Lead reviews Phase 1 in parallel
Phase 2: Dev work -> Complete -> Devs start Phase 3 immediately
                              -> Lead reviews Phase 2 in parallel
Final:   Dev work -> Complete -> ALL STOP
                              -> Lead finishes all pending reviews
                              -> Second pass + Retrospective
```

### Review Outcomes
- **PASS**: No issues. Commit and push.
- **PASS WITH NOTES**: Minor issues logged. Commit and push. Notes go to second pass.
- **BLOCKED**: Critical issue. Message devs immediately. They pause to fix.

---

## Git Protocol

- **Only the Lead commits and pushes.** Dev teammates never touch git.
- Commit after each phase review passes
- Commit messages: `{type}(phase-{N}): {description}`
- Types: `feat`, `refactor`, `docs`, `test`, `chore`, `fix`

---

## Communication Norms

- **Dev-to-dev**: Message freely. Coordinate on task boundaries. Share discoveries. Help each other.
- **Dev-to-Lead**: Report phase completion. Escalate blocking issues. Ask for guidance.
- **Lead-to-devs**: Review feedback. Labor optimization notes. Blocking issue alerts.
- **Lead subagents**: Lead can spawn Agent researchers to investigate review questions.

---

## Task Claiming Rules

1. Before each phase, both devs read the plan together
2. Map out every task needed
3. Claim tasks by owner in PHASE-STATUS.md
4. No unclaimed tasks allowed
5. No independent assumptions -- message your teammate first if unsure
6. Read your claimed task list before starting work -- follow it, don't freestyle

---

## Second Pass and Retrospective

After the final phase:
1. **ALL STOP.** Devs wait for Lead to finish all pending reviews.
2. **Second pass**: Lead presents all logged MINOR items. Devs address them.
3. **Retrospective**: All three discuss what went well, what to improve, patterns discovered, gotchas.
4. Record findings in the retrospective.

---

## Adapting Team Size

- **2-person**: Merge Lead into one dev role (that dev also reviews + commits)
- **4-person**: Split Architect into design + documentation, or split Engineer into code + tests

---

## State Management Integration

- State lives in `{project}/.claude/team-state/`
- `config.json`: Team config, lifecycle status, phase tracking
- `PHASE-STATUS.md`: Living status board with task claims, discoveries, completion summaries
- `retrospective.md`: Created after final phase

State mutations happen through the CJS module (`~/.claude/lib/team-state.cjs`), called via Bash by the dispatcher. Teammates update PHASE-STATUS.md directly via Write/Edit.
