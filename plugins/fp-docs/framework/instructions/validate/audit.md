# Audit — Instruction

## Inputs
- `$ARGUMENTS`: --depth quick|standard|deep [--section NN]
- Preloaded modules: mod-standards, mod-project, mod-validation

## Steps

1. Parse depth flag from $ARGUMENTS. Default to `standard` if not specified.

2. For `quick` depth:
   a. Read PROJECT-INDEX.md for source file inventory.
   b. Read `docs/About.md`. Verify every linked doc file exists on disk.
   c. Cross-reference source-to-doc mapping. Identify MISSING (source exists, no doc) and ORPHAN (doc exists, no source).
   d. Validate all relative markdown links.

3. For `standard` depth (includes quick):
   a. Run git log for last 30 days to find changed source files.
   b. Filter to documentation-relevant files using the project module mapping.
   c. For each changed file with a doc: read both, compare, flag discrepancies.

4. For `deep` depth (includes standard):
   a. For EVERY doc file (or docs in --section): read doc and source, compare all claims.
   b. Check citation coverage and health.

5. Generate audit report with categories: MISSING, STALE, BROKEN, ORPHAN, CITATION COVERAGE, CITATION HEALTH. Include summary counts and recommended actions.

## Output

Audit report. Read-only operation — do NOT modify any files.
