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

## Phase 2 — Write Workflow Redesign (9 workflows)
**Status**: done
**Started**: 2026-03-30

### Design Reference
- v2 write workflow template: `specs/patterns/write-workflow-template-v2.md`
- New 10-step pattern: init -> scope-assess -> research(1-N) -> plan -> write(primary only) -> verbosity(dedicated) -> citations(dedicated) -> api-refs(dedicated) -> review -> finalize
- Key change: pipeline stages 1-3 each get dedicated agent spawns instead of being folded into modifier

### Task Claims
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Design v2 write workflow template | Mira | done | Template at specs/patterns/write-workflow-template-v2.md |
| Rewrite revise.md to v2 | Mira | done | Standard modifier workflow. 10-step pattern with dedicated enforcement agents. |
| Rewrite add.md to v2 | Mira | done | Standard modifier workflow. 10-step pattern with dedicated enforcement agents. |
| Rewrite auto-update.md to v2 | Mira | done | Batch-aware: parallel modifiers (1/2-8/9+ tiers), ONE enforcement agent per stage across all batches. |
| Rewrite auto-revise.md to v2 | Mira | done | Tracker-based: per-item modifier spawns, needs-revision-tracker update after write phase, ONE enforcement agent per stage. |
| Rewrite deprecate.md to v2 | Mira | done | Standard modifier workflow. Stage 7 (index) always triggers for structural changes. |
| Rewrite citations.md to v2 | Mira | done | Subcommand-based. generate/update: full v2 pipeline (skip own citation enforcement stage). verify/audit: read-only report, no pipeline. |
| Rewrite api-ref.md to v2 | Mira | done | Subcommand-based. generate: full v2 pipeline (skip own API ref enforcement stage). audit: read-only report. |
| Rewrite locals.md to v2 | Mira | done | Subcommand-based + CLI setup. annotate/contracts/shapes: full v2 pipeline. coverage/cross-ref/validate: read-only. MANDATORY teardown in all paths. |
| Rewrite remediate.md to v2 | Mira | done | Multi-specialist delegation. Per-issue specialist spawns grouped by command+file. Tiered execution (accuracy->enrichment->structural). Dedicated enforcement agents after all specialists complete. |
| Create fp-docs-verbosity-enforcer agent | Kai | done | agents/fp-docs-verbosity-enforcer.md. Write-capable agent for pipeline stage 1 (Option A). Based on fp-docs-verbosity but adds Write/Edit tools. |
| Update SubagentStop hook for new enforcement agents | Kai | done | Added verbosity-enforcer to: fp-docs-subagent-stop.js switch, hooks.cjs cmdHooks matcher, settings.json SubagentStop. Custom enforcement check validates Verbosity Enforcement Result + completion marker. |
| Pipeline.cjs updates for stage isolation | Kai | done | Updated config.json stages 1-3 from agent:"primary" to dedicated GSD names (fp-docs-verbosity-enforcer, fp-docs-citations, fp-docs-api-refs). Stages 4-5 updated from "validate" to "fp-docs-validator". getNextAction now returns specific agent names in spawn responses. |
| Update agent-map.cjs with verbosity-enforcer | Kai | done | Added fp-docs-verbosity-enforcer to AGENT_NAME_MAP (->verbosity-enforcer) and STAGE_AUTHORITY_MAP (->write). Added model_profile entry in config.json (opus/opus/sonnet). |

### Phase Completion Summary

**Files created:**
- `agents/fp-docs-verbosity-enforcer.md` -- Write-capable verbosity enforcement agent for pipeline stage 1, Option A (Kai)
- `specs/patterns/write-workflow-template-v2.md` -- v2 write workflow template with 10-step pattern (Mira)

**Files modified (Kai -- 7 files):**
- `lib/agent-map.cjs` -- Added fp-docs-verbosity-enforcer to AGENT_NAME_MAP + STAGE_AUTHORITY_MAP
- `config.json` -- model_profile for verbosity-enforcer; pipeline stages 1-5 updated from generic to dedicated GSD agent names
- `hooks/fp-docs-subagent-stop.js` -- Added verbosity-enforcer to switch routing
- `lib/hooks.cjs` -- Added verbosity-enforcer enforcement check + matcher list
- `settings.json` -- Added SubagentStop matcher for fp-docs-verbosity-enforcer
- `tests/lib/lib-enforcement-tests.cjs` -- Updated STAGE_AUTHORITY_MAP counts (15->17) + new assertions
- `tests/lib/lib-engine-compliance-tests.cjs` -- Updated agent count (10->11) + AGENT_NAMES array

**Files modified (Mira -- 9 workflow rewrites):**
- `workflows/revise.md` -- Standard v2 10-step with dedicated enforcement agents
- `workflows/add.md` -- Standard v2 10-step with dedicated enforcement agents
- `workflows/auto-update.md` -- Batch-aware: parallel modifiers (1/2-8/9+ tiers), ONE enforcement agent per stage across all batches
- `workflows/auto-revise.md` -- Tracker-based: per-item modifier spawns, needs-revision-tracker update after write phase
- `workflows/deprecate.md` -- Standard v2 10-step. Stage 7 (index) always triggers for structural changes
- `workflows/citations.md` -- Subcommand-based. generate/update: full v2 pipeline (skip own citation stage). verify/audit: read-only
- `workflows/api-ref.md` -- Subcommand-based. generate: full v2 pipeline (skip own API ref stage). audit: read-only
- `workflows/locals.md` -- Subcommand-based + CLI setup. annotate/contracts/shapes: full v2 pipeline. Mandatory teardown
- `workflows/remediate.md` -- Multi-specialist delegation. Per-issue specialist spawns. Tiered execution (accuracy->enrichment->structural)

**Decisions made:**
- Option A for verbosity: new fp-docs-verbosity-enforcer agent (write-capable) for pipeline stage 1. fp-docs-verbosity stays read-only for audit.
- Pipeline stages 1-5 in config.json now use explicit GSD agent names instead of generic "primary"/"validate"
- Verbosity enforcer uses custom enforcement check ("## Verbosity Enforcement Result" + completion marker), not generic Delegation Result
- Specialist workflows (citations, api-ref, locals) skip their own enforcement stage when spawned as primary agent (avoid self-enforcement loop)

**Items for Lead review:**
- All 9 rewritten workflow files (v2 pattern compliance)
- agents/fp-docs-verbosity-enforcer.md (agent definition)
- config.json pipeline stage agent assignments
- settings.json new SubagentStop matcher
- Hook routing for verbosity-enforcer

---

## Current Phase: 3 — Read + Other Workflow Redesign + Command Updates
**Status**: in-progress
**Started**: 2026-03-30

### Scope
- Read workflows (5): audit, verify, sanity-check, test, verbosity-audit
- Admin write workflows (2): update-index, update-claude (have pipeline enforcement)
- Admin no-pipeline workflows (4): setup, sync, update, update-skills
- Batch workflow (1): parallel
- Meta workflows (2): do, help

### Task Claims
| Task | Owner | Status | Notes |
|------|-------|--------|-------|
| Rewrite 5 read workflows to v2 | Mira | done | audit, verify, sanity-check, test, verbosity-audit. Added scope-assess, dynamic research (1-N), tracker. No enforcement agents (read-only). |
| Rewrite 2 admin write workflows to v2 | Mira | done | update-index (index agent primary), update-claude (system agent primary). Both get dedicated verbosity + citation enforcement agents. |
| Review/update 6 admin/meta/batch workflows | Mira | done | setup, sync, update, update-skills, do, help: no changes needed (clean). parallel.md: rewrote to v2 (teammates primary-only, dedicated enforcement agents, pipeline next loop). |
| Update init.cjs for v2 read-op bootstrap | Kai | done | Added featureFlags + scopeAssess to read-op and admin-op init payloads. Fixed stale engine:null fallback in buildCommonContext. |
| Verify command -> workflow routing | Kai | done | All 23 commands validated: workflow files exist, agent files exist, command files exist. Zero issues. |
| Test suite updates for Phase 3 changes | Kai | done | Added featureFlags/scopeAssess assertions to initReadOp and initAdminOp tests. 721 pass / 0 fail / 7 skipped. Note: init test architecture needs output mock (Phase 4). |

### Phase Completion Summary

**Files modified (Mira -- 8 workflow rewrites):**
- `workflows/audit.md` -- v2 read pattern: scope-assess, dynamic research (1-N), tracker, validator agent
- `workflows/verify.md` -- v2 read pattern: scope-assess, dynamic research (1-N), tracker, validator agent
- `workflows/sanity-check.md` -- v2 read pattern: scope-assess, dynamic research (1-N), tracker, validator agent
- `workflows/test.md` -- v2 read pattern: scope-assess, dynamic research (1-N), tracker, validator agent
- `workflows/verbosity-audit.md` -- v2 read pattern: scope-assess, dynamic research (1-N), tracker, verbosity agent (read-only)
- `workflows/update-index.md` -- v2 admin write: index agent primary, dedicated verbosity + citation enforcement agents, pipeline next loop
- `workflows/update-claude.md` -- v2 admin write: system agent primary, dedicated verbosity + citation enforcement agents, pipeline next loop
- `workflows/parallel.md` -- v2 batch: teammates primary-only, dedicated enforcement agents (verbosity/citations/api-refs) after all teammates complete, pipeline next loop

**Files unchanged (reviewed, no issues):**
- `workflows/setup.md` -- Admin, no pipeline, clean structure
- `workflows/sync.md` -- Admin, no pipeline, clean structure
- `workflows/update.md` -- Admin, no pipeline, clean structure
- `workflows/update-skills.md` -- Admin, no pipeline, clean structure
- `workflows/do.md` -- Meta router, clean structure
- `workflows/help.md` -- Meta help display, clean structure

**Files modified (Kai -- 3 CJS updates):**
- `lib/init.cjs` -- Added featureFlags + scopeAssess to read-op and admin-op init payloads, fixed stale engine:null fallback
- Tests -- Added featureFlags/scopeAssess assertions to initReadOp and initAdminOp tests (721 pass / 0 fail / 7 skipped)

**Decisions made:**
- Read workflows follow a 5-step pattern (init, scope-assess, research, plan, execute) -- no enforcement agents since read-only
- Admin write workflows (update-index, update-claude) get dedicated enforcement agents but skip scope-assess/research (simpler operations)
- parallel.md now aligns with v2: teammates do primary-only, enforcement runs centrally after all teammates complete
- 6 admin/meta workflows (setup, sync, update, update-skills, do, help) need no changes -- already clean
- Command -> workflow routing verified: all 23 commands valid (Kai)

**Items for Lead review:**
- All 8 rewritten workflow files
- init.cjs changes (featureFlags, scopeAssess in read-op/admin-op)
- parallel.md v2 team execution model

---
