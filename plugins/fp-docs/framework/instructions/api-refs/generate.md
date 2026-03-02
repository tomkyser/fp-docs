# API Reference Generate — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path, --layer name, or --all
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-api-refs

## Steps

1. Parse scope. If doc type not listed as requiring API Reference per system-config: report and skip.

2. Read the documentation file. Identify source file via `## Source File` header.

3. Build scope manifest: count all public functions/methods in source file. This becomes the binding target for table rows.

4. Read source file. Extract every public function/method:
   - For PHP namespaced helpers: every function in the namespace
   - For PHP classes: every public method (protected only for abstract classes)
   - For JavaScript: every exported function + key event handlers

5. For each function, extract: name, parameters, return type, description (one-liner, present tense), provenance (PHPDoc if docblock exists, Verified if authored from source reading).

6. Generate the API Reference section:
   ```
   ## API Reference
   > **Ref Source** · Per-row provenance in `Src` column
   | Function | Params | Return | Description | Src |
   ```
   Rows ordered by source file line number.

7. Insert before `## Related Docs`, or update existing section (add new rows, remove deleted, update changed).

8. Verify row count matches scope manifest function count.

## Pipeline Trigger

1. Read `framework/modules/verbosity-rules.md` → enforce against scope manifest
2. Read `framework/modules/citation-rules.md` → generate citations for API ref entries
4. Read `framework/modules/validation-rules.md` → sanity-check
5. Read `framework/modules/validation-rules.md` → verify
6. Read `framework/modules/changelog-rules.md` → changelog
7. Read `framework/modules/index-rules.md` → index if needed

## Output

Report: file modified, function count, provenance breakdown, any functions with 4+ params using shorthand.
