# Add — Instruction

## Inputs
- `$ARGUMENTS`: Description of new code that needs documentation
- Preloaded modules: mod-standards, mod-project, mod-pipeline

## Steps

1. Parse the user's request. Identify what new code was added (file paths, system type — post type, helper, shortcode, etc.) and which docs section it belongs in (using the source-to-documentation mapping from the project module).

2. Read PROJECT-INDEX.md at `docs/claude-code-docs-system/PROJECT-INDEX.md` to discover existing files in the target source directory and related modules.

3. Find an existing sibling doc in the same docs section. Read it to understand the exact format template in use.

4. Read the new source code file(s). Every detail in the documentation must come from actual source code.

5. Build a scope manifest: read `framework/algorithms/verbosity-algorithm.md`. Count documentable items and establish binding targets.

6. Create the documentation file at the correct path:
   - Follow the format template from the sibling doc and the standards module.
   - Meet all depth requirements.
   - Use `[NEEDS INVESTIGATION]` for anything unclear — never fabricate.

7. If the doc type requires API Reference: generate the API Reference section per `framework/algorithms/api-ref-algorithm.md`.

8. Update links: add the new doc to the parent `_index.md` and `About.md` if it's a new section.

## Pipeline Trigger

Execute the post-modification pipeline:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce verbosity against scope manifest
2. Read `framework/algorithms/citation-algorithm.md` → generate citations for new doc
3. Read `framework/algorithms/api-ref-algorithm.md` → verify API reference completeness
4. Read `framework/algorithms/validation-algorithm.md` → run sanity-check
5. Read `framework/algorithms/validation-algorithm.md` → run 10-point verification
6. Follow changelog rules from the mod-changelog module → append changelog entry
7. Follow index rules from the mod-index module → update PROJECT-INDEX (structural change)

## Output

Report: every file created and modified with summary, sanity check result, verification result, any items needing manual attention.
