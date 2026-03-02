# fp-docs System — Manifest v2.0.0

## Plugin
- **Name**: fp-docs
- **Namespace**: /fp-docs:*
- **Version**: 2.0.0

## Engines

| Engine | Agent File | Model | Operations |
|---|---|---|---|
| docs-modify | agents/docs-modify.md | inherit | revise, add, auto-update, auto-revise, deprecate |
| docs-validate | agents/docs-validate.md | inherit | audit, verify, sanity-check, test |
| docs-citations | agents/docs-citations.md | inherit | generate, update, verify, audit |
| docs-api-refs | agents/docs-api-refs.md | inherit | generate, audit |
| docs-locals | agents/docs-locals.md | inherit | annotate, contracts, cross-ref, validate, shapes, coverage |
| docs-verbosity | agents/docs-verbosity.md | sonnet | audit |
| docs-index | agents/docs-index.md | sonnet | update-project-index, update-doc-links, update-example-claude |
| docs-system | agents/docs-system.md | sonnet | update-skills, setup |

## Commands

| Command | Skill File | Engine | Operation |
|---|---|---|---|
| /fp-docs:revise | skills/revise/SKILL.md | docs-modify | revise |
| /fp-docs:add | skills/add/SKILL.md | docs-modify | add |
| /fp-docs:auto-update | skills/auto-update/SKILL.md | docs-modify | auto-update |
| /fp-docs:auto-revise | skills/auto-revise/SKILL.md | docs-modify | auto-revise |
| /fp-docs:deprecate | skills/deprecate/SKILL.md | docs-modify | deprecate |
| /fp-docs:audit | skills/audit/SKILL.md | docs-validate | audit |
| /fp-docs:verify | skills/verify/SKILL.md | docs-validate | verify |
| /fp-docs:sanity-check | skills/sanity-check/SKILL.md | docs-validate | sanity-check |
| /fp-docs:test | skills/test/SKILL.md | docs-validate | test |
| /fp-docs:citations | skills/citations/SKILL.md | docs-citations | (subcommand) |
| /fp-docs:api-ref | skills/api-ref/SKILL.md | docs-api-refs | (subcommand) |
| /fp-docs:locals | skills/locals/SKILL.md | docs-locals | (subcommand) |
| /fp-docs:verbosity-audit | skills/verbosity-audit/SKILL.md | docs-verbosity | audit |
| /fp-docs:update-index | skills/update-index/SKILL.md | docs-index | update-project-index |
| /fp-docs:update-claude | skills/update-claude/SKILL.md | docs-index | update-example-claude |
| /fp-docs:update-skills | skills/update-skills/SKILL.md | docs-system | update-skills |
| /fp-docs:setup | skills/setup/SKILL.md | docs-system | setup |
| /fp-docs:parallel | skills/parallel/SKILL.md | (orchestrator) | (batch) |

## Shared Modules (Preloaded)

| Module | Skill Name | Preloaded By |
|---|---|---|
| Standards | docs-mod-standards | ALL engines |
| Project Config | docs-mod-project | ALL engines |
| Pipeline | docs-mod-pipeline | docs-modify |
| Citations | docs-mod-citations | docs-modify, docs-citations |
| API Refs | docs-mod-api-refs | docs-modify, docs-api-refs |
| Locals | docs-mod-locals | docs-modify, docs-locals |
| Verbosity | docs-mod-verbosity | docs-modify, docs-verbosity |
| Validation | docs-mod-validation | docs-modify, docs-validate |
| Changelog | docs-mod-changelog | docs-modify |
| Index | docs-mod-index | docs-modify, docs-index |

## On-Demand Framework Modules

| Module | Path | Loaded By |
|---|---|---|
| Verbosity Rules | framework/modules/verbosity-rules.md | Pipeline stage 1 |
| Citation Rules | framework/modules/citation-rules.md | Pipeline stage 2 |
| API Ref Rules | framework/modules/api-ref-rules.md | Pipeline stage 3 |
| Validation Rules | framework/modules/validation-rules.md | Pipeline stages 4-5 |
| Changelog Rules | framework/modules/changelog-rules.md | Pipeline stage 6 |
| Index Rules | framework/modules/index-rules.md | Pipeline stage 7 |
| Post-Modify Checklist | framework/modules/post-modify-checklist.md | SubagentStop hook |
| Codebase Analysis Guide | framework/modules/codebase-analysis-guide.md | Engines scanning source |
| Cross-Reference Validation | framework/modules/cross-reference-validation.md | Verification checks |
| Citation Staleness Detection | framework/modules/citation-staleness-detection.md | Citation update ops |
| Locals Contract Grammar | framework/modules/locals-contract-grammar.md | Locals engine ops |

## Instruction Files

| Engine | Instructions |
|---|---|
| docs-modify | modify/revise.md, modify/add.md, modify/auto-update.md, modify/auto-revise.md, modify/deprecate.md |
| docs-validate | validate/audit.md, validate/verify.md, validate/sanity-check.md, validate/test.md |
| docs-citations | citations/generate.md, citations/update.md, citations/verify.md, citations/audit.md |
| docs-api-refs | api-refs/generate.md, api-refs/audit.md |
| docs-locals | locals/annotate.md, locals/contracts.md, locals/cross-ref.md, locals/validate.md, locals/shapes.md, locals/coverage.md |
| docs-verbosity | verbosity/audit.md |
| docs-index | index/update.md |

## Hooks

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| SessionStart | (all) | scripts/inject-manifest.sh | Inject plugin root + manifest |
| SubagentStop | docs-modify | scripts/post-modify-check.sh | Validate pipeline completion |
| TeammateIdle | (all) | scripts/teammate-idle-check.sh | Validate teammate pipeline |
| TaskCompleted | (all) | scripts/task-completed-check.sh | Validate task outputs |

## Configuration Files

| File | Purpose |
|---|---|
| framework/config/system-config.md | Feature flags, thresholds, scope tables |
| framework/config/project-config.md | FP-specific paths, mappings, enables |

## Project Files (NOT in plugin — read from project)

| File | Purpose |
|---|---|
| docs/changelog.md | Documentation changelog |
| docs/needs-revision-tracker.md | Revision queue |
| docs/About.md | Documentation hub / table of contents |
| docs/claude-code-docs-system/PROJECT-INDEX.md | Codebase reference index |
