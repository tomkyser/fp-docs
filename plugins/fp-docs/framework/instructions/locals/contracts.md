# Locals Contracts — Instruction

## Inputs
- `$ARGUMENTS`: Component doc path or section scope
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

### Phase A: CLI Setup

1. Run the setup script to install the ephemeral CLI tool:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-setup.sh"
   ```
   If setup fails, fall back to **Phase A-Fallback** below.

### Phase B: CLI Extraction (Ground Truth)

2. Parse scope from $ARGUMENTS. Identify the component directory/directories.

3. For each component directory in scope, run CLI extraction:
   ```bash
   ddev wp fp-locals extract "components/<dir>/" --recursive --format=json
   ```
   Parse the JSON output. This is the authoritative source for all $locals contract data.

### Phase C: Generate Contracts

4. For each component doc in scope: read the doc and use the CLI-extracted data for the corresponding component PHP files.

5. Generate or update the `## Locals Contracts` section using the grammar from mod-locals:
   - Create a subsection per component PHP file
   - Table columns: Key | Type | Req? | Default | Description
   - Use CLI data for Key, Type, Req?, and Default values
   - Write descriptions based on key names, usage context, and any existing descriptions

6. Add Shape references where keys match shared shapes in `_locals-shapes.md`.

7. Generate or update the `## Data Flow` section. For authoritative caller data, run:
   ```bash
   ddev wp fp-locals cross-ref "components/<dir>/" --recursive
   ```
   Parse the output to build caller→callee relationship tables.

8. If the doc already has `## Locals Contracts` or `## Data Flow` sections, replace them entirely with the regenerated versions.

### Phase D: CLI Teardown (MANDATORY)

9. **CRITICAL**: Run teardown even if earlier steps failed:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-teardown.sh"
   ```

---

## Phase A-Fallback: Manual Extraction (No CLI)

If the CLI setup fails:

1. Report: "CLI tool unavailable — falling back to manual extraction."

2. For each component PHP file: read the source with the Read tool, scan for `$locals` access patterns using mod-locals classification rules.

3. For Data Flow: search for `get_template_part()` calls that reference the component slug using Grep. This is less reliable than CLI cross-ref but provides partial data.

4. Continue with Phase C above using manually extracted data.

---

## Pipeline Trigger

Same as locals/annotate.md (stages 1, 2, 4-7).

## Output

Report: docs updated, contracts generated per component file, shape references added, extraction method (CLI or manual fallback).
