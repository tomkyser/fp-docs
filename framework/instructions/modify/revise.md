# Revise — Instruction

## Inputs
- `$ARGUMENTS`: User's description of what needs fixing
- Preloaded modules: mod-standards, mod-project, mod-pipeline

## Steps

1. Parse the user's request. Identify which documentation file(s) need revision, what aspect is incorrect or outdated, and what source file(s) are relevant (using the source-to-doc mapping from `source-map.json` (query via `fp-tools source-map lookup <source-path>`, or see mod-project for examples)). If the user included the `--visual` flag, visual verification will be performed after the primary operation (see Step 8).

2. Read the current documentation file(s).

3. Read the corresponding source code file(s).

4. Compare and identify the specific discrepancies between doc claims and source code.

5. Build a scope manifest: read `framework/algorithms/verbosity-algorithm.md`. Count documentable items in the source file(s) and establish binding targets.

6. Make targeted edits to correct the discrepancies:
   - Follow all formatting and content rules from the standards module.
   - Preserve all content that is still accurate — do not rewrite sections that don't need changes.
   - If the revision touches hooks, shortcodes, REST routes, constants, ACF groups, or feature templates, check the appendix cross-reference table from the project module and update the relevant appendix.

7. If the doc type requires API Reference (per system-config): verify the API Reference section exists and is up to date. Add rows for new functions, remove rows for deleted functions, update changed signatures.

8. **Visual Verification** (only if `--visual` flag is present AND `visual.enabled` = true in system-config):
   > Skip this entire step if `--visual` is absent or `visual.enabled` is false.

   a. Determine the page URL on foreignpolicy.local that corresponds to the documentation being revised. Use `fp-tools source-map reverse-lookup <doc-path>` to find the source path, then construct the likely URL. For post types, use `https://foreignpolicy.local/?post_type={slug}`. For components/templates, navigate to a page that renders them.
   b. Navigate to the page: call `browser_navigate` with `url: "https://foreignpolicy.local/{path}"`. If navigation fails (ddev not running, page not found), log a warning and skip remaining visual steps -- do NOT fail the operation.
   c. Capture accessibility snapshot: call `browser_snapshot` to get the accessibility tree.
   d. Take screenshot: call `browser_take_screenshot` with `filename: "visual-revise-{doc-name}.jpeg"`.
   e. Compare the rendered page against the revised documentation:
      - Do documented UI elements exist in the accessibility tree?
      - Does the visual layout match documented descriptions?
      - Are documented interactions (links, buttons, forms) present?
   f. If the rendered page reveals information not captured in the documentation, incorporate it into the revision.
   g. If the rendered page contradicts the documentation, correct the documentation to match rendered reality.
   h. Save screenshot to `.fp-docs/screenshots/visual-revise-{timestamp}/` directory.
   i. Record visual evidence in the delegation result or modification report:
      - Screenshot filename
      - Key visual observations (2-3 sentences)
      - Any corrections made based on visual verification

## Pipeline Trigger

After completing the steps above, execute the post-modification pipeline:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce verbosity against scope manifest
2. Read `framework/algorithms/citation-algorithm.md` → update citations for changed sections
3. Read `framework/algorithms/api-ref-algorithm.md` → verify API reference is current
4. Read `framework/algorithms/validation-algorithm.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/algorithms/validation-algorithm.md` → run 10-point verification
6. Follow changelog rules from the mod-changelog module → append changelog entry
7. Follow index rules from the mod-index module → update PROJECT-INDEX if structural changes occurred

**Delegated mode note:** In delegated mode, stages 1-3 are executed by this engine. Stages 4-8 are handled by the orchestrator -- stages 4-5 via the validate engine, stages 6-8 via the CJS pipeline callback loop (`node {plugin-root}/fp-tools.cjs pipeline next`). Do NOT execute stages 4-8 yourself in delegated mode.

## Output

Report to the user:
- Every file modified with a one-line summary of the change
- Sanity check result (HIGH or LOW + any issues)
- Verification result (PASS or FAIL with details)
