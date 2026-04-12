# Phase Status Board

> Team: wave4-ug-commands
> Started: 2026-04-11T22:58:08.597Z
> Status: init

---

## Phase: 1 -- Foundation (references + agents + config)
**Status**: complete
**Started**: 2026-04-11T22:58:08.598Z

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1 | references/ug-standards.md | team-architect | done | 10 sections: content types, page bundles, frontmatter, screenshots, tone, links, shortcodes, sections, integrity |
| 3 | references/ug-validation-rules.md | team-architect | done | 6 sections: UI path verification, screenshot currency, jargon/tone, completeness matrix, coverage gaps, report format |
| 5 | agents/fp-docs-ug-validator.md | team-architect | done | Read-only agent, 4 operations (ug-validate/audit/status/pipeline), mirrors fp-docs-validator pattern |
| 2 | references/ug-ui-verification.md | team-engineer | done | 4 sections: Playwright verification (auth, nav, elements, capture, URLs), code-based fallback (menus, CPTs, taxonomies, meta boxes, fields, settings, shortcodes), path-to-target mapping, result format |
| 4 | agents/fp-docs-ug-writer.md | team-engineer | done | Write-capable agent, 3 operations (ug-generate/update/screenshot), Playwright MCP for UI discovery, writing rules block, mirrors fp-docs-modifier pattern |
| 6 | config.json user_guide + user_guide_pipeline sections | team-engineer | done | user_guide: sections, page types, screenshot config, playwright config. user_guide_pipeline: 5 stages, jargon patterns, required sections matrix |

### Discoveries
- Scaffold templates use `{{< step >}}` and `{{< recording >}}` shortcodes — standards reference both with usage rules
- Feature-guide template uses `What Is {Feature}?` heading (not just "What Is") — completeness check uses partial matching

### Phase Completion Summary
- **Files created**: references/ug-standards.md, references/ug-validation-rules.md, agents/fp-docs-ug-validator.md, references/ug-ui-verification.md, agents/fp-docs-ug-writer.md
- **Files modified**: config.json (added user_guide and user_guide_pipeline sections)
- **Files deleted**:
- **Decisions made**: Completeness section detection uses case-insensitive partial H2 matching (e.g., "What Is Regions?" matches "What Is {Feature}?")
- **Issues discovered**:
- **Items for Lead review**:

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewed**: 2026-04-11
- **Notes**:
  1. **model_profile missing new agents**: `config.json` `model_profile.agents` was not updated with entries for `fp-docs-ug-writer` and `fp-docs-ug-validator`. These need to be added in Phase 5 (integration) or earlier. Both agents should follow the pattern of their dev-docs counterparts: writer mirrors modifier profile, validator mirrors validator profile.
  2. **Tool ordering inconsistency (cosmetic)**: Existing `fp-docs-validator` lists tools as `Read, Grep, Glob, Bash`. New `fp-docs-ug-validator` lists `Read, Bash, Grep, Glob`. No functional impact — tool ordering doesn't affect behavior — but note for consistency if anyone revisits.
  3. **ug-validator uses both tools whitelist AND disallowedTools**: Existing `fp-docs-validator` achieves read-only by simply omitting Write/Edit from `tools:`. New `fp-docs-ug-validator` uses both `tools:` (whitelist) and `disallowedTools: Write, Edit` (explicit deny). The belt-and-suspenders approach is fine — more explicit is better for safety. Not a problem, just noting the pattern difference.
  4. **Reference cross-linking is correct**: ug-writer references ug-standards + ug-ui-verification + fp-project. ug-validator references ug-standards + ug-validation-rules + fp-project. Matches the plan.
  5. **Config additions are well-structured**: Both `user_guide` and `user_guide_pipeline` sections match the plan spec exactly. JSON is valid. Pipeline stages correctly define 5 stages across 2 phases (write + finalize). Required sections matrix matches ug-standards.md content type definitions.
  6. **All 3 references are thorough**: ug-standards (10 sections, covers all content types, tone rules, screenshot naming, shortcodes), ug-validation-rules (6 sections, complete validation criteria), ug-ui-verification (4 sections, Playwright + code fallback). No gaps relative to plan.
- **Second-pass items**: #1 (model_profile) must be addressed in Phase 5
- **Commit**: done (wave4-phase-1)

---

## Phase: 2 -- Read-Only Commands (ug-validate, ug-audit, ug-status)
**Status**: complete
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 8 | commands/ug-validate.md | team-architect | done | YAML frontmatter + XML body, delegation protocol, @-reference to workflow |
| 9 | commands/ug-audit.md | team-architect | done | YAML frontmatter + XML body, delegation protocol, @-reference to workflow |
| 10 | commands/ug-status.md | team-architect | done | YAML frontmatter + XML body, delegation protocol, @-reference to workflow |
| 11 | workflows/ug-validate.md | team-architect | done | 3-step: init, resolve targets, spawn ug-validator. Depth-gated checks (quick/standard/deep). Includes remediation commands. |
| 12 | workflows/ug-audit.md | team-architect | done | 2-step: init, spawn ug-validator. Coverage gap detection with codebase scan + cross-reference. |
| 13 | workflows/ug-status.md | team-architect | done | 2-step: init, spawn ug-validator. 6-part health metrics (scaffold, pages, screenshots, staleness, coverage, structure). |
| 14 | lib/routing.cjs — add 3 read entries | team-engineer | done | 3 ROUTING_TABLE entries + 3 DESCRIPTIONS entries added, table now 26 entries |
| 15 | tests/specs/ug-validate.md | team-engineer | done | Covers routing path, 4 internal validation stages, depth levels, flags, edge cases |
| 16 | tests/specs/ug-audit.md | team-engineer | done | Covers routing path, coverage gap detection flow, --section flag, fallbacks, edge cases |
| 17 | tests/specs/ug-status.md | team-engineer | done | Covers routing path, health metrics collection, --verbose flag, staleness bands, edge cases |

### Discoveries
- Routing table count goes from 23 to 26 with the 3 read commands (will reach 31 when all 8 ug-* commands are added in later phases)
- ug-validate workflow includes ug-ui-verification.md in files_to_read (not just ug-standards + ug-validation-rules) — correct, validator needs Playwright/code-trace procedures for deep depth

### Phase Completion Summary
- **Files created**: commands/ug-validate.md, commands/ug-audit.md, commands/ug-status.md, workflows/ug-validate.md, workflows/ug-audit.md, workflows/ug-status.md, tests/specs/ug-validate.md, tests/specs/ug-audit.md, tests/specs/ug-status.md
- **Files modified**: lib/routing.cjs (added 3 routing entries + 3 descriptions, count 23->26, comment updated)
- **Files deleted**:
- **Decisions made**: Workflows use `fp-tools init read-op` (not write-op) since these are all read operations
- **Issues discovered**: Routing comment says 26 but plan targets 31 — correct, remaining 5 entries come in Phases 3-4
- **Items for Lead review**: None blocking

### Lead Review
- **Result**: PASS
- **Reviewed**: 2026-04-11
- **Notes**:
  1. **Commands match established pattern exactly**: All 3 commands are structurally identical to `commands/audit.md` — same delegation protocol block, same `@-reference` pattern, same context block. Clean.
  2. **Workflows are well-structured**: ug-validate has 3 steps (init, resolve-targets, execute) with depth-gated validation logic. ug-audit has 2 steps with comprehensive codebase scanning patterns. ug-status has 2 steps with 6-part health metrics and a formatted report template. All include `<success_criteria>` sections.
  3. **Routing entries verified**: `node require` confirms 26 entries. All 3 new entries have correct agent (`fp-docs-ug-validator`), correct type (`read`), correct workflow filenames. Descriptions are concise and match plan.
  4. **Test specs are thorough**: Each covers routing path, pipeline behavior (none for read ops), expected markers, files touched, error paths, and edge cases. Good coverage of flag combinations and degraded-mode behavior (Playwright unavailable, codebase unavailable).
  5. **ug-validate workflow correctly includes ug-ui-verification.md**: Unlike ug-audit and ug-status which only need ug-validation-rules + ug-standards + fp-project, ug-validate also loads ug-ui-verification.md because it needs the Playwright/code-trace procedures. Correct differentiation.
  6. **No issues found**: Clean pass, no second-pass items from this phase.
- **Second-pass items**: None
- **Commit**: ready

---

## Phase: 3 -- Write Commands (ug-generate, ug-update, ug-screenshot)
**Status**: complete
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 18 | commands/ug-generate.md | team-architect | done | Write op, --type/--no-screenshots/--plan-only flags |
| 19 | commands/ug-update.md | team-architect | done | Write op, --refresh-screenshots/--no-tone-check flags |
| 20 | commands/ug-screenshot.md | team-architect | done | Write op, --all/--replace/--dry-run flags |
| 21 | workflows/ug-generate.md | team-architect | done | 7-step: init, scope, research, write+UI, validate stages 3-4, fix violations, finalize |
| 22 | workflows/ug-update.md | team-architect | done | 7-step: init, target, diff, impact, write, validate stages 3-4, finalize |
| 23 | workflows/ug-screenshot.md | team-architect | done | 5-step: init, targets, capture, validate stages 3-4, finalize. --dry-run exits early |
| 24 | lib/routing.cjs — add 3 write entries | team-engineer | done | 3 ROUTING_TABLE + 3 DESCRIPTIONS, table now 29 entries |
| 25 | tests/specs/ug-generate.md | team-engineer | done | 5 UG pipeline stages, 7-step routing, 6 error + 6 edge cases |
| 26 | tests/specs/ug-update.md | team-engineer | done | 5 UG pipeline stages, 8-step routing, 4 error + 6 edge cases |
| 27 | tests/specs/ug-screenshot.md | team-engineer | done | 5 UG pipeline stages, Playwright-required, 4 error + 8 edge cases |

### Discoveries
- Routing table count goes from 26 to 29 with the 3 write commands (will reach 31 when ug-preview and ug-batch added in Phase 4)
- Write workflows use multi-agent delegation: researcher -> ug-writer -> ug-validator -> conditional fix -> finalize
- ug-screenshot has Playwright as a hard requirement (unlike ug-generate/ug-update which fall back to code trace)

### Phase Completion Summary
- **Files created**: commands/ug-generate.md, commands/ug-update.md, commands/ug-screenshot.md, workflows/ug-generate.md, workflows/ug-update.md, workflows/ug-screenshot.md, tests/specs/ug-generate.md, tests/specs/ug-update.md, tests/specs/ug-screenshot.md
- **Files modified**: lib/routing.cjs (added 3 write routing entries + 3 descriptions, 29 total)
- **Files deleted**:
- **Decisions made**: ug-screenshot requires Playwright (no code-trace fallback for actual capture)
- **Issues discovered**: None
- **Items for Lead review**: None

### Lead Review
- **Result**: PASS
- **Reviewed**: 2026-04-11
- **Notes**:
  1. **Commands match pattern exactly**: All 3 correctly say "Operation type: write (full pipeline required)". Structurally identical to existing write commands.
  2. **Workflows are well-structured multi-agent pipelines**: ug-generate (7 steps, researcher -> writer -> validator -> conditional fix -> finalize). ug-update (7 steps with diff analysis and targeted edits). ug-screenshot (5 steps, appropriately simpler). All have `<success_criteria>`.
  3. **Smart design: ug-screenshot requires Playwright**: Unlike generate/update which fall back to code trace, screenshot correctly treats Playwright as hard requirement. Test spec documents this as error path, not fallback.
  4. **Conditional fix step prevents jargon leakage**: ug-generate step 6 re-spawns writer if validator finds FAIL issues. Good correction loop.
  5. **Routing verified**: 29 entries confirmed via `node require`. Comments updated. All 3 write entries use `fp-docs-ug-writer` agent.
  6. **Test specs correctly differentiate write from read**: Pipeline stages, git commit markers, delegation markers all present.
- **Second-pass items**: None
- **Commit**: ready

---

## Phase: 4 -- Admin + Batch Commands (ug-preview, ug-batch)
**Status**: complete
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 28 | commands/ug-preview.md | team-architect | done | Admin op, --local/--deploy/--stop flags, Read in allowed-tools |
| 29 | commands/ug-batch.md | team-architect | done | Batch op, 3 subcommands (validate/screenshot/update), --section/--all flags |
| 30 | workflows/ug-preview.md | team-architect | done | 3-step: init, verify scaffold, execute preview action (fp-docs-system). Hugo server lifecycle. |
| 31 | workflows/ug-batch.md | team-architect | done | 8-step: init, parse, enumerate, team-check, team-execute OR sequential, pipeline (write only), report. |
| 32 | lib/routing.cjs — add 2 entries | team-engineer | done | ug-preview (admin, fp-docs-system) + ug-batch (batch, null). Table reaches plan target of 31. |
| 33 | tests/specs/ug-preview.md | team-engineer | done | Admin-type, no pipeline, Hugo lifecycle, 6 error + 7 edge cases |
| 34 | tests/specs/ug-batch.md | team-engineer | done | Batch-type, varies pipeline per wrapped op, Agent Teams, 6 error + 8 edge cases |

### Discoveries
- Routing table reaches plan target of 31 entries (23 original + 8 ug-*)
- ug-batch pipeline varies: validate=read-only, screenshot/update=write with single aggregated commit
- ug-batch workflow is the most sophisticated — 8 steps with Agent Teams/sequential branching

### Phase Completion Summary
- **Files created**: commands/ug-preview.md, commands/ug-batch.md, workflows/ug-preview.md, workflows/ug-batch.md, tests/specs/ug-preview.md, tests/specs/ug-batch.md
- **Files modified**: lib/routing.cjs (added 2 routing entries + 2 descriptions, 31 total)
- **Files deleted**:
- **Decisions made**: ug-batch uses single aggregated commit for write ops (not per-page)
- **Issues discovered**: None blocking
- **Items for Lead review**: None

### Lead Review
- **Result**: PASS WITH NOTES
- **Reviewed**: 2026-04-11
- **Notes**:
  1. **ug-preview command has `Read` in allowed-tools**: Other commands only have `Bash` and `Task`. The `Read` tool is not needed by the thin command dispatcher since it delegates everything via the workflow. Harmless but inconsistent ��� second-pass item.
  2. **ug-batch workflow is excellent**: 8 steps with proper Agent Teams branching (step 5 for teams, step 6 for sequential fallback). Smart design: write ops get one pipeline run + one commit across all pages (not per-page). Matches the existing `parallel.md` pattern.
  3. **Routing at plan target**: 31 entries confirmed via `node require`. Comments updated. ug-preview uses fp-docs-system (admin type), ug-batch uses null agent (batch type). Matches plan exactly.
  4. **ug-preview workflow handles scaffold bootstrap**: Step 2 checks for scaffold and auto-bootstraps if missing — graceful degradation. Hugo server management (start/stop/deploy) is clean.
  5. **Test specs cover both types well**: ug-preview covers Hugo lifecycle and deploy workflow trigger. ug-batch correctly documents variable pipeline behavior based on wrapped operation.
  6. **ug-batch subcommand dispatch is correct**: validate=read (no pipeline, no commit), screenshot/update=write (pipeline + single commit). Test spec documents this clearly.
- **Second-pass items**: #1 (ug-preview Read tool in allowed-tools — cosmetic)
- **Commit**: ready

---

## Current Phase: 5 -- Integration (health, init, specs)
**Status**: complete
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 35 | lib/health.cjs — update expected counts | team-engineer | done | routing 31, commands 31, workflows 31, agents 12. Added user-guide-scaffold check (#9). |
| 36 | lib/init.cjs — user guide init functions | team-engineer | done | 5 new functions: getUserGuidePipelineConfig, getUserGuideConfig, checkUserGuideScaffold, initUserGuideWriteOp, initUserGuideReadOp. CLI router extended with ug-write-op and ug-read-op. |
| 37 | config.json — model_profile for new agents | team-engineer | done | fp-docs-ug-writer: opus/opus/sonnet (mirrors modifier). fp-docs-ug-validator: opus/sonnet/sonnet (mirrors validator). |
| 38 | specs/architecture.md — document new system | team-architect | done | 19 UG references added: agents, commands, pipeline, routing, scaffold, config sections |
| 39 | specs/features-and-capabilities.md — document new commands | team-architect | done | 23 UG references added: 8 commands, 2 agents, 5-stage pipeline, content types, templates |
| 40 | specs/usage-and-workflows.md — document user workflows | team-architect | done | 62 UG references added: command reference, config options, workflows G-J, gotchas, best practices |

### Discoveries
- health.cjs runs clean in plugin dev mode: 10 pass, 1 warn (codebase-root), 2 skip (docs-root, ug-scaffold). Overall: healthy.
- init.cjs scaffold auto-check uses lazy require of scaffold.cjs — graceful degradation if scaffold module not ready
- Model profile entries confirmed: writer=modifier pattern, validator=validator pattern (resolves Phase 1 second-pass item)

### Phase Completion Summary
- **Files created**: None
- **Files modified**: lib/health.cjs, lib/init.cjs, config.json, specs/architecture.md, specs/features-and-capabilities.md, specs/usage-and-workflows.md
- **Files deleted**: None
- **Decisions made**: health.cjs checks scaffolds dir for .md files (currently 0) — pass status since no expected count set for scaffolds
- **Issues discovered**: None
- **Items for Lead review**: Phase 1 second-pass item (model_profile) resolved

### Lead Review
- **Result**: PASS
- **Reviewed**: 2026-04-11
- **Notes**:
  1. **health.cjs verified**: Counts updated correctly (31/31/31/12). New check #9 (user-guide-scaffold) gracefully handles all states: pass/warn/skip. Health check runs clean — overall healthy.
  2. **init.cjs verified**: 5 new functions follow established patterns. `initUserGuideWriteOp` loads UG pipeline config + scaffold auto-check. `initUserGuideReadOp` loads UG validation config (jargon patterns, required sections, staleness). CLI router properly extended with ug-write-op and ug-read-op subcommands. Error messages include full usage strings.
  3. **config.json model_profile verified**: fp-docs-ug-writer mirrors modifier (opus/opus/sonnet), fp-docs-ug-validator mirrors validator (opus/sonnet/sonnet). Resolves Phase 1 second-pass item #1. JSON validity confirmed.
  4. **Spec files verified**: architecture.md (19 UG refs), features-and-capabilities.md (23 UG refs), usage-and-workflows.md (62 UG refs). All three have "Updated 2026-04-11" version stamps. Counts match (31 entries, 12 agents, etc.).
  5. **Phase 1 second-pass item resolved**: model_profile for new agents now present and correct. No remaining second-pass items from Phase 1.
- **Second-pass items**: None new. Phase 4 item (ug-preview Read tool) still pending for second pass.
- **Commit**: ready

---

