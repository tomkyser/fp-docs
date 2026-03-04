# Changelog

All notable changes to the fp-docs plugin will be documented in this file.

## [2.8.0] - 2026-03-04

### Added
- **Ephemeral WP-CLI `fp-locals` tool** — restored the `token_get_all()`-based PHP CLI that provides 100% accurate `$locals` extraction, previously lost during the plugin conversion
- `framework/tools/class-locals-cli.php` — the WP-CLI command source (~750 lines) with 4 subcommands: `extract`, `validate`, `cross-ref`, `coverage`
- `scripts/locals-cli-setup.sh` — ephemeral CLI installation: copies PHP file to theme, registers in `functions.php`, verifies with `ddev wp fp-locals --help`
- `scripts/locals-cli-teardown.sh` — ephemeral CLI removal: unregisters from `functions.php`, deletes file, verifies cleanup
- `scripts/locals-cli-cleanup-check.sh` — SubagentStop safety-net hook for locals engine, auto-cleans orphaned CLI artifacts
- SubagentStop hook entry in `hooks.json` for locals engine (matcher: "locals")
- §7 "Locals CLI Tool" in `system-config.md` with 4 config variables (`cli_enabled`, `cli_auto_teardown`, `cli_source`, `cli_target`), ephemeral lifecycle, and subcommand-to-CLI mapping table
- "Tools" section in `manifest.md` documenting `class-locals-cli.php`
- Design decision #17 in architecture spec: ephemeral CLI tool pattern

### Changed
- All 5 CLI-dependent locals instruction files rewritten with CLI-first approach + manual fallback: `annotate.md`, `contracts.md`, `cross-ref.md`, `validate.md`, `coverage.md`
- `agents/locals.md` — added "Step 3: Install the CLI Tool (Ephemeral)" with setup/teardown instructions and CLI subcommands table; updated Critical Rules to make CLI usage unconditional rather than "when available"
- `modules/mod-locals/SKILL.md` — expanded "Ground Truth Engine" section with CLI tool location/lifecycle, CLI subcommands table, extraction capabilities (type inference, guard detection, de-duplication, caller detection), and fallback documentation
- `manifest.md` — added locals SubagentStop hook, locals CLI utility scripts, new Tools section
- Specs updated (architecture.md, features-and-capabilities.md, usage-and-workflows.md) to document ephemeral CLI integration

## [2.7.2] - 2026-03-04

### Added
- **Codebase change watermark** — new `.sync-watermark` file in docs repo tracks the codebase commit hash that docs were last synced against, enabling cross-repo change detection regardless of branch state
- Watermark-based diff algorithm with 3-scenario strategy: valid watermark (diff from watermark to HEAD), no watermark + feature branch (fallback to `origin/master...HEAD`), no watermark + master (initial source scan)
- Watermark state reporting in `branch-sync-check.sh` SessionStart hook — injects `current`, `stale (N commits)`, `invalid`, `malformed`, or `none` into session context
- Initial-sync diff report variant format for first-ever sync on master
- New "Sync Watermark" subsection in usage-and-workflows.md
- New "Codebase Change Watermark" subsection in git-sync-rules.md algorithm

### Changed
- `/fp-docs:sync` now ALWAYS runs change detection (Phase 3), even when branches already match — fixes the bug where syncing on `master/master` after pulling new codebase changes reported "already synced" with no diff
- Sync flow restructured into 3 explicit phases: Remote sync → Branch alignment → Change detection
- Diff report format updated with watermark metadata: sync baseline, commits since last sync, codebase HEAD
- `sync.md` instruction file rewritten with 14-step phased flow (3a-3n) replacing the old 8-step flow that short-circuited on branch match
- `branch-sync-check.sh` updated to read watermark file and surface stale-watermark state proactively
- Specs updated (architecture.md, features-and-capabilities.md, usage-and-workflows.md) to document watermark mechanism

### Fixed
- **Critical**: Sync command no longer short-circuits when codebase and docs branches match — previously, pulling new commits to codebase master and running `/fp-docs:sync` with docs also on master would report "already synced" and generate no diff report, because the old algorithm only compared branch names (nominal sync) rather than detecting actual codebase content changes (semantic sync)
- Diff algorithm no longer relies solely on `git diff --name-only origin/master...HEAD`, which produces empty results on master after pulling (since `origin/master == HEAD`)

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
