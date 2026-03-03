# Changelog

All notable changes to the fp-docs plugin will be documented in this file.

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
