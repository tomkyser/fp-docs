# Locals Validate — Instruction

## Inputs
- `$ARGUMENTS`: Component doc path or scope
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

### Phase A: CLI Setup

1. Run the setup script to install the ephemeral CLI tool:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-setup.sh"
   ```
   If setup fails, fall back to **Phase A-Fallback** below.

### Phase B: CLI Validation (Ground Truth)

2. Parse scope from $ARGUMENTS.

3. Run CLI validation against the component PHP files:
   ```bash
   ddev wp fp-locals validate "<file_or_dir>" --recursive
   ```
   This compares `@locals` PHPDoc blocks against actual token-extracted code usage and reports:
   - Documented-but-unused keys
   - Undocumented keys (accessed in code but not in @locals block)
   - Type mismatches between @locals declaration and code-inferred type

4. Run CLI extraction to get authoritative contract data:
   ```bash
   ddev wp fp-locals extract "<file_or_dir>" --recursive --format=json
   ```

5. For each component doc in scope:
   a. Read the component doc's Locals Contracts section
   b. Compare each documented key against the CLI-extracted ground truth:
      - Verify the key exists in the CLI extraction output
      - Verify the type matches
      - Verify Required/Optional classification matches
      - Verify the default value matches
   c. Check for undocumented keys (keys in CLI output but not in doc contract)

6. Cross-reference validation:
   a. Every shape reference in a component doc must resolve to a shape in `_locals-shapes.md`
   b. Every key in a contract table must exist in the CLI extraction output
   c. Required/Optional classification must match the access pattern in code

7. Generate validation report.

### Phase C: CLI Teardown (MANDATORY)

8. **CRITICAL**: Run teardown even if earlier steps failed:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-teardown.sh"
   ```

---

## Phase A-Fallback: Manual Validation (No CLI)

If the CLI setup fails:

1. Report: "CLI tool unavailable — falling back to manual validation. Results may be less accurate."

2. For each component doc in scope:
   a. Read the doc's Locals Contracts section
   b. Read the corresponding component PHP file(s) with the Read tool
   c. For each documented key: manually verify existence, type, Required/Optional, and default value against the PHP source
   d. Check for undocumented keys by scanning for `$locals[` patterns in the PHP source

3. Continue with step 6 above for cross-reference validation.

---

## Output

Validation report per component. Read-only — do NOT modify files. Include extraction method (CLI or manual fallback).
