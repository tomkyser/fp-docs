# fp-docs System — Manifest v2.6.0

## Plugin
- **Name**: fp-docs
- **Namespace**: /docs-* (also accessible as /fp-docs:docs-*)
- **Version**: 2.6.0

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
| docs-system | agents/docs-system.md | sonnet | update-skills, setup, sync |

## Commands

| Command | Skill File | Engine | Operation |
|---|---|---|---|
| /docs-revise | skills/docs-revise/SKILL.md | docs-modify | revise |
| /docs-add | skills/docs-add/SKILL.md | docs-modify | add |
| /docs-auto-update | skills/docs-auto-update/SKILL.md | docs-modify | auto-update |
| /docs-auto-revise | skills/docs-auto-revise/SKILL.md | docs-modify | auto-revise |
| /docs-deprecate | skills/docs-deprecate/SKILL.md | docs-modify | deprecate |
| /docs-audit | skills/docs-audit/SKILL.md | docs-validate | audit |
| /docs-verify | skills/docs-verify/SKILL.md | docs-validate | verify |
| /docs-sanity-check | skills/docs-sanity-check/SKILL.md | docs-validate | sanity-check |
| /docs-test | skills/docs-test/SKILL.md | docs-validate | test |
| /docs-citations | skills/docs-citations/SKILL.md | docs-citations | (subcommand) |
| /docs-api-ref | skills/docs-api-ref/SKILL.md | docs-api-refs | (subcommand) |
| /docs-locals | skills/docs-locals/SKILL.md | docs-locals | (subcommand) |
| /docs-verbosity-audit | skills/docs-verbosity-audit/SKILL.md | docs-verbosity | audit |
| /docs-update-index | skills/docs-update-index/SKILL.md | docs-index | update-project-index |
| /docs-update-claude | skills/docs-update-claude/SKILL.md | docs-index | update-example-claude |
| /docs-update-skills | skills/docs-update-skills/SKILL.md | docs-system | update-skills |
| /docs-setup | skills/docs-setup/SKILL.md | docs-system | setup |
| /docs-sync | skills/docs-sync/SKILL.md | docs-system | sync |
| /docs-parallel | skills/docs-parallel/SKILL.md | (orchestrator) | (batch) |

## Shared Modules (Preloaded)

| Module | Location | Preloaded By |
|---|---|---|
| Standards | modules/docs-mod-standards/SKILL.md | ALL engines |
| Project Config | modules/docs-mod-project/SKILL.md | ALL engines |
| Pipeline | modules/docs-mod-pipeline/SKILL.md | docs-modify |
| Citations | modules/docs-mod-citations/SKILL.md | docs-modify, docs-citations |
| API Refs | modules/docs-mod-api-refs/SKILL.md | docs-modify, docs-api-refs |
| Locals | modules/docs-mod-locals/SKILL.md | docs-modify, docs-locals |
| Verbosity | modules/docs-mod-verbosity/SKILL.md | docs-modify, docs-verbosity |
| Validation | modules/docs-mod-validation/SKILL.md | docs-modify, docs-validate |
| Changelog | modules/docs-mod-changelog/SKILL.md | docs-modify (preloaded) |
| Index | modules/docs-mod-index/SKILL.md | docs-modify (preloaded), docs-index |

## On-Demand Algorithms

| Algorithm | Path | Loaded By |
|---|---|---|
| Verbosity Algorithm | framework/algorithms/verbosity-algorithm.md | Pipeline stage 1 |
| Citation Algorithm | framework/algorithms/citation-algorithm.md | Pipeline stage 2 |
| API Ref Algorithm | framework/algorithms/api-ref-algorithm.md | Pipeline stage 3 |
| Validation Algorithm | framework/algorithms/validation-algorithm.md | Pipeline stages 4-5 |
| Codebase Analysis Guide | framework/algorithms/codebase-analysis-guide.md | Engines scanning source |
| Git Sync Rules | framework/algorithms/git-sync-rules.md | docs-system sync, SessionStart hook |

## Instruction Files

| Engine | Instructions |
|---|---|
| docs-modify | modify/revise.md, modify/add.md, modify/auto-update.md, modify/auto-revise.md, modify/deprecate.md |
| docs-validate | validate/audit.md, validate/verify.md, validate/sanity-check.md, validate/test.md |
| docs-citations | citations/generate.md, citations/update.md, citations/verify.md, citations/audit.md |
| docs-api-refs | api-refs/generate.md, api-refs/audit.md |
| docs-locals | locals/annotate.md, locals/contracts.md, locals/cross-ref.md, locals/validate.md, locals/shapes.md, locals/coverage.md |
| docs-verbosity | verbosity/audit.md |
| docs-index | index/update.md, index/update-example-claude.md |
| docs-system | system/update-skills.md, system/setup.md, system/sync.md |

## Hooks

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| SessionStart | (all) | scripts/inject-manifest.sh | Inject plugin root + manifest |
| SubagentStop | docs-modify | scripts/post-modify-check.sh | Validate pipeline completion |
| TeammateIdle | (all) | scripts/teammate-idle-check.sh | Validate teammate pipeline |
| SessionStart | (all) | scripts/branch-sync-check.sh | Detect branch mismatch |
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
