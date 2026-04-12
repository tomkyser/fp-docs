# Retrospective: Wave 4 — User Guide Command & Pipeline System

> Team: wave4-ug-commands
> Date: 2026-04-11
> Duration: 1h 17m
> Phases completed: 5

---

## What Went Well

1. **Plan quality was high**: The 5-phase plan in `.claude/plans/user-guide-system.md` mapped cleanly to execution. Every deliverable was accounted for, task boundaries were clear, and no phase required mid-flight redesign.

2. **Phase reviews were fast**: Each phase passed on first review. The only notes were cosmetic (tool ordering, belt-and-suspenders pattern) or deferred items (model_profile to Phase 5). No blocking issues across all 5 phases.

3. **Existing patterns made new work predictable**: The fp-docs-ug-writer mirrors fp-docs-modifier, fp-docs-ug-validator mirrors fp-docs-validator, ug-* commands follow the same YAML+XML+delegation structure as existing commands. This consistency meant less design overhead and faster review.

4. **Cross-phase dependency management worked**: Phase 1 logged model_profile as a second-pass item. Phase 5 resolved it. The PHASE-STATUS.md tracking board kept this visible across phases.

5. **Health check validates the whole system**: Running `node fp-tools.cjs health check` after Phase 5 confirmed all counts (31/31/31/12), all agent files present, all hooks present. The new user-guide-scaffold check (#9) adds monitoring for the docs repo structure.

## What Could Improve

1. **PHASE-STATUS.md task status lag**: Dev teammates completed their work but the task status rows in PHASE-STATUS.md weren't always updated from "pending" to "done" before signaling completion. The Lead had to infer completion from the file diffs rather than the status board. Suggestion: devs should update their task rows to "done" before messaging the Lead.

2. **Second-pass item tracking was minimal**: Only two items logged across 5 phases. One turned out to be a non-issue on closer inspection (ug-preview Read tool matches existing admin pattern). The system works but was barely exercised. In a wave with more complexity, a more structured second-pass format might help.

3. **Spec file verification was grep-count based**: Verifying spec updates relied on grep counts (19, 23, 62 UG references) and spot-checking rather than systematic review of every added section. For spec files that are the canonical reference, a more thorough review process might catch inconsistencies.

## Patterns Discovered

1. **Admin commands include Read in allowed-tools**: Unlike write/read operation commands (which only have Bash + Task), admin commands (setup, ug-preview) include Read. This is a valid pattern distinction -- admin commands may need to read system state directly.

2. **Batch commands use null agent**: Both `parallel` and `ug-batch` use `agent: null` in the routing table because they dispatch to other commands rather than spawning a single specialist agent.

3. **UG pipeline is simpler than dev docs pipeline**: 5 stages in 2 phases (write + finalize) vs 8 stages in 3 phases. No separate Review phase -- validation (stages 3-4) happens within the Write phase. This reflects that user guide validation is more self-contained.

4. **Scaffold auto-check belongs in init, not health**: `init.cjs` checks and auto-bootstraps the scaffold before the operation starts. `health.cjs` just reports whether it exists. Different purposes, both useful.

## Labor Division Notes

- **Architect** (team-architect): All commands, workflows, references, agents, spec files. Domain-heavy work that required understanding the command-workflow-agent architecture and writing XML process steps.
- **Engineer** (team-engineer): Routing table, config, health, init, test specs. Infrastructure-heavy work that required CJS module patterns and JSON config management.
- **Lead** (team-lead): Phase reviews, commits, second pass, retrospective. Quality gate with cross-file verification (routing counts, model profiles, spec coverage).

Division worked well -- Architect and Engineer tasks had clean boundaries with no overlap. Both could work fully in parallel within each phase.

## Gotchas for Next Time

1. **Context compaction during long team sessions**: The Lead role spans all 5 phases, which means the context window fills up. Re-reading files before editing after 10+ messages (per CLAUDE.md) is essential.

2. **Routing table count is a health check assertion**: `health.cjs` hardcodes the expected count (31). Any future command addition must update this number or health check will report failure.

3. **Scaffold check uses lazy require**: `init.cjs` does `require('./scaffold.cjs')` inside a try/catch in `checkUserGuideScaffold()`. Scaffold.cjs errors are silently caught -- graceful degradation but errors won't surface.

4. **Team-state complete command overwrites retrospective**: The `cmdTeamState('complete', [])` call replaces the retrospective file with a blank template. Write the real retrospective after calling complete, or write it to a different path.

## Metrics

| Phase | Review Result | Files Created | Files Modified |
|-------|---------------|---------------|----------------|
| 1 — Foundation | PASS WITH NOTES | 5 | 1 |
| 2 — Read Commands | PASS | 9 | 1 |
| 3 — Write Commands | PASS | 9 | 1 |
| 4 — Admin + Batch | PASS WITH NOTES | 6 | 1 |
| 5 — Integration | PASS | 0 | 6 |
| **Total** | **3 PASS, 2 PASS WITH NOTES** | **29** | **10** |

### Final Counts

| Component | Before | After |
|-----------|--------|-------|
| Commands | 23 | 31 |
| Workflows | 23 | 31 |
| Routing entries | 23 | 31 |
| Agents | 10 | 12 |
| References | 16 | 19 |
| Test specs | — | +8 |
| Config sections | — | +2 (user_guide, user_guide_pipeline) |
| Model profiles | — | +2 (ug-writer, ug-validator) |
| Health checks | 8 | 9 |
| Init subcommands | 5 | 7 |
| Commits | — | 6 (5 phases + retrospective) |
