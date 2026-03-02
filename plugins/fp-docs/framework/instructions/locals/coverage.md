# Locals Coverage — Instruction

## Inputs
- `$ARGUMENTS`: Scope (--all or specific section)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-locals

## Steps

1. List all `.php` files in `components/` directories.

2. For each component directory that has a doc in `docs/05-components/`:
   a. Read the doc's Locals Contracts section
   b. List all PHP files in the corresponding component directory
   c. Check which PHP files have contract entries and which are missing

3. Calculate coverage: (files with contracts / total files) * 100.

4. Generate coverage report:
   - Total component files
   - Files with contracts documented
   - Files missing contracts (listed)
   - Coverage percentage
   - Files using integer-indexed $locals
   - Files with no $locals access

## Output

Coverage report. Read-only — do NOT modify files.
