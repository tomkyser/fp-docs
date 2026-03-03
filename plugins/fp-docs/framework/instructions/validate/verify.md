# Verify — Instruction

## Inputs
- `$ARGUMENTS`: Optional scope (file path or section)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-validation

## Steps

1. Run all 10 verification checks from `framework/algorithms/validation-algorithm.md`:
   - Check 1: File Existence
   - Check 2: Orphan Check
   - Check 3: Index Completeness
   - Check 4: Appendix Spot-Check (SKIP if standalone)
   - Check 5: Link Validation
   - Check 6: Changelog Check (SKIP if standalone)
   - Check 7: Citation Format Validation
   - Check 8: API Reference Provenance Validation
   - Check 9: Locals Contracts Completeness
   - Check 10: Verbosity Compliance

2. If $ARGUMENTS specifies a scope, limit checks to those files.

3. Report each check individually as PASS, FAIL, or SKIP with details.

4. Give overall PASS or FAIL.

## Output

Verification Report. Read-only operation — do NOT modify any files.
