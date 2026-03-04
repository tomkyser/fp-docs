---
name: mod-pipeline
description: "Shared module defining the 7-stage post-modification pipeline. Preloaded by the modify engine. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# Post-Modification Pipeline Module

Defines the 8-stage pipeline that runs after every doc-modifying operation. Only the modify engine preloads this module. Other engines that modify docs (citations, api-refs, locals) run a subset.

## Pipeline Definition

After completing the core operation steps, execute these stages in order:

### Stage 1: Verbosity Enforcement

Read `framework/algorithms/verbosity-algorithm.md` for the execution algorithm.
Apply rules from your preloaded mod-verbosity module.
- Build scope manifest: count every enumerable item in source
- Check output coverage: verify every item appears in generated doc
- Scan for banned summarization phrases
- If gaps found: fix before proceeding

### Stage 2: Citation Generation/Update

Read `framework/algorithms/citation-algorithm.md` for the execution algorithm.
Apply rules from your preloaded mod-citations module.
- For new docs: generate all citations
- For revised docs: update stale citations, generate missing ones
- Verify citation format matches standard

### Stage 3: API Reference Sync

Read `framework/algorithms/api-ref-algorithm.md` for the execution algorithm.
Apply rules from your preloaded mod-api-refs module.
- If doc type requires API Reference (per system-config): verify section exists
- Update table rows for any functions that changed
- Ensure provenance column is populated for every row

### Stage 4: Sanity Check

Read `framework/algorithms/validation-algorithm.md` for the execution algorithm.
Apply rules from your preloaded mod-validation module.
- Cross-reference every factual claim against source code
- Classify claims as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED
- If confidence is LOW: resolve issues before proceeding

### Stage 5: Verify

Read `framework/algorithms/validation-algorithm.md` for the verification algorithm.
Apply check definitions from your preloaded mod-validation module.
- File existence, orphan check, index completeness, appendix spot-check
- Link validation, changelog check, citation format, API ref provenance
- Locals contracts, verbosity compliance
- Report results per check

### Stage 6: Changelog Update

Follow the changelog rules from your preloaded mod-changelog module:
- Append entry to `docs/changelog.md`
- List every file created, modified, or removed
- Include summary of why the change was made

### Stage 7: Index Update

Follow the rules from your preloaded mod-index module:
- Only trigger when structural changes occurred (new sections, major reorganization)
- For incremental changes: skip this stage
- When triggered: update PROJECT-INDEX.md

### Stage 8: Docs Repo Commit & Push

Pull latest, commit, and push all pipeline changes to the docs repo:
1. Detect docs root from project-config (themes/foreign-policy-2017/docs/)
2. Check if docs root has a .git/ directory
3. If yes:
   a. If not `--offline`: `git -C {docs-root} fetch origin && git -C {docs-root} pull --ff-only`. **Halt** if pull fails (diverged, uncommitted changes, or unreachable).
   b. `git -C {docs-root} add -A`
   c. `git -C {docs-root} commit -m "fp-docs: {operation} — {summary}"`
   d. If not `--no-push` and not `--offline`: `git -C {docs-root} push` (push to remote). **Halt** if push fails with diagnostic guidance.
4. If no: skip (docs repo not initialized)

Skip conditions:
- Pull: Skip if `--offline` flag was passed, or if `remote.pull_before_commit` is `false` in system-config. Pull failure **halts** the operation.
- Commit: NEVER skip — always attempt if docs repo exists
- Push: Skip if `--no-push` or `--offline` flag was passed, or if `push.enabled` is `false` in system-config. Push failure **halts** the operation with diagnostic guidance.

## Pipeline Trigger Matrix

| Operation | Stages Run |
|-----------|-----------|
| revise | All 8 stages |
| add | All 8 stages |
| auto-update | All 8 stages |
| auto-revise | All 8 stages |
| deprecate | All 8 stages |
| citations generate | Stages 4-8 (no verbosity/citation/api-ref — already done) |
| citations update | Stages 4-8 |
| api-refs generate | Stages 1, 2, 4-8 (no api-ref stage — already done) |
| locals annotate | Stages 1, 2, 4-8 |
| locals contracts | Stages 1, 2, 4-8 |
| locals shapes | Stages 1, 2, 4-8 |

## Pipeline Skip Conditions

- Stage 1 (Verbosity): Skip if `verbosity.enabled` is `false` in system-config
- Stage 2 (Citations): Skip if `citations.enabled` is `false` in system-config
- Stage 3 (API Refs): Skip if `api_ref.enabled` is `false` in system-config
- Stage 4 (Sanity): Skip if `--no-sanity-check` flag was passed
- Stage 5 (Verify): NEVER skip — always runs
- Stage 6 (Changelog): NEVER skip — always runs
- Stage 7 (Index): Only runs on structural changes
- Stage 8 Commit: NEVER skip — always attempt if docs repo exists
- Stage 8 Push: Skip if `--no-push` flag was passed or `push.enabled` is `false`

## Pipeline Completion Marker

When the pipeline completes, output a confirmation line:

```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated] [docs-pull: pulled|skipped|HALTED] [docs-commit: committed|skipped] [docs-push: pushed|skipped|HALTED]
```

This marker is checked by the SubagentStop hook to validate pipeline execution.

## Completion Validation

The SubagentStop hook validates pipeline completion using these rules:

- Missing `[changelog: updated]` → hook emits warning
- `[verify: FAIL]` → hook emits warning with issue count
- `[sanity: LOW]` → hook emits warning
- All SKIP markers are acceptable (stage was legitimately skipped)
- Missing markers indicate incomplete pipeline — hook emits warning

### Files That Must Change

For any doc-modify operation, these files MUST have been modified:
- At least one file in `docs/` (the target documentation)
- `docs/changelog.md` (the changelog entry)

If neither changed, the operation may have failed silently.
