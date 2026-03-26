---
command: update
engine: system
operation: update
instruction: framework/instructions/system/update.md
agent: orchestrate
context: fork
type: meta
pipeline_stages: none
subcommands: none
flags: --check-only, --force
---

# /fp-docs:update - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:update [--check-only | --force]`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine
3. Orchestrate classifies as admin operation (engine: system)
4. Orchestrate delegates directly to system engine
5. System engine reads instruction file `framework/instructions/system/update.md`
6. No pipeline triggered -- admin operation with direct execution

## Pipeline Stages

None. Admin operations execute directly without the 8-stage pipeline.

## Expected Markers

- Version check output: "up to date" or "UPDATE AVAILABLE" banner
- Version comparison: current version vs latest version
- Release notes / changelog from GitHub Releases API
- If update executed: "UPDATE COMPLETE" banner with version change
- Restart reminder: "Restart Claude Code now"

## Files Typically Touched

- `.fp-docs/update-cache.json` -- cleared after successful update
- Plugin files via `git checkout` (entire plugin directory updated to new tag)

## Error Paths

- Network failure: GitHub Releases API unreachable, report error and suggest `--check-only` later
- Rate limit: GitHub API rate limit exceeded, report cached status if available
- Git checkout failure: tag not found or working directory dirty, report error with recovery steps
- No releases: repository has no published releases, report "no releases found"

## Edge Cases

- `--check-only` flag: stops after displaying changelog, no confirmation or execution
- `--force` flag: skips user confirmation, executes update immediately after displaying changelog
- Already up to date: reports current version and stops
- First run with no cache: runs synchronous check (no cached status available)
- Tag format mismatch: tries without `v` prefix first, then with `v` prefix as fallback
