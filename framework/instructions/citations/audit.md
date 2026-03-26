# Citations Audit — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path or scope
- Preloaded modules: mod-standards, mod-project, mod-citations

## Steps

1. Parse scope from $ARGUMENTS.

2. Read the documentation file and all its citations.

3. For each citation, perform deep semantic accuracy check:
   a. Read the cited source location
   b. Compare the citation excerpt against current source (verbatim comparison)
   c. Compare the prose adjacent to the citation against the cited code
   d. Verify the documented behavior matches what the code actually does

4. Classify each citation:
   - ACCURATE: excerpt matches, prose matches behavior
   - STALE: excerpt outdated but prose still correct
   - INACCURATE: prose describes behavior differently from code
   - BROKEN: cited symbol no longer exists

5. Check citation coverage: identify documentable elements that lack citations.

6. Generate deep audit report.

## Output

Citation audit report with accuracy, staleness, and coverage metrics. Read-only — do NOT modify files.
