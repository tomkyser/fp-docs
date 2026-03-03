# Sync — Instruction

## Inputs
- `$ARGUMENTS`: [merge] [--force]
- Framework module: `{plugin-root}/framework/algorithms/git-sync-rules.md`

## Steps

1. Read `framework/algorithms/git-sync-rules.md` for the full sync flow and diff report format.

2. Detect current branch state from session context (injected by SessionStart hook).

3. If no arguments (default sync):
   a. Detect codebase branch: `git -C {codebase-root} branch --show-current`
   b. Detect docs branch: `git -C {docs-root} branch --show-current`
   c. If branches match: report "already synced"
   d. If mismatch:
      - Check if docs repo has a branch matching the codebase branch name
      - If no: create from docs master, switch to it
      - If yes but on wrong branch: switch to matching branch
   e. Generate diff report per the format in git-sync-rules.md
   f. Write report to `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`

4. If `merge` argument:
   a. Verify current docs branch is NOT master
   b. Switch to docs master
   c. Merge the feature branch into master
   d. Push docs master
   e. Delete the merged feature branch (local)

5. `--force` flag: force branch switch even with uncommitted changes in docs repo.

## Output

Sync report: branches detected, actions taken, diff report location (if generated).
