# Citations Generate — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path, --section NN, or --all
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-citations

## Steps

1. Parse scope from $ARGUMENTS. If no arguments: error — must specify path or --all.

2. Read the target documentation file. Identify every documentable element (functions, hooks, meta fields, shortcodes, REST routes, CPT/taxonomy registrations).

3. Find corresponding source files using the project module mapping.

4. Read source files. For each documentable element, locate the matching code.

5. Determine citation tier per the citations module:
   - Count source element lines
   - ≤15 lines: Full tier (complete code excerpt)
   - 16-100 lines: Signature tier (signature + summary)
   - >100 lines: Reference tier (marker only)

6. Generate citation blocks per the citations module format.

7. Insert citations at correct positions: after function heading + description, after/below tables, after hook sections.

8. For unmatched elements: add `[NEEDS INVESTIGATION]` — do NOT generate fake citations.

9. Verify format of all inserted citations.

## Pipeline Trigger

After citations are generated:
4. Read `framework/modules/validation-rules.md` → run sanity-check
5. Read `framework/modules/validation-rules.md` → run verification
6. Follow changelog rules from the docs-mod-changelog module → append changelog entry
7. Follow index rules from the docs-mod-index module → update index if structural changes

## Output

Report: file modified, citation counts by tier, unmatched elements, elements skipped per scope rules.
