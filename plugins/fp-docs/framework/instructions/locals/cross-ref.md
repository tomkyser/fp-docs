# Locals Cross-Reference — Instruction

## Inputs
- `$ARGUMENTS`: Scope (component docs or all)
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

### Phase A: CLI Setup

1. Run the setup script to install the ephemeral CLI tool:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-setup.sh"
   ```
   If setup fails, fall back to **Phase A-Fallback** below.

### Phase B: CLI Cross-Reference (Ground Truth)

2. Parse scope from $ARGUMENTS.

3. For each component in scope, run CLI cross-reference:
   ```bash
   ddev wp fp-locals cross-ref "components/<dir>/" --recursive
   ```
   This tokenizes the **entire theme** to find every `get_template_part()` call that loads the component, then compares:
   - Keys passed by each caller vs keys consumed by the component
   - Missing required keys (caller doesn't pass, component requires)
   - Extra keys (caller passes, component doesn't use)

   The CLI handles all FP calling conventions:
   - `\ForeignPolicy\Helpers\Templates\get_template_part()`
   - `foreignpolicy_get_template_part()`
   - Standard `get_template_part()`
   - Template slug splitting (e.g., `components/post/excerpt-content--date`)

4. For each component doc in scope: read the Locals Contracts and Data Flow sections.

5. Cross-validate:
   a. Every caller listed in Data Flow must appear in CLI cross-ref output
   b. Every caller in CLI output should be listed in Data Flow
   c. Keys passed by each caller (from CLI) must match what Data Flow documents
   d. Required keys not passed by any caller → flag as data flow gap
   e. Every shape reference must resolve to `_locals-shapes.md`

6. Generate cross-reference report.

### Phase C: CLI Teardown (MANDATORY)

7. **CRITICAL**: Run teardown even if earlier steps failed:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-teardown.sh"
   ```

---

## Phase A-Fallback: Manual Cross-Reference (No CLI)

If the CLI setup fails:

1. Report: "CLI tool unavailable — falling back to manual cross-reference. Caller detection will be limited."

2. For each component doc in scope: read the Locals Contracts and Data Flow sections.

3. Use Grep to search for `get_template_part` calls referencing the component slug across the theme. This is significantly less reliable than CLI tokenization — it cannot parse argument lists or detect FP-specific calling conventions as accurately.

4. Continue with step 5 above for cross-validation.

---

## Output

Cross-reference validation report. Read-only — do NOT modify files. Include extraction method (CLI or manual fallback).
