# Locals Cross-Reference — Instruction

## Inputs
- `$ARGUMENTS`: Scope (component docs or all)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. Parse scope from $ARGUMENTS.

2. For each component doc in scope: read the Locals Contracts and Data Flow sections.

3. For each caller/callee relationship in Data Flow:
   a. Verify the referenced file exists
   b. Verify the keys passed match what the target component expects
   c. Flag mismatches (keys passed that target doesn't use, required keys not passed)

4. Validate shape references: verify each shape referenced in contracts exists in `_locals-shapes.md`.

5. Generate cross-reference report.

## Output

Cross-reference validation report. Read-only — do NOT modify files.
