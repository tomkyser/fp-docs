# Audit — Instruction

## Inputs
- `$ARGUMENTS`: --depth quick|standard|deep [--section NN]
- Preloaded modules: mod-standards, mod-project, mod-validation

## Steps

1. Parse depth flag from $ARGUMENTS. Default to `standard` if not specified.

2. For `quick` depth:
   a. Read PROJECT-INDEX.md for source file inventory.
   b. Read `docs/About.md`. Verify every linked doc file exists on disk.
   c. Cross-reference source-to-doc mapping from `source-map.json` (use `fp-tools source-map` for lookups). Identify MISSING (source exists, no doc) and ORPHAN (doc exists, no source).
   d. Validate all relative markdown links.

3. For `standard` depth (includes quick):
   a. Run git log for last 30 days to find changed source files.
   b. Filter to documentation-relevant files using the project module mapping.
   c. For each changed file with a doc: read both, compare, flag discrepancies.

4. For `deep` depth (includes standard):
   a. For EVERY doc file (or docs in --section): read doc and source, compare all claims.
   b. Check citation coverage and health.

5. Generate audit report with categories: MISSING, STALE, BROKEN, ORPHAN, CITATION COVERAGE, CITATION HEALTH. Include summary counts and recommended actions.

6. **Recommend Remediation Commands** (per D-01)

   For each issue found in Steps 2-5, recommend the specific `/fp-docs:` command best suited to resolve it. Use LLM judgment based on the actual issue -- not a static lookup table.

   Guidance table (starting points, override with judgment):

   | Issue Category | Default Command | Override Conditions |
   |---------------|-----------------|---------------------|
   | MISSING | `/fp-docs:add` | -- |
   | STALE | `/fp-docs:revise` | If only citations stale: `/fp-docs:citations update` |
   | BROKEN (link) | `/fp-docs:revise` | If index link: `/fp-docs:update-index` |
   | ORPHAN | `/fp-docs:deprecate` | -- |
   | CITATION COVERAGE | `/fp-docs:citations generate` | -- |
   | CITATION HEALTH | `/fp-docs:citations update` | If source function changed: `/fp-docs:revise` first |

   For each issue in the report, append the recommended command:
   ```
   - {file}:{line} -- {description} --> `/fp-docs:{command}`
   ```

7. **Generate Remediation Summary** (per D-02)

   Append a Remediation Summary section at the end of the audit report:

   ```
   ## Remediation Summary

   **Issues found:** {total count}

   ### By Command
   - `/fp-docs:revise`: {file1}, {file2} ({N} issues)
   - `/fp-docs:citations generate`: {file3} ({N} issues)
   - `/fp-docs:add`: {file4} ({N} issues)
   ...

   ### Execution Order
   Issues should be resolved in this order to prevent cascading re-work:
   1. **Tier 1 (accuracy):** HALLUCINATION, STALE content -- fix source docs first
   2. **Tier 2 (enrichment):** CITATION COVERAGE, CITATION HEALTH -- after content is accurate
   3. **Tier 3 (structural):** MISSING, BROKEN, ORPHAN -- after content is enriched

   Within each tier, fix files that other docs depend on first (source docs before cross-referenced docs).

   ### Quick Fix
   Run `/fp-docs:remediate` to resolve all {N} issues in one orchestrated batch.
   Run `/fp-docs:remediate --plan-only` to save a plan, `/clear`, then execute later.
   ```

## Output

Audit report with per-issue command recommendations and Remediation Summary. Read-only operation -- do NOT modify any files.
