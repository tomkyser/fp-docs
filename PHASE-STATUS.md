# Phase Status Board — Round 2

> Shared status tracker. All teammates read and update this file.
> See AGENT-TEAM-WORKFLOW.md for process rules.

---

## Round 2 Scope

### Retrospective Follow-ups
- Consolidate AGENT_NAME_MAP + STAGE_AUTHORITY_MAP into single canonical mapping
- Remove legacy `engine` field from routing.cjs
- Prune 8 legacy names from STAGE_AUTHORITY_MAP
- Trim README Architecture → overview + spec pointers
- Relocate framework/ contents (tools + config) and update all references
- Evaluate spec file splitting

### Workflow Architecture Tweaks
- Add scope assessment step (dynamic delegation based on task scale)
- Add tracker/plan doc system (shared across agents and phases)
- Pipeline enforcement stages spawn dedicated agents (not folded into modifier)
- Main thread stays clean — immediate delegation, no direct fp-docs work
- Dynamic agent count for research + execution (scale with task size)

---

## Current Phase: 1 — Retrospective Follow-ups + Infrastructure
**Status**: in-progress
**Started**: 2026-03-30

### Task Claims
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Trim README Architecture → overview + spec pointers | Mira | done | Trimmed 979→803 lines. Architecture section now overview + spec pointers. Also fixed stale framework/config refs in Dev Guide + Config Reference. |
| Relocate framework/ contents + update all references | Mira | done | Moved PHP to tools/, playwright config to root. Updated 10+ refs in CJS, config, specs, references, workflows. Found+fixed 4 pre-existing stale paths (pipeline.cjs, drift.cjs, pipeline-enforcement.md, update-claude.md). framework/ deleted. Root CLAUDE.md refresh deferred to Phase 4. |
| Evaluate spec file splitting | Mira | done | NOT splitting. Both files have clear organizing principles (features vs usage). At 627+993 lines they're manageable. Pipeline/hooks refs would fragment without benefit. Content needs to settle post-conversion before reorg. Revisit if either exceeds ~1500 lines. |
| Design scope assessment agent pattern | Mira | done | Pattern at specs/patterns/scope-assessment.md. CLI interface, complexity tiers, assessment algorithm, workflow integration, skip conditions, config schema. |
| Design tracker doc system | Mira | done | Pattern at specs/patterns/tracker-doc.md. JSON tracker with phase-level granularity, summary endpoint for agents, CRUD CLI, lifecycle, config schema. |
| Write CJS pattern docs (scope-assess, tracker, dynamic research) | Mira | done | Unified impl spec at specs/patterns/cjs-implementation-spec.md. Exports, function sigs, CLI handlers, config additions, test strategy, implementation order. |
| Consolidate AGENT_NAME_MAP + STAGE_AUTHORITY_MAP → lib/agent-map.cjs | Kai | done | Created lib/agent-map.cjs. Single source of truth for name mapping + phase authority. 10 GSD + 8 canonical entries. |
| Update enforcement.cjs to import from agent-map.cjs | Kai | done | Removed inline STAGE_AUTHORITY_MAP, imports from agent-map.cjs. Re-exports for backward compat. 74 tests pass. |
| Update fp-docs-subagent-stop.js to import from agent-map.cjs | Kai | done | Removed inline AGENT_NAME_MAP, uses getCanonicalName() from agent-map.cjs. 14 hook tests pass. |
| Remove legacy `engine` field from routing.cjs | Kai | done | Removed from all 23 entries + init.cjs (3 sites using route.engine -> route.agent). Updated cmdHelp to show Agent column. Fixed 4 test files. 125 CLI tests pass. |
| Prune 8 legacy names from STAGE_AUTHORITY_MAP | Kai | deferred | Grep shows canonical short names still load-bearing in subagent-stop.js switch, hooks.cjs cmdHooks, handleSubagentEnforcementCheck. Deferred to Phase 2/3 when hook routing migrated to GSD names. Divergence risk already resolved by agent-map.cjs consolidation. |
| Implement lib/scope-assess.cjs | Kai | done | 7 exports: assessScope, estimateComplexity, recommendResearcherCount, recommendStrategy, parseTargets, analyzeFileScope, cmdScopeAssess. Uses config thresholds. |
| Implement lib/tracker.cjs | Kai | done | Reworked to JSON format per Mira's spec. 10 exports: create, read, summary, update, close, addIssue, addNote, list, prune, cmdTracker. Phase-level granularity, atomic writes, config-driven retention. |
| Add config.json sections for scope_assess + tracker | Kai | done | Added system.scope_assess (thresholds, max_researchers) and system.tracker (retention, auto_create_threshold). |
| Update fp-tools.cjs with new routes (scope-assess, tracker) | Kai | done | Added scope-assess and tracker cases. Lazy-require pattern. Header comment updated. |

### Phase Completion Summary

**Files created:**
- `lib/agent-map.cjs` -- Consolidated canonical agent name registry (Kai)
- `lib/scope-assess.cjs` -- Pre-delegation scope assessment module (Kai)
- `lib/tracker.cjs` -- Shared tracker document management (Kai)
- `tools/class-locals-cli.php` -- Relocated from framework/tools/ (Mira)
- `playwright-mcp-config.json` -- Relocated from framework/config/ to root (Mira)
- `specs/patterns/scope-assessment.md` -- Scope assessment design pattern (Mira)
- `specs/patterns/tracker-doc.md` -- Tracker doc system design pattern (Mira)
- `specs/patterns/cjs-implementation-spec.md` -- CJS implementation spec (Mira)

**Files modified:**
- `lib/enforcement.cjs` -- Imports from agent-map.cjs, removed inline STAGE_AUTHORITY_MAP (Kai)
- `hooks/fp-docs-subagent-stop.js` -- Imports from agent-map.cjs, removed inline AGENT_NAME_MAP (Kai)
- `lib/routing.cjs` -- Removed legacy `engine` field from all 23 entries (Kai)
- `lib/init.cjs` -- Updated 3 sites from route.engine to route.agent (Kai)
- `fp-tools.cjs` -- Added scope-assess and tracker CLI routes (Kai)
- `README.md` -- Trimmed 979->803 lines, Architecture section -> overview + spec pointers, fixed stale config refs (Mira)
- `.mcp.json` -- Playwright config path updated (Mira)
- `config.json` -- cli_source path updated (Mira)
- `lib/locals-cli.cjs` -- Source path updated for tools/ relocation (Mira)
- `lib/pipeline.cjs` -- Fixed stale Round 1 algorithm paths (framework/algorithms -> references/) (Mira)
- `lib/drift.cjs` -- Fixed stale Round 1 template path (framework/templates -> templates/) (Mira)
- `references/pipeline-enforcement.md` -- Fixed 5 stale algorithm path references (Mira)
- `references/locals-rules.md` -- Source file path updated (Mira)
- `specs/architecture.md` -- Repo layout tree updated, tool/config paths updated (Mira)
- `specs/features-and-capabilities.md` -- CLI tool path updated (Mira)
- `specs/usage-and-workflows.md` -- Config section rewritten for config.json, CLI tool path updated, stale framework/config refs removed (Mira)
- `workflows/update-claude.md` -- Fixed stale manifest.md and skills/ references (Mira)
- Tests: 4 test files updated for routing changes (Kai)

**Deleted:**
- `framework/` directory (entire tree -- 2 files relocated, directory removed) (Mira)

**Decisions made:**
- Spec splitting NOT warranted at current sizes (627+993 lines). Revisit at ~1500 lines.
- framework/ relocation: PHP to top-level `tools/`, playwright config to root. Clean separation from lib/ CJS modules.
- Legacy name pruning deferred to Phase 2/3 -- canonical short names still load-bearing in hook routing. Agent-map.cjs consolidation already eliminates the divergence risk.
- Tracker reworked from markdown to JSON format per Mira's spec. Phase-level granularity with summary() for small token footprint. Atomic writes via write-tmp-rename pattern.
- Scope complexity tiers: low/medium/high (Kai) vs light/standard/heavy (Mira design). Same semantics, Kai's naming is more conventional. Can align to Mira's naming in Phase 2 if preferred.
- config.json updated with scope_assess and tracker config sections per Mira's spec.

**Issues discovered:**
- 4 pre-existing stale `framework/` paths from Round 1 found and fixed (pipeline.cjs, drift.cjs, pipeline-enforcement.md, update-claude.md)
- Root CLAUDE.md (cc-plugins/) has ~15 stale `framework/` references -- deferred to Phase 4 holistic refresh
- Test marker fixtures reference old architecture paths -- deferred to Phase 4

**Items for Lead review:**
- All files listed above
- Verify agent-map.cjs consolidation maintains backward compatibility with existing hook routing
- Verify scope-assess and tracker CLI routes are wired correctly in fp-tools.cjs
- framework/ deletion -- confirm no stale references in active code paths

---

## Current Phase: 2 — Write Workflow Redesign (9 workflows)
**Status**: planning
**Started**: 2026-03-30

### Design Reference
- v2 write workflow template: `specs/patterns/write-workflow-template-v2.md`
- New 10-step pattern: init -> scope-assess -> research(1-N) -> plan -> write(primary only) -> verbosity(dedicated) -> citations(dedicated) -> api-refs(dedicated) -> review -> finalize
- Key change: pipeline stages 1-3 each get dedicated agent spawns instead of being folded into modifier

### Task Claims
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Design v2 write workflow template | Mira | done | Template at specs/patterns/write-workflow-template-v2.md |
| Rewrite revise.md to v2 | Mira | claimed | Standard modifier workflow |
| Rewrite add.md to v2 | Mira | claimed | Standard modifier workflow |
| Rewrite auto-update.md to v2 | Mira | claimed | Batch-aware (parallel modifiers for multi-file) |
| Rewrite auto-revise.md to v2 | Mira | claimed | Reads needs-revision-tracker for targets |
| Rewrite deprecate.md to v2 | Mira | claimed | Standard modifier workflow |
| Rewrite citations.md to v2 | Mira | claimed | Subcommand-based; generate/update use pipeline, verify/audit read-only |
| Rewrite api-ref.md to v2 | Mira | claimed | Subcommand-based; generate uses pipeline, audit read-only |
| Rewrite locals.md to v2 | Mira | claimed | Subcommand-based + CLI setup; annotate/contracts/shapes use pipeline |
| Rewrite remediate.md to v2 | Mira | claimed | Batch remediation; multi-specialist delegation |
| Create fp-docs-verbosity-enforcer agent | Kai | pending | New write-capable agent for pipeline stage 1 (Option A from template) |
| Update SubagentStop hook for new enforcement agents | Kai | pending | Handle verbosity-enforcer, citations, api-refs as pipeline enforcers |
| Pipeline.cjs updates for stage isolation | Kai | pending | How stages 1-3 are tracked when run by dedicated agents |
| Update agent-map.cjs with verbosity-enforcer | Kai | pending | New agent needs canonical name + phase authority entry |

### Phase Completion Summary
_Pending_

---
