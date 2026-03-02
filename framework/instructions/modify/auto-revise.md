# Auto-Revise — Instruction

## Inputs
- `$ARGUMENTS`: Optional flags (--item N, --range N-M, --dry-run)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-pipeline

## Steps

1. Read `docs/needs-revision-tracker.md`. Parse all items listed under the Pending section.

2. If Pending section is empty: report "No items pending revision" and exit.

3. Select items based on $ARGUMENTS:
   - No flags: select ALL pending items
   - --item N: select the Nth pending item (1-based)
   - --item "name": select item matching heading (case-insensitive)
   - --range N-M: select items N through M inclusive

4. For each selected item: execute the revise instruction (`framework/instructions/modify/revise.md`) treating the tracker entry description as the revision request. Each revise execution includes its own scope manifest and pipeline.

5. Update the tracker:
   - Move successfully revised items from Pending to Completed with completion date
   - Leave failed items in Pending with failure note

## Pipeline Trigger

Pipeline runs per-item during the revise execution in step 4. After all items:
1. Run final 10-point verification covering all changes
2. Append single changelog entry listing all files modified

## Output

Report: selection summary, items successfully revised, items failed with reasons, verification result, remaining pending items.
