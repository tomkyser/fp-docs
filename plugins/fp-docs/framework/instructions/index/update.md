# Index Update — Instruction

## Inputs
- `$ARGUMENTS`: update|full
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-index

## Steps

1. Parse mode from $ARGUMENTS. Default to `update`.

2. For `update` mode:
   a. Read existing PROJECT-INDEX.md
   b. Check changes since last update via git log
   c. For each affected section: re-scan source directory, update entries
   d. Update file statistics and Generated date
   e. Write updated content

3. For `full` mode:
   a. Scan entire theme directory using `git ls-tree -r --name-only HEAD`
   b. Regenerate all sections
   c. Preserve existing Security Notes and Performance Notes
   d. Record branch name in header
   e. Write regenerated content

4. Update the Generated date.

## Output

Report: sections updated, file count changes, branch recorded.
