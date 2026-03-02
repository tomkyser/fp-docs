---
name: docs-mod-pipeline
description: "Shared module defining the 7-stage post-modification pipeline. Preloaded by the docs-modify engine. NOT user-invocable."
user-invocable: false
disable-model-invocation: true
---

# Post-Modification Pipeline Module

Defines the 7-stage pipeline that runs after every doc-modifying operation. Only the docs-modify engine preloads this module. Other engines that modify docs (citations, api-refs, locals) run a subset.

## Pipeline Definition

After completing the core operation steps, execute these stages in order:

### Stage 1: Verbosity Enforcement

Read `framework/modules/verbosity-rules.md` and enforce:
- Build scope manifest: count every enumerable item in source
- Check output coverage: verify every item appears in generated doc
- Scan for banned summarization phrases
- If gaps found: fix before proceeding

### Stage 2: Citation Generation/Update

Read `framework/modules/citation-rules.md` and enforce:
- For new docs: generate all citations
- For revised docs: update stale citations, generate missing ones
- Verify citation format matches standard

### Stage 3: API Reference Sync

Read `framework/modules/api-ref-rules.md` and enforce:
- If doc type requires API Reference (per system-config): verify section exists
- Update table rows for any functions that changed
- Ensure provenance column is populated for every row

### Stage 4: Sanity Check

Read `framework/modules/validation-rules.md` and execute the sanity-check algorithm:
- Cross-reference every factual claim against source code
- Classify claims as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED
- If confidence is LOW: resolve issues before proceeding

### Stage 5: Verify

Read `framework/modules/validation-rules.md` and execute the 10-point verification checklist:
- File existence, orphan check, index completeness, appendix spot-check
- Link validation, changelog check, citation format, API ref provenance
- Locals contracts, verbosity compliance
- Report results per check

### Stage 6: Changelog Update

Read `framework/modules/changelog-rules.md` and:
- Append entry to `docs/changelog.md`
- List every file created, modified, or removed
- Include summary of why the change was made

### Stage 7: Index Update

Read `framework/modules/index-rules.md` and:
- Only trigger when structural changes occurred (new sections, major reorganization)
- For incremental changes: skip this stage
- When triggered: update PROJECT-INDEX.md

## Pipeline Trigger Matrix

| Operation | Stages Run |
|-----------|-----------|
| revise | All 7 stages |
| add | All 7 stages |
| auto-update | All 7 stages |
| auto-revise | All 7 stages |
| deprecate | All 7 stages |
| citations generate | Stages 4-7 (no verbosity/citation/api-ref — already done) |
| citations update | Stages 4-7 |
| api-refs generate | Stages 1, 2, 4-7 (no api-ref stage — already done) |
| locals annotate | Stages 1, 2, 4-7 |
| locals contracts | Stages 1, 2, 4-7 |
| locals shapes | Stages 1, 2, 4-7 |

## Pipeline Skip Conditions

- Stage 1 (Verbosity): Skip if `verbosity.enabled` is `false` in system-config
- Stage 2 (Citations): Skip if `citations.enabled` is `false` in system-config
- Stage 3 (API Refs): Skip if `api_ref.enabled` is `false` in system-config
- Stage 4 (Sanity): Skip if `--no-sanity-check` flag was passed
- Stage 5 (Verify): NEVER skip — always runs
- Stage 6 (Changelog): NEVER skip — always runs
- Stage 7 (Index): Only runs on structural changes

## Pipeline Completion Marker

When the pipeline completes, output a confirmation line:

```
Pipeline complete: [verbosity: PASS] [citations: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated]
```

This marker is checked by the SubagentStop hook to validate pipeline execution.
