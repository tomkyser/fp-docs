# GSD Architecture Conversion Retrospective

> Completed 2026-03-29. Team: Mira (Architect), Kai (Engineer), Reese (Principal Engineer/Reviewer).
> Converted fp-docs from skill-engine architecture to GSD command-workflow-agent architecture across 10 phases.

---

## Conversion Summary

| Metric | Value |
|--------|-------|
| Phases | 10 (all PASS, zero CRITICAL issues) |
| Commits | 12 (10 phases + second pass + retrospective) |
| Files created | ~86 (23 commands, 23 workflows, 10 agents, 16 references, 6 hooks, 4 templates, 2 CJS modules, 2 test files) |
| Files deleted | 88 (23 skills, 11 modules, 11 old agents, 31 instructions, 6 algorithms, 4 templates, hooks.json, manifest.md) |
| Files modified | ~30 (CJS modules, config, specs, README, CHANGELOG, test infrastructure) |
| Net line change | -8,046 (1,045 added, 9,091 removed in Phase 10 alone) |
| Test suite | 721 pass, 0 fail, 7 skipped |
| Health check | All 10 probes pass |

---

## 1. What Went Well

### Planning and Execution
- **CONVERSION-PLAN.md eliminated ambiguity.** Before/after examples, frontmatter schemas, and XML structures were all specified upfront. This is the primary reason zero CRITICAL issues were found across 10 phases. (Mira)
- **Parallel phase execution compressed the timeline.** Phases 2+3 ran together, Phases 5+6+7 ran together. Dependencies were correctly identified so no phase blocked another. (Reese)
- **Clean division of labor.** Mira on architecture/content, Kai on infrastructure/tests. Zero merge conflicts, no overlapping work on the same files. (Reese)

### Architecture
- **User Decision 2 (GSD explicit style) was the right call.** Repeating doc-standards.md and fp-project.md as @-reference in every command made each command self-contained and removed implicit module preloading dependencies. (Mira)
- **Workflow templates created consistency.** The write workflow template (6 steps) and read workflow template (4 steps) meant each of the 23 workflows was a variation on a proven pattern. (Mira)
- **Routing table as single source of truth.** The 5-field schema (agent, engine, workflow, operation, type) in routing.cjs made cross-reference validation trivial -- every consumer (spec-validator, cli-runner, routing-tests, engine-compliance, health check) resolves against one table. (Kai, Reese)

### Infrastructure
- **CJS module patterns held perfectly.** Every new module (init.cjs, model-profiles.cjs) followed the existing template. Zero friction adding new modules. (Kai)
- **Standalone JS hooks were a clean upgrade.** Self-contained, testable, stdin/stdout JSON contract identical to the old CJS handlers. No handler logic had to change. (Kai)
- **Health check paid off immediately.** Added in Phase 8, it caught structural issues during Phase 10 development rather than at review time. (Kai)
- **Test-driven discovery in Phase 9.** Running the full suite first, categorizing 17 failures into 3 groups, then fixing systematically was faster than predicting breakage. (Kai)

### Review Process
- **Every phase passed on first commit.** The detailed plan, clean division of labor, and systematic verification checklists meant no phase required rework before commit. (Reese)
- **"Create new, then delete old" pattern.** All content was migrated in Phases 1-9 before the 88-file deletion in Phase 10. Nothing was lost because everything had a new home first. (Reese)

---

## 2. What Could Be Improved

### Process
- **Phase 10 was too large.** The spec updates spanned two context windows. Splitting into Phase 10a (deletions + architecture.md rewrite) and Phase 10b (remaining specs + README) would have been cleaner. (Mira)
- **Communication overhead.** Kai and Mira sometimes reported the same phase independently, and Kai occasionally messaged about issues Mira had already fixed. A shared phase status board (even a markdown file) would reduce duplicate work. (Mira)
- **Task list scanning.** Kai focused on failing tests in Phase 9 rather than scanning the complete TEAM-BRIEF task list first, causing spec-validator.cjs to be initially missed. Lesson: read the full task list before triaging by failure output. (Kai)

### Architecture
- **inject-manifest handler should have been caught earlier.** The hooks.cjs handler reading manifest.md (about to be deleted) should have been flagged in Phase 8 integration, not discovered in Phase 10 when the file was gone. (Kai)
- **Root CLAUDE.md cross-repo complication.** Being in a different repo meant an extra commit step and different review process. (Reese)

---

## 3. Patterns Discovered

### Terminology Cascading
Changing "engine" to "agent" and "skill" to "command" touched far more surface area than the code. Specs, README, and CLAUDE.md reference these terms hundreds of times. The **grep-after-edit pattern** (edit a section, then grep the whole file for stale terms) was essential -- Mira caught 15+ stray references this way. (Mira)

### Behavioral Content Preservation
The pipeline, drift detection, visual verification, locals CLI, and citation system were largely accurate as-is -- only the WHO (engine vs agent) and HOW (instruction file vs workflow) changed, not the WHAT. This confirmed the conversion successfully preserved all domain logic. (Mira)

### Reference Deduplication Was Natural
10 rule references mapped 1:1 from 10 modules (minus mod-orchestration, absorbed into workflow logic). 6 algorithm references mapped 1:1 from framework/algorithms/. No content was lost or split awkwardly. (Mira)

### Test Count as Signal
Test count changes (739 -> 728 -> 721) were informative, not alarming. The drops reflected old architecture tests being replaced by new ones -- fewer tests validating things that no longer exist. (Kai)

### Fixture Brittleness
Fixture-based golden file tests (inject-manifest expected.json) are brittle across architecture changes. Consider validating structure (JSON shape, required keys) rather than content patterns tied to specific files. (Kai)

---

## 4. Gotchas Encountered

### Meta Commands Needed Special Handling
In the old architecture, `do` and `help` were "handled directly by the orchestrate engine without entering the ROUTING_TABLE." In the new architecture they're routing table entries with type "meta" and use inline workflows. This required adding the meta group to cmdHelp() and updating every spec section that described them differently. (Mira)

### README Had Its Own Structure
The README's Architecture section used inline code blocks, its own engine table format, and a Development Guide referencing SKILL.md patterns. It couldn't be a simple find-and-replace -- it required a full rewrite while preserving the README's accessible tone. (Mira)

### Agent Count Confusion
"9 engines" appeared in many places but the new architecture has "10 agents." The mapping isn't 1:1 because researcher and planner (previously counted separately) are now agents, but the old orchestrate engine has no direct agent counterpart. Consistent counts required careful tracking. (Mira)

---

## 5. Remaining Risks and Technical Debt

### Priority 1: Legacy Backward Compatibility Fields
- **`engine` field in routing.cjs**: Still read by some tests and help output but nothing in the runtime path depends on it. Remove once specs no longer reference engine names. (Reese, Kai)
- **8 legacy names in STAGE_AUTHORITY_MAP**: Exist so old-style agent names (modify, validate, etc.) still pass enforcement checks. A grep for old names across workflows/ and hooks/ would confirm if these can be pruned. (Reese, Kai)

### Priority 2: Dual Name Maps
AGENT_NAME_MAP (fp-docs-subagent-stop.js) and STAGE_AUTHORITY_MAP (enforcement.cjs) both encode old-to-new agent name mappings independently. If one gets updated without the other, they'll silently diverge. These should derive from a single canonical mapping. (Kai)

### Priority 3: Documentation Overlap
- **README vs specs**: The README's Architecture section now largely duplicates architecture.md content. The README should be trimmed to a high-level overview with "see specs/" pointers. (Mira)
- **Spec file size**: features-and-capabilities.md (~630 lines) and usage-and-workflows.md (~1000 lines) could benefit from splitting (e.g., separate pipeline-reference.md or hooks-reference.md) as the plugin evolves. (Mira)

### Priority 4: Vestigial Directories
- **framework/**: Only 2 files remain (class-locals-cli.php, playwright-mcp-config.json). Not urgent but could confuse future contributors. Moving these would require updating config.json and lib/locals-cli.cjs references for minimal benefit. (Kai)

---

## Recommended Follow-Up Actions

| Action | Priority | Effort | Owner |
|--------|----------|--------|-------|
| Consolidate AGENT_NAME_MAP and STAGE_AUTHORITY_MAP into single canonical mapping | P2 | Medium | Kai |
| Remove legacy `engine` field from routing.cjs after confirming no runtime dependency | P3 | Low | Kai |
| Prune 8 legacy names from STAGE_AUTHORITY_MAP after grep verification | P3 | Low | Kai |
| Trim README Architecture to overview + spec pointers | P3 | Medium | Mira |
| Evaluate spec file splitting as plugin evolves | P4 | Low | Mira |
| Assess framework/ directory disposition | P4 | Low | Kai |
