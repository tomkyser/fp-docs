# Locals Annotate — Instruction

## Inputs
- `$ARGUMENTS`: Component directory or file path
- Preloaded modules: mod-standards, mod-project, mod-locals

## Steps

### Phase A: CLI Setup

1. Install the ephemeral CLI tool:
   Run: `node {plugin-root}/fp-tools.cjs locals-cli setup`
   If CJS setup unavailable (ddev not running, path resolution error), fall back to **Phase A-Fallback** below.

### Phase B: CLI Extraction (Ground Truth)

2. Run the WP-CLI extraction tool to get authoritative contract data:
   ```bash
   ddev wp fp-locals extract "<file_or_dir>" --format=json --recursive
   ```
   For `--all` scope:
   ```bash
   ddev wp fp-locals extract "components/" --recursive --format=json
   ```
   Parse the JSON output. This is the ground-truth source — `token_get_all()` achieves 100% extraction accuracy.

### Phase C: Annotate

3. For each component PHP file in the CLI output:

   a. Read the target file. Check if a `@locals { ... }` PHPDoc block already exists.

   b. **If no block exists**: Generate a new `@locals` block from CLI data using the format from mod-locals.

   c. **If a block exists**: Merge — preserve any human-authored descriptions from the existing block, update keys/types/required from CLI data. CLI data takes priority for key names, types, and Required/Optional classification.

4. Generate the `@locals` PHPDoc block per mod-locals format rules:
   ```php
   <?php
   /**
    * [existing file-level comment if present]
    *
    * @locals {
    *   key_name:  type  — Required|Optional. Description. [Default: value.]
    * }
    */
   ```
   For HTMX components (`components/htmx/`), use the `@controller`/`@state`/`@methods` format per mod-locals.

5. Insert the annotation:
   - If the file has a file-level PHPDoc comment (`/** ... */` before any code), insert `@locals` inside it.
   - If no file-level comment exists, add one after the opening `<?php` tag.
   - Do NOT modify any code — only add/update the PHPDoc block.

### Phase D: Validate

6. Run CLI validation to confirm annotations match actual usage:
   ```bash
   ddev wp fp-locals validate "<file_or_dir>" --recursive
   ```
   Report any discrepancies.

### Phase E: CLI Teardown (MANDATORY)

7. **CRITICAL**: Run teardown even if earlier steps failed:
   Run: `node {plugin-root}/fp-tools.cjs locals-cli teardown`
   The CLI file and functions.php registration must NOT persist after this operation.

---

## Phase A-Fallback: Manual Extraction (No CLI)

If CJS setup unavailable (ddev unavailable, path error, WP environment broken):

1. Report to the user: "CLI tool unavailable — falling back to manual extraction. Results may be less accurate."

2. For each component PHP file: read the source with the Read tool and scan for `$locals` access patterns using the classification rules from mod-locals:
   - `$locals['key']` bare access → Required
   - `$locals['key'] ?? default` → Optional
   - `isset($locals['key'])` / `!empty($locals['key'])` → Optional

3. Classify each key as Required or Optional. Infer types from wrapping functions (esc_url→string, intval→int, etc.), cast operators, and default values.

4. Continue with Phase C above using the manually extracted data.

---

## Pipeline Trigger

After annotating:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce completeness
2. Read `framework/algorithms/citation-algorithm.md` → update citations
4-7. Sanity-check, verify, changelog, index

## Output

Report: files annotated, keys discovered per file, Required vs Optional counts, extraction method (CLI or manual fallback).
