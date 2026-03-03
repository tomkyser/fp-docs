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

## Output

Sanity Check Report with scope, issues, confidence, required actions. Read-only — do NOT modify files.
