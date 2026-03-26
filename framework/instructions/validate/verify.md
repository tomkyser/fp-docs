# Verify — Instruction

## Inputs
- `$ARGUMENTS`: Optional scope (file path or section)
- Preloaded modules: mod-standards, mod-project, mod-validation

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

5. **Recommend Remediation Commands**

   For each FAIL check, recommend the specific `/fp-docs:` command to fix it:

   | Failed Check | Recommended Command |
   |-------------|---------------------|
   | Check 1 (File Existence) | N/A -- file missing entirely |
   | Check 2 (Orphan Check) | `/fp-docs:deprecate` or `/fp-docs:add` (create matching source) |
   | Check 3 (Index Completeness) | `/fp-docs:update-index` |
   | Check 5 (Link Validation) | `/fp-docs:revise` |
   | Check 6 (Changelog Check) | Manual -- changelog updated by pipeline |
   | Check 7 (Citation Format) | `/fp-docs:citations generate` or `/fp-docs:citations update` |
   | Check 8 (API Reference) | `/fp-docs:api-ref` |
   | Check 9 (Locals Contracts) | `/fp-docs:locals` |
   | Check 10 (Verbosity) | `/fp-docs:revise` (expand compressed content) |

   Use the same guidance table as a starting point, but apply judgment based on the specific failure.

   If any checks failed, append a brief Remediation Summary:
   ```
   ### Remediation
   - {N} checks failed
   - Recommended: {list of commands}
   - Run `/fp-docs:remediate` after running `/fp-docs:audit` for comprehensive remediation.
   ```

## Output

Verification Report with per-check command recommendations and remediation summary. Read-only operation -- do NOT modify any files.
