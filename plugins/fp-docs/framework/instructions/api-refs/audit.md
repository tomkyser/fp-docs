# API Reference Audit — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path or --layer name
- Preloaded modules: mod-standards, mod-project, mod-api-refs

## Steps

1. Read the documentation file. Find the `## API Reference` section.

2. If no API Reference section and doc type requires one: report MISSING.

3. Parse the API reference table rows.

4. Read the corresponding source file. Extract all public functions/methods.

5. Compare:
   - Functions in source not in table: MISSING
   - Functions in table not in source: ORPHAN (code removed)
   - Functions with different signatures: STALE
   - Functions with PHPDoc provenance: verify PHPDoc matches actual behavior

6. Check Ref Source legend presence.

7. Check all Src column values are valid (PHPDoc, Verified, or Authored).

8. Generate audit report.

## Output

API Reference audit report. Read-only — do NOT modify files.
