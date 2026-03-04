# Changelog

All notable changes to the fp-docs plugin will be documented in this file.

## [2.7.1] - 2026-03-04

### Changed
- Version bump to 2.7.1
- Backfilled changelog entries for 2.6.0, 2.6.1, 2.6.2, 2.7.0
- Added changelog update step to CLAUDE.md version bump procedure

## [2.7.0] - 2026-03-04

### Added
- Universal `orchestrate` engine — all 19 commands now route through a single orchestration engine that delegates to specialist engines (9 engines total)
- `mod-orchestration` shared module with delegation thresholds, batching strategy, and report formats (11 modules total)
- `framework/instructions/orchestrate/delegate.md` — master delegation algorithm
- `scripts/post-orchestrate-check.sh` — SubagentStop hook for orchestrator pipeline validation
- 3-phase pipeline delegation: Write Phase (primary op + stages 1-3), Review Phase (stages 4-5), Finalize Phase (stages 6-8)
- Scope-based execution strategies: single specialist (≤3 files), fan-out (3-8 files), team creation (>8 files)
- §6 Orchestration section in system-config.md with 8 configuration variables

### Changed
- All 19 skill files rerouted from `agent: {engine}` to `agent: orchestrate` with routing metadata (`Engine:`, `Operation:`, `Instruction:`)
- All 8 specialist engines gained Delegation Mode (write engines) or Pipeline Validation Mode (read-only engines) — standalone mode preserved for backward compatibility
- Removed `allowed-tools:` from 4 skills (audit, verify, sanity-check, verbosity-audit) — read-only enforcement handled by engine `disallowedTools`
- `mod-pipeline` updated with delegation protocol documentation
- `hooks.json` updated with SubagentStop entry for orchestrate engine
- `scripts/teammate-idle-check.sh` implemented (was stub)
- `scripts/task-completed-check.sh` implemented (was stub)
- `/fp-docs:parallel` now self-references orchestrate engine (batch operations handled natively)
- Only the orchestrator touches git — specialists never commit in delegated mode
- Specs, README, CLAUDE.md, manifest all updated

## [2.6.2] - 2026-03-03

### Changed
- Added push-to-remote enforcement for docs repo operations (Stage 8 push always runs unless `--no-push` or `push.enabled: false`)
- Rewrote README with updated architecture and installation guidance
- Updated `update-skills.md` instruction file
- Housekeeping and file cleanup

## [2.6.1] - 2026-03-03

### Changed
- Fixed naming inconsistencies across skill directories and skill files
- Corrected skill `name:` fields to match directory structure
- Version bump to 2.6.1

## [2.6.0] - 2026-03-03

### Added
- `specs/` directory with 3 canonical reference documents (architecture.md, features-and-capabilities.md, usage-and-workflows.md)
- `disallowedTools: [Write, Edit]` on read-only engines (validate, verbosity) for defense-in-depth
- Missing instruction file directories for system engine

### Changed
- Eliminated module duplication: removed 2 zero-value on-demand modules, refactored 4 overlapping modules into algorithms, absorbed 4 redundant modules into preloaded counterparts
- On-demand modules renamed to "algorithms" (`framework/algorithms/`) with clear separation: modules = rule definitions (preloaded), algorithms = execution procedures (on-demand)
- Slimmed down engine system prompts — moved domain logic into instruction files
- Restored engine contracts per original spec (engine-contract-spec.md)
- Version bump to 2.6.0

## [2.5.0] - 2026-03-03

### Changed
- Moved 10 shared modules from `skills/` to dedicated `modules/` directory
- Renamed all 19 user skill directories to match their `name:` field (e.g., `skills/revise/` → `skills/docs-revise/`)
- Added `"skills": "./modules/"` to plugin.json so modules remain discoverable for agent preloading
- Updated manifest with new paths
- Version bump to 2.5.0

## [2.4.0] - 2026-03-02

### Changed
- All 19 user skill names prefixed with `docs-` to avoid generic command collisions
- Commands are now `/docs-revise`, `/docs-sync`, `/docs-add`, etc. instead of `/revise`, `/sync`, `/add`
- Also accessible as `/fp-docs:docs-revise` etc. via plugin namespace
- Updated manifest and README to reflect new command names
- Version bump to 2.4.0

## [2.3.0] - 2026-03-02

### Changed
- Restructured repo: marketplace container at root, plugin moved to `plugins/fp-docs/`
- marketplace.json source changed from GitHub URL to relative path (`./plugins/fp-docs`)
- Matches official Claude Code marketplace structure (anthropics/claude-plugins-official)
- Fixes skill namespace issue: skills now correctly load as `fp-docs:*` instead of unprefixed
- Version bump to 2.3.0

## [2.2.0] - 2026-03-02

### Added
- Plugin marketplace support (marketplace.json, team auto-prompt via settings.json)
- LICENSE file (MIT)
- CHANGELOG.md

### Changed
- plugin.json: added repository, license, keywords fields
- Version bump to 2.2.0

## [2.1.0] - 2026-03-02

### Added
- Three-repo architecture (plugin, docs, codebase as independent git repos)
- Branch mirroring between docs and codebase repos
- `/fp-docs:sync` command for branch synchronization and diff reports
- `git-sync-rules.md` module
- `branch-sync-check.sh` SessionStart hook for branch mismatch detection
- `docs-commit.sh` utility script for docs repo commits
- Stage 8 (Docs Repo Commit) added to post-modification pipeline
- Git Awareness sections in all 8 engine agents
- 4-phase `/fp-docs:setup` with docs repo clone and gitignore verification

### Changed
- Pipeline expanded from 7 to 8 stages
- project-config.md updated with repository configuration
- README.md rewritten with installation guide and team quick start

## [2.0.0] - 2026-03-02

### Added
- Initial plugin release
- 8 engine agents (modify, validate, citations, api-refs, locals, verbosity, index, system)
- 10 shared modules (standards, project, pipeline, validation, citations, api-refs, locals, verbosity, changelog, index)
- 19 user commands in `/fp-docs:*` namespace
- 5 hooks (SessionStart manifest inject, SubagentStop, TeammateIdle, TaskCompleted)
- Framework with instruction files, modules, and config
- settings.json with default permissions
