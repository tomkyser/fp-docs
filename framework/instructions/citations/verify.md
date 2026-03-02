# Citations Verify — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path or scope
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-citations

## Steps

1. Parse scope from $ARGUMENTS.

2. Read the documentation file. Parse all `> **Citation**` blocks.

3. For each citation:
   a. Verify marker format matches: `> **Citation** · \`{file}\` · \`{symbol}\` · L{start}–{end}`
   b. Verify cited file path exists on disk (relative to theme root)
   c. Verify cited symbol exists in the cited file
   d. Classify: FORMAT (malformed), MISSING (should have citation), BROKEN (symbol not found), FRESH (all good)

4. Generate report with counts per classification.

## Output

Citation verification report. Read-only — do NOT modify files.
