# Locals Shapes — Instruction

## Inputs
- `$ARGUMENTS`: Shape name or --all
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. Read `docs/05-components/_locals-shapes.md`.

2. If --all: analyze all component contracts to discover shared patterns. Identify groups of components that share the same key sets.

3. For each identified shape (or the shape named in $ARGUMENTS):
   a. Read all component docs that reference this shape
   b. Verify the shape definition matches the actual keys used
   c. Update the shape definition if keys have changed

4. Generate or update shape entries in `_locals-shapes.md`.

## Pipeline Trigger

Same as locals/annotate.md (stages 1, 2, 4-7).

## Output

Report: shapes updated, components referencing each shape.
