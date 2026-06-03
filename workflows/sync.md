<purpose>
Sync branches and verify remote state across the three-repo git model.
Handles default sync (remote fetch, branch alignment, change detection, watermark)
and merge mode (merge feature branch into docs master).
Admin operation -- no pipeline (but may commit watermark/diff report to docs repo).
</purpose>

<required_reading>
DO NOT read reference files yourself. Each step below specifies which files
its specialist agent will read via files_to_read. You are a dispatcher — pass
arguments and results between steps, nothing more.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op sync "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse flags: `merge`, `--force`, `--no-push`, `--offline`
</step>

<step name="default-sync" condition="no-merge-arg">
## 2. Default Sync

**Phase 1 -- Remote sync** (skip if `--offline`):
1. Verify remote accessible: `timeout 10 git -C {docs-root} ls-remote --exit-code origin HEAD`
2. Fetch: `git -C {docs-root} fetch origin`

**Phase 2 -- Branch alignment:**
3. Detect codebase branch and docs branch
4. If match: pull latest (`git -C {docs-root} pull --ff-only`)
5. If mismatch: check/create matching branch, switch, pull

**Phase 3 -- Change detection:**
6. Read watermark at `{docs-root}/.fp-docs-branch/.sync-watermark`
7. Compare watermark commit against current codebase HEAD
8. If changes: compute diff, filter to theme scope, map to docs via source-map
9. Write diff report to `.fp-docs-branch/diffs/{date}_{branch}_diff_report.md`
10. Update watermark with current codebase HEAD
11. Commit watermark and diff report: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" git commit --message "fp-docs: sync -- {summary}"`
</step>

<step name="merge-intelligence" condition="codebase-on-master-and-no-merge-arg">
## 2.5. Merge Intelligence

After default sync completes, check if recently merged codebase branches have matching docs branches.

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" merge-intel scan`
2. Parse result JSON
3. If `scanned: false` (not on master): skip this step
4. For each `auto_merge` candidate (docs are current):
   a. Display: "Auto-merging docs from {branch} (docs are current)"
   b. Merge via merge-intel module: `node -e "require('${CLAUDE_PLUGIN_ROOT}/lib/merge-intel.cjs').executeMerge('{docs-root}', '{branch}')"`
   c. Record decision: `node -e "require('${CLAUDE_PLUGIN_ROOT}/lib/merge-intel.cjs').recordDecision('{branch}', 'merged', false)"`
5. For each `needs_review` candidate (docs are stale):
   a. Display: "⚠ {branch}: docs last updated {date}, codebase had {N} commits after. Merge anyway? [y/n/inspect]"
   b. If user approves: merge and record as merged (stale)
   c. If user skips: record as skipped
   d. If user inspects: show diff summary via `git -C {docs-root} log --oneline master..{branch}`, re-prompt
6. Report summary: "Merged {N} branches, {M} deferred, {K} skipped"
</step>

<step name="merge-sync" condition="merge-arg">
## 3. Merge Mode

1. Verify current docs branch is NOT master
2. Fetch and pull latest on both branches (skip if `--offline`)
3. Switch to docs master
4. Merge feature branch into master
5. Push docs master (skip if `--no-push` or `--offline`)
6. Delete merged feature branch (local)
</step>

</process>

<success_criteria>
- [ ] Remote accessibility verified (or offline mode acknowledged)
- [ ] Branch alignment confirmed
- [ ] Change detection completed with watermark update
- [ ] Diff report generated (if changes detected)
- [ ] Merge completed cleanly (if merge mode)
- [ ] Merge intelligence scan completed (if on master, no merge arg)
- [ ] Auto-merge candidates processed, stale candidates flagged for user review
</success_criteria>
