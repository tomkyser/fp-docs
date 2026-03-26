# Sanity Check — Instruction

## Inputs
- `$ARGUMENTS`: Scope (file path or section)
- Preloaded modules: mod-standards, mod-project, mod-validation

## Steps

1. Identify the documentation files to check from $ARGUMENTS.

2. For each doc, find the corresponding source file(s) via the project module mapping.

3. Cross-reference every factual claim against source code:
   - Function signatures, hook names/priorities, file paths, meta keys
   - REST routes, shortcode attributes, defaults, constants
   - Classify each: VERIFIED, MISMATCH, HALLUCINATION, UNVERIFIABLE

4. For UNVERIFIABLE claims: trace call chains, check related files, search codebase. Reclassify as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED.

5. Cross-reference related docs for contradictions.

6. Assess complexity: if >5 docs or >3 sections affected, note multi-agent recommendation.

7. Generate sanity check report with confidence level (HIGH/LOW).

8. **Recommend Remediation Commands**

   For each MISMATCH or HALLUCINATION finding, recommend the specific `/fp-docs:` command:

   | Finding Type | Recommended Command |
   |-------------|---------------------|
   | MISMATCH (function signature) | `/fp-docs:revise` |
   | MISMATCH (hook name/priority) | `/fp-docs:revise` |
   | MISMATCH (file path) | `/fp-docs:revise` |
   | MISMATCH (citation line range) | `/fp-docs:citations update` |
   | HALLUCINATION (non-existent function) | `/fp-docs:revise` |
   | HALLUCINATION (non-existent file) | `/fp-docs:revise` |

   Apply LLM judgment: if the issue is only a stale citation, recommend `/fp-docs:citations update`. If the underlying content is wrong, recommend `/fp-docs:revise`.

   If confidence is LOW, append:
   ```
   ### Remediation
   - {N} mismatches, {M} hallucinations found
   - Recommended: {list of commands}
   - Run `/fp-docs:remediate` after running `/fp-docs:audit --depth deep` for comprehensive remediation.
   ```

## Output

Sanity Check Report with scope, issues, confidence, remediation commands, and required actions. Read-only -- do NOT modify files.
