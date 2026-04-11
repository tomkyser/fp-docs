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

## Current Phase: 3 -- Write Commands (ug-generate, ug-update, ug-screenshot)
**Status**: planning
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 18 | commands/ug-generate.md | team-architect | pending | YAML frontmatter + XML body, write operation |
| 19 | commands/ug-update.md | team-architect | pending | YAML frontmatter + XML body, write operation |
| 20 | commands/ug-screenshot.md | team-architect | pending | YAML frontmatter + XML body, write operation |
| 21 | workflows/ug-generate.md | team-architect | pending | XML workflow, spawns fp-docs-ug-writer, 7-step (init through finalize) |
| 22 | workflows/ug-update.md | team-architect | pending | XML workflow, spawns fp-docs-ug-writer, 7-step |
| 23 | workflows/ug-screenshot.md | team-architect | pending | XML workflow, spawns fp-docs-ug-writer |
| 24 | lib/routing.cjs — add 3 write entries | team-engineer | pending | ug-generate, ug-update, ug-screenshot routing + descriptions |
| 25 | tests/specs/ug-generate.md | team-engineer | pending | Behavioral test spec |
| 26 | tests/specs/ug-update.md | team-engineer | pending | Behavioral test spec |
| 27 | tests/specs/ug-screenshot.md | team-engineer | pending | Behavioral test spec |

### Discoveries

### Phase Completion Summary
- **Files created**:
- **Files modified**:
- **Files deleted**:
- **Decisions made**:
- **Issues discovered**:
- **Items for Lead review**:

### Lead Review
- **Result**: pending
- **Notes**:
- **Commit**: pending

---

