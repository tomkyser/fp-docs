<purpose>
Update PROJECT-INDEX.md and source-map.json to reflect current codebase state.
Supports two modes: incremental update (default) and full regeneration.
Write operation -- triggers pipeline.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op update-index "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse mode from `$ARGUMENTS`: `update` (default) or `full`.
</step>

<step name="incremental-update" condition="mode=update">
## 2a. Incremental Update (default)

1. Read existing `PROJECT-INDEX.md` in the docs root
2. Check changes since last update via `git log`
3. For each affected section: re-scan source directory, update entries
4. Update file statistics and Generated date
5. Write updated content
6. Reconcile source-map: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" source-map generate`
</step>

<step name="full-regeneration" condition="mode=full">
## 2b. Full Regeneration

1. Scan entire theme directory: `git ls-tree -r --name-only HEAD`
2. Regenerate all sections from scratch
3. Preserve existing Security Notes and Performance Notes
4. Record branch name in header
5. Write regenerated content
6. Regenerate source-map: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" source-map generate`
</step>

<step name="verify">
## 3. Verify Dual-Artifact Consistency

1. Confirm PROJECT-INDEX.md reflects current git-tracked file tree
2. Confirm source-map.json has entries for all documented source directories
3. Update the Generated date
</step>

<step name="pipeline">
## 4. Pipeline Enforcement

### Write Phase (Stages 1-2)
Run verbosity enforcement and citation updates.

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent for sanity-check and 10-point verification.

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 6  # changelog
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 7  # index (self-referential -- verify no infinite loop)
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 8  # docs commit
```
</step>

</process>

<success_criteria>
- [ ] Mode correctly identified (update or full)
- [ ] PROJECT-INDEX.md reflects current file tree
- [ ] source-map.json consistent with documented directories
- [ ] Generated date updated
- [ ] Pipeline stages completed
</success_criteria>
