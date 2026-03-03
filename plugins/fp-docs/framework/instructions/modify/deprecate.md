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
1. Read `framework/algorithms/verbosity-algorithm.md` → enforce verbosity against scope manifest
2. Read `framework/algorithms/citation-algorithm.md` → update citations for changed sections
3. Read `framework/algorithms/api-ref-algorithm.md` → verify API reference is current
4. Read `framework/algorithms/validation-algorithm.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/algorithms/validation-algorithm.md` → run 10-point verification
6. Follow changelog rules from the docs-mod-changelog module → append changelog entry
7. Follow index rules from the docs-mod-index module → update PROJECT-INDEX (structural change)

## Output

Report: every file modified with summary, verification result.
