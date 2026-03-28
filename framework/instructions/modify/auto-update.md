# Auto-Update — Instruction

## Inputs
- `$ARGUMENTS`: Optional scope restriction
- `$CHANGED_FILES`: Output from `git diff --name-only` (injected dynamically by skill)
- Preloaded modules: mod-standards, mod-project, mod-pipeline

## Steps

1. Read `docs/changelog.md`. Find the date of the most recent entry — this is the baseline.

2. Review the changed files list (from `$CHANGED_FILES` or run git log since baseline). Filter to documentation-relevant source files: remove docs/, node_modules/, vendor/, public/, .git/. If the user included the `--visual` flag, visual verification will be performed after updates (see Step 9).

3. Map each changed source file to its documentation target using the source-to-doc mapping from `source-map.json` (query via `fp-tools source-map lookup <source-path>`, or see mod-project for examples). Identify additions, modifications, and removals. If $ARGUMENTS specifies a scope restriction, filter the list.

4. If no changed files map to any documentation targets: report "No documentation-relevant changes found" and exit.

5. Build scope manifests: for each doc to be created or modified, read `framework/algorithms/verbosity-algorithm.md`, count items, establish binding targets.

6. Execute updates:
   - For modified source files: read current source, read existing doc, update doc to reflect changes, preserve accurate content.
   - For new source files without docs: find sibling doc for format, read new source, create documentation.
   - For removed source files: add REMOVED notice to the doc.

7. If doc types require API Reference: maintain API Reference sections per `framework/algorithms/api-ref-algorithm.md`.

8. Update links for any docs created or removed.

9. **Visual Verification** (only if `--visual` flag is present AND `visual.enabled` = true in system-config):
   > Skip this entire step if `--visual` is absent or `visual.enabled` is false.

   a. For each documentation file being updated, determine if there is a corresponding navigable page on foreignpolicy.local.
   b. For each page that exists:
      i.   Navigate: call `browser_navigate` with `url: "https://foreignpolicy.local/{path}"`.
      ii.  Snapshot: call `browser_snapshot` to capture the accessibility tree.
      iii. Screenshot: call `browser_take_screenshot` with `filename: "visual-auto-update-{doc-name}.jpeg"`.
      iv.  Compare rendered page against updated documentation and correct any discrepancies.
   c. If navigation fails for any page, log a warning and continue with the next page.
   d. Save all screenshots to `.fp-docs/screenshots/visual-auto-update-{timestamp}/` directory.
   e. Record visual evidence for each page in the delegation result or modification report.

## Pipeline Trigger

Execute the post-modification pipeline for all affected docs:
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce verbosity against scope manifest
2. Read `framework/algorithms/citation-algorithm.md` → update citations for changed sections
3. Read `framework/algorithms/api-ref-algorithm.md` → verify API reference is current
4. Read `framework/algorithms/validation-algorithm.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/algorithms/validation-algorithm.md` → run 10-point verification
6. Follow changelog rules from the mod-changelog module → append changelog entry
7. Follow index rules from the mod-index module → update PROJECT-INDEX if structural changes occurred

**Delegated mode note:** In delegated mode, stages 1-3 are executed by this engine. Stages 4-8 are handled by the orchestrator -- stages 4-5 via the validate engine, stages 6-8 via the CJS pipeline callback loop (`node {plugin-root}/fp-tools.cjs pipeline next`). Do NOT execute stages 4-8 yourself in delegated mode.

## Output

Report: every file created, modified, or removed with summary. Sanity check result. Verification result. Items needing manual attention.
