# Locals Annotate — Instruction

## Inputs
- `$ARGUMENTS`: Component directory or file path
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

1. Parse scope from $ARGUMENTS. Identify target component files.

2. For each component PHP file: scan for `$locals` access patterns using the patterns from the locals module.

3. Classify each key as Required or Optional based on access pattern.

4. Generate `@locals` PHPDoc block for each component file that lacks one.

5. Insert the annotation at the top of the PHP file, after the opening `<?php` tag.

## Pipeline Trigger

After annotating:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce completeness
2. Read `framework/algorithms/citation-algorithm.md` → update citations
4-7. Sanity-check, verify, changelog, index

## Output

Report: files annotated, keys discovered per file, Required vs Optional counts.
