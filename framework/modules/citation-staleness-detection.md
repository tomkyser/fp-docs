# Citation Staleness Detection

Algorithm for detecting stale citations by comparing cited content with current file state. Loaded on-demand during citation update and verification operations.

## Detection Algorithm

For each `> **Citation**` block in a documentation file:

### 1. Parse Citation Marker

Extract components from the marker line:
```
> **Citation** · `{file_path}` · `{symbol_name}` · L{start}–{end}
```

### 2. Locate Current Source

Read the cited file at `{file_path}` (relative to theme root).

If file does not exist → **Broken** (file removed/renamed).

### 3. Symbol Search

Search the source file for `{symbol_name}`:
- For functions: look for `function {name}(`
- For methods: look for `function {name}(` within the class
- For hooks: look for the `add_action`/`add_filter` call

If symbol not found → **Broken** (symbol removed/renamed).

### 4. Line Range Comparison

Compare the cited `L{start}–{end}` with the symbol's actual location:
- If lines match → proceed to excerpt check
- If lines differ → **Stale** (code moved but still exists)

### 5. Excerpt Comparison (Full and Signature tiers)

Compare the code block in the citation against the current source at the symbol's location:
- If excerpt matches current source → **Fresh**
- If excerpt differs → **Drifted** (code was modified)

### 6. Classification Summary

| Check Result | State | Severity | Action |
|-------------|-------|----------|--------|
| File missing | Broken | High | Add `[NEEDS INVESTIGATION]` |
| Symbol not found | Broken | High | Add `[NEEDS INVESTIGATION]` |
| Lines differ, excerpt matches | Stale | Low | Update line numbers |
| Lines differ, excerpt differs | Drifted | Medium | Update excerpt + lines |
| Everything matches | Fresh | None | No action |

## Batch Staleness Scan

When scanning multiple docs:

1. Collect all unique source file paths referenced by citations
2. Read each source file once (cache for reuse across citations)
3. For each citation, run the detection algorithm
4. Group results by state for reporting

## Staleness Report Format

```
## Citation Staleness Report

| State | Count | Files |
|-------|-------|-------|
| Fresh | N | (no action needed) |
| Stale | N | file1.md, file2.md |
| Drifted | N | file3.md |
| Broken | N | file4.md |

### Details
[Per-citation details for non-Fresh citations]
```
