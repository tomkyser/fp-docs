# Revise — Instruction

## Inputs
- `$ARGUMENTS`: User's description of what needs fixing
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-pipeline

## Steps

1. Parse the user's request. Identify which documentation file(s) need revision, what aspect is incorrect or outdated, and what source file(s) are relevant (using the source-to-documentation mapping from the project module).

2. Read the current documentation file(s).

3. Read the corresponding source code file(s).

4. Compare and identify the specific discrepancies between doc claims and source code.

5. Build a scope manifest: read `framework/modules/verbosity-rules.md`. Count documentable items in the source file(s) and establish binding targets.

6. Make targeted edits to correct the discrepancies:
   - Follow all formatting and content rules from the standards module.
   - Preserve all content that is still accurate — do not rewrite sections that don't need changes.
   - If the revision touches hooks, shortcodes, REST routes, constants, ACF groups, or feature templates, check the appendix cross-reference table from the project module and update the relevant appendix.

7. If the doc type requires API Reference (per system-config): verify the API Reference section exists and is up to date. Add rows for new functions, remove rows for deleted functions, update changed signatures.

## Pipeline Trigger

After completing the steps above, execute the post-modification pipeline:
1. Read `framework/modules/verbosity-rules.md` → enforce verbosity against scope manifest
2. Read `framework/modules/citation-rules.md` → update citations for changed sections
3. Read `framework/modules/api-ref-rules.md` → verify API reference is current
4. Read `framework/modules/validation-rules.md` → run sanity-check (skip if --no-sanity-check)
5. Read `framework/modules/validation-rules.md` → run 10-point verification
6. Follow changelog rules from the docs-mod-changelog module → append changelog entry
7. Follow index rules from the docs-mod-index module → update PROJECT-INDEX if structural changes occurred

## Output

Report to the user:
- Every file modified with a one-line summary of the change
- Sanity check result (HIGH or LOW + any issues)
- Verification result (PASS or FAIL with details)
