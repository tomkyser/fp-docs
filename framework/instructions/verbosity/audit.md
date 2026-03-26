# Verbosity Audit — Instruction

## Inputs
- `$ARGUMENTS`: --depth quick|standard|deep [scope]
- Preloaded modules: mod-standards, mod-project, mod-verbosity

## Steps

1. Parse depth and scope from $ARGUMENTS.

2. For each doc in scope:
   a. Identify source file(s) via the project module mapping
   b. Count public functions/methods in source
   c. Count documented items in doc (API Reference rows, function descriptions)
   d. Calculate gap: (source count - doc count) / source count

3. Scan each doc for banned summarization phrases from the verbosity module.

4. Detect unexpanded enumerables: find arrays, switch statements, if/elseif chains in source that should be enumerated in docs but use vague language instead.

5. Classify findings:
   - MISSING: source items not documented
   - SUMMARIZED: banned phrase detected
   - UNEXPANDED: enumerable not fully expanded
   - Severity: low (<5% gap), medium (5-10%), high (>10%)

6. Generate verbosity audit report.

## Output

Verbosity audit report with gaps, banned phrases, unexpanded enumerables. Read-only — do NOT modify files.
