# Locals Annotate — Instruction

## Inputs
- `$ARGUMENTS`: Component directory or file path
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. Parse scope from $ARGUMENTS. Identify target component files.

2. For each component PHP file: scan for `$locals` access patterns using the patterns from the locals module.

3. Classify each key as Required or Optional based on access pattern.

4. Generate `@locals` PHPDoc block for each component file that lacks one.

5. Insert the annotation at the top of the PHP file, after the opening `<?php` tag.

## Pipeline Trigger

After annotating:
1. Read `framework/modules/verbosity-rules.md` → enforce completeness
2. Read `framework/modules/citation-rules.md` → update citations
4-7. Sanity-check, verify, changelog, index

## Output

Report: files annotated, keys discovered per file, Required vs Optional counts.
