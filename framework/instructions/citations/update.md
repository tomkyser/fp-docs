# Citations Update — Instruction

## Inputs
- `$ARGUMENTS`: Doc file path, --section NN, or --all
- Preloaded modules: mod-standards, mod-project, mod-citations

## Steps

1. Parse scope from $ARGUMENTS.

2. Read the documentation file. Parse all existing `> **Citation**` blocks. Extract file path, symbol name, line range, excerpt.

3. Read current source files for each unique cited file path.

4. Compare each citation against current source using the staleness detection algorithm from `framework/algorithms/citation-algorithm.md`:
   - Symbol lookup → if not found: Broken
   - Line range check → if different: Stale
   - Excerpt check → if different: Drifted, if same: Fresh

5. Update non-Fresh citations:
   - Stale: update line range only
   - Drifted: update line range AND regenerate excerpt
   - Broken: add `[NEEDS INVESTIGATION]` marker

6. Scan for missing citations (documentable elements without citation blocks). Generate new ones.

## Pipeline Trigger

Same as citations/generate.md (stages 4-7).

**Delegated mode note:** In delegated mode, this engine handles the citation-specific stages above. Stages 4-8 (validation, changelog, index, commit) are handled by the orchestrator via the CJS pipeline callback loop. Do NOT execute stages 4-8 yourself in delegated mode.

## Output

Report: citations updated (Stale/Drifted counts), citations broken, citations fresh, new citations generated.
