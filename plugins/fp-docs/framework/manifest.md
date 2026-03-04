# fp-docs System — Manifest v2.7.1

## Plugin
- **Name**: fp-docs
- **Namespace**: /fp-docs:* (e.g., /fp-docs:revise, /fp-docs:citations)
- **Version**: 2.7.1

## Engines

| Engine | Agent File | Model | Operations |
|---|---|---|---|
| orchestrate | agents/orchestrate.md | opus | Universal routing, delegation, pipeline coordination |
| modify | agents/modify.md | inherit | revise, add, auto-update, auto-revise, deprecate |
| validate | agents/validate.md | inherit | audit, verify, sanity-check, test |
| citations | agents/citations.md | inherit | generate, update, verify, audit |
| api-refs | agents/api-refs.md | inherit | generate, audit |
| locals | agents/locals.md | inherit | annotate, contracts, cross-ref, validate, shapes, coverage |
| verbosity | agents/verbosity.md | sonnet | audit |
| index | agents/index.md | sonnet | update-project-index, update-doc-links, update-example-claude |
| system | agents/system.md | sonnet | update-skills, setup, sync |

## Commands

| Command | Skill File | Routes To | Specialist Engine | Operation |
|---|---|---|---|---|
| /revise | skills/revise/SKILL.md | orchestrate | modify | revise |
| /add | skills/add/SKILL.md | orchestrate | modify | add |
| /auto-update | skills/auto-update/SKILL.md | orchestrate | modify | auto-update |
| /auto-revise | skills/auto-revise/SKILL.md | orchestrate | modify | auto-revise |
| /deprecate | skills/deprecate/SKILL.md | orchestrate | modify | deprecate |
| /audit | skills/audit/SKILL.md | orchestrate | validate | audit |
| /verify | skills/verify/SKILL.md | orchestrate | validate | verify |
| /sanity-check | skills/sanity-check/SKILL.md | orchestrate | validate | sanity-check |
| /test | skills/test/SKILL.md | orchestrate | validate | test |
| /citations | skills/citations/SKILL.md | orchestrate | citations | (subcommand) |
| /api-ref | skills/api-ref/SKILL.md | orchestrate | api-refs | (subcommand) |
| /locals | skills/locals/SKILL.md | orchestrate | locals | (subcommand) |
| /verbosity-audit | skills/verbosity-audit/SKILL.md | orchestrate | verbosity | audit |
| /update-index | skills/update-index/SKILL.md | orchestrate | index | update-project-index |
| /update-claude | skills/update-claude/SKILL.md | orchestrate | index | update-example-claude |
| /update-skills | skills/update-skills/SKILL.md | orchestrate | system | update-skills |
| /setup | skills/setup/SKILL.md | orchestrate | system | setup |
| /sync | skills/sync/SKILL.md | orchestrate | system | sync |
| /parallel | skills/parallel/SKILL.md | orchestrate | orchestrate | (batch) |

## Shared Modules (Preloaded)

| Module | Location | Preloaded By |
|---|---|---|
| Standards | modules/mod-standards/SKILL.md | ALL engines |
| Project Config | modules/mod-project/SKILL.md | ALL engines |
| Pipeline | modules/mod-pipeline/SKILL.md | modify, orchestrate |
| Citations | modules/mod-citations/SKILL.md | modify, citations |
| API Refs | modules/mod-api-refs/SKILL.md | modify, api-refs |
| Locals | modules/mod-locals/SKILL.md | modify, locals |
| Verbosity | modules/mod-verbosity/SKILL.md | modify, verbosity |
| Validation | modules/mod-validation/SKILL.md | modify, validate |
| Changelog | modules/mod-changelog/SKILL.md | modify (preloaded), orchestrate |
| Index | modules/mod-index/SKILL.md | modify (preloaded), index |
| Orchestration | modules/mod-orchestration/SKILL.md | orchestrate |

## On-Demand Algorithms

| Algorithm | Path | Loaded By |
|---|---|---|
| Verbosity Algorithm | framework/algorithms/verbosity-algorithm.md | Pipeline stage 1 |
| Citation Algorithm | framework/algorithms/citation-algorithm.md | Pipeline stage 2 |
| API Ref Algorithm | framework/algorithms/api-ref-algorithm.md | Pipeline stage 3 |
| Validation Algorithm | framework/algorithms/validation-algorithm.md | Pipeline stages 4-5 |
| Codebase Analysis Guide | framework/algorithms/codebase-analysis-guide.md | Engines scanning source |
| Git Sync Rules | framework/algorithms/git-sync-rules.md | system sync, SessionStart hook, all write engines |

## Instruction Files

| Engine | Instructions |
|---|---|
| orchestrate | orchestrate/delegate.md |
| modify | modify/revise.md, modify/add.md, modify/auto-update.md, modify/auto-revise.md, modify/deprecate.md |
| validate | validate/audit.md, validate/verify.md, validate/sanity-check.md, validate/test.md |
| citations | citations/generate.md, citations/update.md, citations/verify.md, citations/audit.md |
| api-refs | api-refs/generate.md, api-refs/audit.md |
| locals | locals/annotate.md, locals/contracts.md, locals/cross-ref.md, locals/validate.md, locals/shapes.md, locals/coverage.md |
| verbosity | verbosity/audit.md |
| index | index/update.md, index/update-example-claude.md |
| system | system/update-skills.md, system/setup.md, system/sync.md |

## Hooks

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| SessionStart | (all) | scripts/inject-manifest.sh | Inject plugin root + manifest |
| SubagentStop | modify | scripts/post-modify-check.sh | Validate pipeline completion |
| SubagentStop | orchestrate | scripts/post-orchestrate-check.sh | Validate orchestration completion |
| TeammateIdle | (all) | scripts/teammate-idle-check.sh | Validate teammate delegation results |
| SessionStart | (all) | scripts/branch-sync-check.sh | Detect branch mismatch + verify remote + pull latest |
| TaskCompleted | (all) | scripts/task-completed-check.sh | Validate task outputs |

## Utility Scripts

| Script | Sourced By | Purpose |
|---|---|---|
| scripts/remote-check.sh | branch-sync-check.sh, docs-commit.sh | Remote accessibility check, pull/fetch, diagnostic formatting |

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
