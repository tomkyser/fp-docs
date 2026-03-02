# Auto-Update — Instruction

## Inputs
- `$ARGUMENTS`: Optional scope restriction
- `$CHANGED_FILES`: Output from `git diff --name-only` (injected dynamically by skill)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-pipeline

## Steps

1. Read `docs/changelog.md`. Find the date of the most recent entry — this is the baseline.

2. Review the changed files list (from `$CHANGED_FILES` or run git log since baseline). Filter to documentation-relevant source files: remove docs/, node_modules/, vendor/, public/, .git/.

3. Map each changed source file to its documentation target using the source-to-documentation mapping from the project module. Identify additions, modifications, and removals. If $ARGUMENTS specifies a scope restriction, filter the list.

4. If no changed files map to any documentation targets: report "No documentation-relevant changes found" and exit.

5. Build scope manifests: for each doc to be created or modified, read `framework/modules/verbosity-rules.md`, count items, establish binding targets.

6. Execute updates:
   - For modified source files: read current source, read existing doc, update doc to reflect changes, preserve accurate content.
   - For new source files without docs: find sibling doc for format, read new source, create documentation.
   - For removed source files: add REMOVED notice to the doc.

7. If doc types require API Reference: maintain API Reference sections per `framework/modules/api-ref-rules.md`.

8. Update links for any docs created or removed.

## Pipeline Trigger

Execute the post-modification pipeline for all affected docs:
1. Read `framework/modules/verbosity-rules.md` → enforce verbosity against scope manifest
2. Read `framework/modules/citation-rules.md` → update citations for changed sections
3. Read `framework/modules/api-ref-rules.md` → verify API reference is current
4. Read `framework/modules/validation-rules.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/modules/validation-rules.md` → run 10-point verification
6. Read `framework/modules/changelog-rules.md` → append changelog entry
7. Read `framework/modules/index-rules.md` → update PROJECT-INDEX if structural changes occurred

## Output

Report: every file created, modified, or removed with summary. Sanity check result. Verification result. Items needing manual attention.
