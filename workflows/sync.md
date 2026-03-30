<purpose>
Sync branches and verify remote state across the three-repo git model.
Handles default sync (remote fetch, branch alignment, change detection, watermark)
and merge mode (merge feature branch into docs master).
Admin operation -- no pipeline (but may commit watermark/diff report to docs repo).
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
Read `${CLAUDE_PLUGIN_ROOT}/references/git-sync-rules.md` for the full sync flow.
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
6. Read watermark at `{docs-root}/.sync-watermark`
7. Compare watermark commit against current codebase HEAD
8. If changes: compute diff, filter to theme scope, map to docs via source-map
9. Write diff report to `docs/diffs/{date}_{branch}_diff_report.md`
10. Update watermark with current codebase HEAD
11. Commit watermark and diff report: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" git commit --message "fp-docs: sync -- {summary}"`
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
</success_criteria>
