# Post-Modification Completion Checklist

Checklist validated by SubagentStop hooks after a doc-modify engine completes. The hook looks for completion markers in the engine's output.

## Required Completion Markers

The docs-modify engine must output confirmation for each pipeline stage:

1. **Verbosity**: `[verbosity: PASS]` or `[verbosity: SKIP]`
2. **Citations**: `[citations: PASS]` or `[citations: SKIP]`
3. **API Refs**: `[api-refs: PASS]` or `[api-refs: SKIP]`
4. **Sanity Check**: `[sanity: HIGH]` or `[sanity: SKIP]`
5. **Verify**: `[verify: PASS]` or `[verify: FAIL — N issues]`
6. **Changelog**: `[changelog: updated]`

## Full Pipeline Completion Line

```
Pipeline complete: [verbosity: PASS] [citations: PASS] [api-refs: PASS] [sanity: HIGH] [verify: PASS] [changelog: updated]
```

## Validation Rules

- If `[changelog: updated]` is missing → hook emits warning
- If `[verify: FAIL]` is present → hook emits warning with issue count
- If `[sanity: LOW]` is present → hook emits warning
- All SKIP markers are acceptable (feature may be disabled in config)
- Missing markers indicate incomplete pipeline — hook warns

## Files That Must Change

For any doc-modify operation, these files MUST have been modified:
- At least one file in `docs/` (the target doc)
- `docs/changelog.md` (the changelog entry)

If neither changed, the operation may have failed silently.
