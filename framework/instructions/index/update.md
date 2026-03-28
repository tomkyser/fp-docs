# Index Update -- Instruction

## Inputs
- `$ARGUMENTS`: update|full
- Preloaded modules: mod-standards, mod-project, mod-index

## Steps

1. Parse mode from $ARGUMENTS. Default to `update`.

2. For `update` mode:
   a. Read existing PROJECT-INDEX.md
   b. Check changes since last update via git log
   c. For each affected section: re-scan source directory, update entries
   d. Update file statistics and Generated date
   e. Write updated content
   f. Reconcile source-map.json: run `node {plugin-root}/fp-tools.cjs source-map generate`

3. For `full` mode:
   a. Scan entire theme directory using `git ls-tree -r --name-only HEAD`
   b. Regenerate all sections
   c. Preserve existing Security Notes and Performance Notes
   d. Record branch name in header
   e. Write regenerated content
   f. Regenerate source-map.json: run `node {plugin-root}/fp-tools.cjs source-map generate`

4. Update the Generated date.

5. Verify dual-artifact consistency:
   - PROJECT-INDEX.md reflects current git-tracked file tree
   - source-map.json has entries for all documented source directories

**Pipeline context:** When invoked as pipeline stage 7, the CJS pipeline engine handles skip logic (`node {plugin-root}/fp-tools.cjs pipeline run-stage 7`). This instruction file is used when the index engine runs the actual update after CJS determines it is needed.

## Output

Report: sections updated, file count changes, branch recorded, source-map entries count.
