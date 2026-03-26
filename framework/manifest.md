# fp-docs System — Manifest v1.0.0

## Plugin
- **Name**: fp-docs
- **Namespace**: /fp-docs:* (e.g., /fp-docs:revise, /fp-docs:citations)
- **Version**: 1.0.0

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
| system | agents/system.md | sonnet | update-skills, setup, sync, update |

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
| /do | skills/do/SKILL.md | orchestrate | (routed) | (intent-matched) |
| /help | skills/help/SKILL.md | orchestrate | orchestrate | help |
| /update | skills/update/SKILL.md | orchestrate | system | update |

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
| system | system/update-skills.md, system/setup.md, system/sync.md, system/update.md |

## Hooks

All hooks invoke CJS handlers via `fp-tools.cjs hooks run <event> [matcher]`.

| Event | Matcher | Handler | Purpose |
|---|---|---|---|
| SessionStart | (all) | `hooks run session-start inject-manifest` | Inject plugin root + manifest |
| SessionStart | (all) | `hooks run session-start branch-sync` | Detect branch mismatch + verify remote + pull latest |
| SessionStart | (all) | `hooks run session-start drift-nudge` | Surface pending doc updates from drift detection |
| SessionStart | (all) | `hooks run session-start update-check` | Background check for plugin updates |
| SubagentStop | modify | `hooks run subagent-stop modify` | Validate pipeline completion |
| SubagentStop | orchestrate | `hooks run subagent-stop orchestrate` | Validate orchestration completion |
| SubagentStop | locals | `hooks run subagent-stop locals` | Auto-clean orphaned CLI artifacts after locals engine stops |
| TeammateIdle | (all) | `hooks run teammate-idle` | Validate teammate delegation results |
| TaskCompleted | (all) | `hooks run task-completed` | Validate task outputs |

## CJS Modules (Hook + Utility)

| Module | Purpose |
|---|---|
| lib/hooks.cjs | All hook handlers as pure functions + CLI dispatch |
| lib/locals-cli.cjs | Ephemeral WP-CLI lifecycle (setup/teardown) |
| lib/core.cjs | Shared utilities (output, error, safeReadFile, safeJsonParse) |
| lib/paths.cjs | Path resolution (plugin root, codebase root, docs root) |
| lib/config.cjs | Plugin configuration access |
| lib/git.cjs | Three-repo git operations |
| lib/state.cjs | JSON-based state management |
| lib/routing.cjs | Command routing table and validation |
| lib/pipeline.cjs | Pipeline sequencing engine (stages 6-8) |
| lib/security.cjs | Input validation and injection prevention |
| lib/drift.cjs | Drift detection and staleness tracking |
| lib/remediate.cjs | Remediation plan persistence |
| lib/engine-compliance.cjs | CJS compliance checking for engines |
| lib/update.cjs | Background update checking, version comparison, cache management |

## Tools

| File | Purpose |
|---|---|
| framework/tools/class-locals-cli.php | WP-CLI `fp-locals` command source — ephemeral tool for token-based $locals extraction |

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
