# Add — Instruction

## Inputs
- `$ARGUMENTS`: Description of new code that needs documentation
- Preloaded modules: mod-standards, mod-project, mod-pipeline

## Steps

1. Parse the user's request. Identify what new code was added (file paths, system type — post type, helper, shortcode, etc.) and which docs section it belongs in (using the source-to-doc mapping from `source-map.json` (query via `fp-tools source-map lookup <source-path>`, or see mod-project for examples)). If the user included the `--visual` flag, visual verification will be performed after the primary operation (see Step 9).

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

9. **Visual Verification** (only if `--visual` flag is present AND `visual.enabled` = true in system-config):
   > Skip this entire step if `--visual` is absent or `visual.enabled` is false.

   a. Determine the page URL on foreignpolicy.local that corresponds to the newly documented code. Use `fp-tools source-map reverse-lookup <doc-path>` to find the source path, then construct the likely URL.
   b. Navigate to the page: call `browser_navigate` with `url: "https://foreignpolicy.local/{path}"`. If navigation fails, log a warning and skip remaining visual steps.
   c. Capture accessibility snapshot: call `browser_snapshot` to get the accessibility tree.
   d. Take screenshot: call `browser_take_screenshot` with `filename: "visual-add-{doc-name}.jpeg"`.
   e. Compare the rendered page against the new documentation:
      - Do documented UI elements exist in the accessibility tree?
      - Does the visual layout match documented descriptions?
      - Are documented interactions present and functional?
   f. If the rendered page reveals details not captured in the new documentation, add them.
   g. Save screenshot to `.fp-docs/screenshots/visual-add-{timestamp}/` directory.
   h. Record visual evidence in the delegation result or modification report.

## Pipeline Trigger

Execute the post-modification pipeline:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce verbosity against scope manifest
2. Read `framework/algorithms/citation-algorithm.md` → generate citations for new doc
3. Read `framework/algorithms/api-ref-algorithm.md` → verify API reference completeness
4. Read `framework/algorithms/validation-algorithm.md` → run sanity-check
5. Read `framework/algorithms/validation-algorithm.md` → run 10-point verification
6. Follow changelog rules from the mod-changelog module → append changelog entry
7. Follow index rules from the mod-index module → update PROJECT-INDEX (structural change)

**Delegated mode note:** In delegated mode, stages 1-3 are executed by this engine. Stages 4-8 are handled by the orchestrator -- stages 4-5 via the validate engine, stages 6-8 via the CJS pipeline callback loop (`node {plugin-root}/fp-tools.cjs pipeline next`). Do NOT execute stages 4-8 yourself in delegated mode.

## Output

Report: every file created and modified with summary, sanity check result, verification result, any items needing manual attention.
