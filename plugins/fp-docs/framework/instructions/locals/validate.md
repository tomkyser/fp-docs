# Locals Validate — Instruction

## Inputs
- `$ARGUMENTS`: Component doc path or scope
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. Parse scope. For each component doc in scope:

2. Read the component doc's Locals Contracts section.

3. Read the corresponding component PHP file(s).

4. For each key documented in the contract:
   a. Verify the key exists in the PHP file's $locals access
   b. Verify the type matches the actual usage
   c. Verify Required/Optional classification matches the access pattern
   d. Verify the default value matches the fallback in code

5. Check for undocumented keys (keys accessed in PHP but not in contract).

6. Generate validation report.

## Output

Validation report per component. Read-only — do NOT modify files.
