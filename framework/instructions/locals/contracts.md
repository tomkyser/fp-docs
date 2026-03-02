# Locals Contracts — Instruction

## Inputs
- `$ARGUMENTS`: Component doc path or section scope
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. Parse scope from $ARGUMENTS.

2. For each component doc in scope: read the doc and the corresponding component PHP files.

3. For each component PHP file: extract $locals keys, types, required/optional, defaults using the grammar from `framework/modules/locals-contract-grammar.md`.

4. Generate or update the `## Locals Contracts` section in the doc with a subsection per component file containing the key/type/req/default/description table.

5. Add Shape references where keys match shared shapes in `_locals-shapes.md`.

6. Generate or update the `## Data Flow` section showing caller→callee relationships.

## Pipeline Trigger

Same as locals/annotate.md (stages 1, 2, 4-7).

## Output

Report: docs updated, contracts generated per component file, shape references added.
