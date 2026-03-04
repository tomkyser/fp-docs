# Sync — Instruction

## Inputs
- `$ARGUMENTS`: [merge] [--force] [--no-push] [--offline]
- Framework module: `{plugin-root}/framework/algorithms/git-sync-rules.md`

## Steps

1. Read `framework/algorithms/git-sync-rules.md` for the full sync flow, remote sync rules, and diff report format.

2. Detect current branch state from session context (injected by SessionStart hook).

3. If no arguments (default sync):
   a. Unless `--offline`: verify remote is accessible using `timeout 10 git -C {docs-root} ls-remote --exit-code origin HEAD`. If unreachable, halt with diagnostic guidance.
   b. Unless `--offline`: fetch from remote: `git -C {docs-root} fetch origin`
   c. Detect codebase branch: `git -C {codebase-root} branch --show-current`
   d. Detect docs branch: `git -C {docs-root} branch --show-current`
   e. If branches match: pull latest (`git -C {docs-root} pull --ff-only`; halt if diverged), then report "already synced"
   f. If mismatch:
      - Check if docs repo has a branch matching the codebase branch name
      - If no: pull master first (`git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`), then create branch from master, switch to it
      - If yes but on wrong branch: switch to matching branch, then pull latest on that branch
   g. Generate diff report per the format in git-sync-rules.md
   h. Write report to `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md`

4. If `merge` argument:
   a. Verify current docs branch is NOT master
   b. Unless `--offline`: fetch from remote: `git -C {docs-root} fetch origin`
   c. Unless `--offline`: pull latest on both branches before merge:
      - `git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`
      - `git -C {docs-root} checkout {feature-branch} && git -C {docs-root} pull --ff-only`
   d. Switch to docs master
   e. Merge the feature branch into master
   f. Push docs master (skip if `--no-push` or `--offline`; push failure **halts** with diagnostics)
   g. Delete the merged feature branch (local)

5. `--force` flag: force branch switch even with uncommitted changes in docs repo.

6. `--offline` flag: skip all remote operations (fetch, pull, push). Work proceeds with local state only.

## Output

Sync report: branches detected, actions taken, remote sync status, diff report location (if generated).
