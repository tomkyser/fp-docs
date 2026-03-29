# Index Module

Defines PROJECT-INDEX.md update procedure and link format rules.

## File Path

`docs/claude-code-docs-system/PROJECT-INDEX.md`

## When to Update

- Only when structural changes occurred (new sections, major reorganization)
- NOT for content-only changes within existing doc files
- NOT for changelog or tracker updates

## Mode Selection

| Mode | Description |
|------|-------------|
| **quick** | Update file counts and recently-changed modules only |
| **update** (default) | Read existing index, identify changes, update incrementally |
| **full** | Regenerate entire index from codebase scan |

## Update Procedure

### Quick Mode
1. Read existing PROJECT-INDEX.md
2. Update File Statistics table by counting files in key directories
3. Update Generated date
4. Write updated content

### Update Mode
1. Read existing PROJECT-INDEX.md
2. Check changes since last update via `git log --since="<last generated date>"`
3. For each affected section: re-scan relevant source directory, update entries
4. Update file statistics and Generated date
5. Write updated content

### Full Mode
1. Scan entire theme directory structure
2. Regenerate complete index with all sections: Project Structure, Entry Points, Core Modules, Helpers, Components, Cron Jobs, Feeds, Mobile API, Configuration, Key Integrations, Namespaces, Constants, Quick Reference, File Statistics, Security Notes, Performance Notes

## Git Consistency Rules

- Use `git ls-tree` for file enumeration -- never filesystem-only tools
- Check for uncommitted changes before running update or full mode
- Use `git ls-tree -r --name-only HEAD` for counts and listings
- Record branch name in index header
- Preserve existing Security Notes and Performance Notes sections
- Only include files tracked by git

## Dual-Artifact Maintenance

The index engine maintains two artifacts:
1. **PROJECT-INDEX.md** -- Exhaustive codebase file tree (the sole codebase index per D-05)
2. **source-map.json** -- Source-to-doc mapping with file-level granularity

Both must be updated together. When structural changes occur:
- Regenerate PROJECT-INDEX.md via `git ls-tree` scan
- Reconcile source-map.json via `node {plugin-root}/fp-tools.cjs source-map generate`

Pipeline stage 7 (index update) triggers both updates when structural file changes are detected.
