# Locals Coverage — Instruction

## Inputs
- `$ARGUMENTS`: Scope (--all or specific section)
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

### Phase A: CLI Setup

1. Run the setup script to install the ephemeral CLI tool:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-setup.sh"
   ```
   If setup fails, fall back to **Phase A-Fallback** below.

### Phase B: CLI Coverage Report (Ground Truth)

2. Run the CLI coverage command:
   ```bash
   ddev wp fp-locals coverage --format=json
   ```
   This scans all PHP files under `components/`, groups by directory, and reports:
   - Total files per directory
   - Files that use `$locals`
   - Files that have `@locals` PHPDoc blocks
   - Files missing `@locals` blocks
   - Coverage percentage per directory and overall

3. Parse the JSON output for the ground-truth coverage data.

### Phase C: Cross-Check Documentation

4. For each component directory that has a doc in `docs/05-components/`:
   a. Read the doc's Locals Contracts section
   b. Compare which PHP files have contract entries in the doc vs which are listed in CLI coverage output
   c. A file has "full coverage" only when it has BOTH:
      - An `@locals` PHPDoc block in the PHP source (from CLI coverage)
      - A contract entry in the component doc (from doc inspection)

5. Generate comprehensive coverage report:
   - Per-directory breakdown from CLI data
   - Inline annotation coverage (@locals blocks in PHP files)
   - Documentation coverage (contract entries in component docs)
   - Combined coverage (both annotation AND doc entry)
   - Files using `$locals` but missing both
   - Files using integer-indexed `$locals` (e.g., `$locals[0]`)
   - Files with no `$locals` access at all
   - Highlight directories with 0% coverage

### Phase D: CLI Teardown (MANDATORY)

6. **CRITICAL**: Run teardown even if earlier steps failed:
   ```bash
   bash "{plugin-root}/scripts/locals-cli-teardown.sh"
   ```

---

## Phase A-Fallback: Manual Coverage (No CLI)

If the CLI setup fails:

1. Report: "CLI tool unavailable — falling back to manual coverage scan."

2. List all `.php` files in `components/` directories using Glob.

3. For each file: read with the Read tool and check for `$locals` usage (string search for `$locals[`) and `@locals` PHPDoc presence (regex for `@locals\s*\{`).

4. Continue with Phase C above using manually gathered data.

---

## Output

Coverage report. Read-only — do NOT modify files. Include extraction method (CLI or manual fallback).
