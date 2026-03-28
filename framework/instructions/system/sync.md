# Sync — Instruction

> **CJS tooling**: This instruction file uses `fp-tools.cjs git` for commit/push operations. Read-only git operations (branch detection, diff, fetch, pull, checkout) use raw `git -C` commands as they are navigation operations without CJS equivalents.

## Inputs
- `$ARGUMENTS`: [merge] [--force] [--no-push] [--offline]
- Framework module: `{plugin-root}/framework/algorithms/git-sync-rules.md`

## Steps

1. Read `framework/algorithms/git-sync-rules.md` for the full sync flow, remote sync rules, and diff report format.

2. Detect current branch state from session context (injected by SessionStart hook).

3. If no arguments (default sync):

   **Phase 1 — Remote sync** (skip if `--offline`):
   a. Verify remote is accessible: `timeout 10 git -C {docs-root} ls-remote --exit-code origin HEAD`. If unreachable, halt with diagnostic guidance.
   b. Fetch from remote: `git -C {docs-root} fetch origin`

   **Phase 2 — Branch alignment:**
   c. Detect codebase branch: `git -C {codebase-root} branch --show-current`
   d. Detect docs branch: `git -C {docs-root} branch --show-current`
   e. If branches match: pull latest on docs branch (`git -C {docs-root} pull --ff-only`; halt if diverged). Do NOT stop here — proceed to Phase 3.
   f. If mismatch:
      - Check if docs repo has a branch matching the codebase branch name
      - If no: pull master first (`git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`), then create branch from master, switch to it
      - If yes but on wrong branch: switch to matching branch, then pull latest on that branch

   **Phase 3 — Change detection** (ALWAYS runs, even when branches already matched in step 3e):
   g. Read the watermark file at `{docs-root}/.sync-watermark` (may not exist on first sync). If it exists, parse `codebase_commit` value.
   h. Get the current codebase HEAD: `git -C {codebase-root} rev-parse HEAD`
   i. Determine if codebase has changed since last sync:
      - **If watermark exists and is valid** (commit exists in codebase history via `git -C {codebase-root} cat-file -t {watermark_commit}`):
        - If `{watermark_commit}` == `{codebase_HEAD}`: report "No codebase changes since last sync ({short-hash})". Skip diff report generation. Proceed to step 3l (watermark timestamp update).
        - Otherwise: compute diff using `git -C {codebase-root} diff --name-only {watermark_commit}...HEAD`. Count commits: `git -C {codebase-root} rev-list --count {watermark_commit}..HEAD`.
      - **If no valid watermark AND on a feature branch** (not master/main):
        - Fall back: `git -C {codebase-root} diff --name-only origin/master...HEAD`
      - **If no valid watermark AND on master** (first-ever sync):
        - No commit-based diff available. Enumerate all source directories from the source-to-doc mapping (`source-map.json`). List files in each. Use the "Initial Sync" report format from git-sync-rules.md.
   j. Filter diff results to theme-scoped paths (`themes/foreign-policy-2017/`). Map changed source files to doc files using the source-to-doc mapping (`source-map.json`, query via `fp-tools source-map lookup`). Classify each as LIKELY STALE, POSSIBLY STALE, or STRUCTURAL per git-sync-rules.md.
   k. Write diff report to `docs/diffs/{YYYY-MM-DD}_{branch}_diff_report.md` using the format from git-sync-rules.md.
   l. Update watermark file at `{docs-root}/.sync-watermark` with current codebase HEAD, branch name, and ISO 8601 timestamp. Format:
      ```
      # fp-docs sync watermark — do not edit manually
      # Records the codebase state that docs were last synced against.
      codebase_branch={branch}
      codebase_commit={full-SHA}
      sync_timestamp={ISO-8601}
      ```
   m. Commit watermark and any diff report to docs repo:
      Run: `node {plugin-root}/fp-tools.cjs git commit --message "fp-docs: sync -- {summary}"`
      Note: The CJS git commit handler automatically runs add, commit, and push for the docs repo.
      Skip if `--no-push` or `--offline`. Halt on push failure with diagnostics.
   n. Report sync results: branch state, changes detected (count and categories), diff report path (if generated), watermark state.

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

Sync report including:
- Branch state: codebase branch, docs branch, whether alignment was needed
- Remote sync status: fetch/pull results
- Change detection results: watermark state (new/current/stale/invalid), number of codebase commits since last sync, number of changed files
- Diff report: path to generated report file (if changes detected), or "no changes" message
- Watermark: updated state (commit hash short, timestamp)
- Commit/push status: whether changes were committed and pushed to docs remote
