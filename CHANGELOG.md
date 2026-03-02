# Changelog

All notable changes to the fp-docs plugin will be documented in this file.

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
