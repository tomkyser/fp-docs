# Index Rules

Procedure for updating PROJECT-INDEX.md. Loaded on-demand when structural changes occur.

## File Path

`docs/claude-code-docs-system/PROJECT-INDEX.md`

## When to Trigger

- New documentation sections created
- Major reorganization of doc structure
- New source directories added
- NOT for content-only changes within existing docs

## Modes

| Mode | Description |
|------|-------------|
| quick | Update file counts and recently-changed modules only |
| update | Read existing index, identify changes, update incrementally |
| full | Regenerate entire index from codebase scan |

## Quick Mode Steps

1. Read existing PROJECT-INDEX.md
2. Update File Statistics table (count files in key directories)
3. Update Generated date
4. Write updated content

## Update Mode Steps

1. Read existing PROJECT-INDEX.md
2. Check changes since last update: `git log --since="<date>" --name-only`
3. For each affected section: re-scan source directory, update entries
4. Update file statistics and Generated date
5. Write updated content

## Full Mode Steps

1. Scan entire theme directory
2. Regenerate all sections: Project Structure, Entry Points, Core Modules, Helpers, Components, Cron Jobs, Feeds, Mobile API, Configuration, Key Integrations, Namespaces, Constants, Quick Reference, File Statistics, Security Notes, Performance Notes

## Git Consistency

- Use `git ls-tree` for file enumeration, not filesystem tools
- Check for uncommitted changes before update/full mode
- Use `git ls-tree -r --name-only HEAD` for counts
- Record branch name in index header
- Preserve existing Security Notes and Performance Notes
- Only include git-tracked files
