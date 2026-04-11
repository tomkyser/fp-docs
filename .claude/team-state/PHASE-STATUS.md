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

## Current Phase: 2 -- Read-Only Commands (ug-validate, ug-audit, ug-status)
**Status**: planning
**Started**: 2026-04-11

### Task Claims
| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 8 | commands/ug-validate.md | team-architect | pending | YAML frontmatter + XML body, read operation |
| 9 | commands/ug-audit.md | team-architect | pending | YAML frontmatter + XML body, read operation |
| 10 | commands/ug-status.md | team-architect | pending | YAML frontmatter + XML body, read operation |
| 11 | workflows/ug-validate.md | team-architect | pending | XML workflow, spawns fp-docs-ug-validator |
| 12 | workflows/ug-audit.md | team-architect | pending | XML workflow, spawns fp-docs-ug-validator |
| 13 | workflows/ug-status.md | team-architect | pending | XML workflow, spawns fp-docs-ug-validator |
| 14 | lib/routing.cjs — add 3 read entries | team-engineer | pending | ug-validate, ug-audit, ug-status routing + descriptions |
| 15 | tests/specs/ug-validate.md | team-engineer | pending | Behavioral test spec |
| 16 | tests/specs/ug-audit.md | team-engineer | pending | Behavioral test spec |
| 17 | tests/specs/ug-status.md | team-engineer | pending | Behavioral test spec |

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

