# Deprecate — Instruction

## Inputs
- `$ARGUMENTS`: Description of code being deprecated or removed
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-pipeline

## Steps

1. Parse the request. Identify which code/docs are being deprecated or removed, whether the code is deprecated (still in codebase) or removed (deleted), and what the replacement is.

2. For deprecated code (still in codebase):
   a. Read the current documentation file.
   b. Add `[LEGACY]` to the document title.
   c. Add deprecation notice after the title: `> **Deprecated**: [YYYY-MM-DD]. [Replacement info]`
   d. Update the parent `_index.md` entry to include `[LEGACY]`.
   e. Update `About.md` entry to include `[LEGACY]`.

3. For removed code (deleted from codebase):
   a. Read the current documentation file.
   b. Add REMOVED notice at top: `> **REMOVED**: This file was deleted on [YYYY-MM-DD].`
   c. Remove the entry from parent `_index.md`.
   d. Remove the entry from `About.md`.

4. Update cross-references: search for docs linking to the deprecated/removed doc. Update link text with [LEGACY] or remove link as appropriate.

5. Check appendices: if the deprecated/removed code registered hooks, shortcodes, REST routes, constants, ACF groups, or feature templates, update the relevant appendix.

## Pipeline Trigger

Execute the post-modification pipeline:
1. Read `framework/modules/verbosity-rules.md` → enforce verbosity against scope manifest
2. Read `framework/modules/citation-rules.md` → update citations for changed sections
3. Read `framework/modules/api-ref-rules.md` → verify API reference is current
4. Read `framework/modules/validation-rules.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/modules/validation-rules.md` → run 10-point verification
6. Read `framework/modules/changelog-rules.md` → append changelog entry
7. Read `framework/modules/index-rules.md` → update PROJECT-INDEX (structural change)

## Output

Report: every file modified with summary, verification result.
