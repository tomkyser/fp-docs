# Citation Rules

Complete algorithm for generating and updating code citations. Loaded on-demand by engines during pipeline execution.

## When to Generate New Citations

Generate new citations when:
- A new doc is created (all documentable elements need citations)
- A doc is revised and new code claims are added
- The `citations generate` operation is invoked
- A doc element lacks a citation block (gap detected during pipeline)

## When to Update Existing Citations

Update existing citations when:
- Source code has changed (drifted citations)
- Functions have moved to different line numbers (stale citations)
- The `citations update` operation is invoked
- Pipeline stage 2 detects stale citations

## Staleness Detection Algorithm

For each existing `> **Citation**` block:

1. **Parse the marker**: Extract file_path, symbol_name, line_range
2. **Symbol lookup**: Search the cited source file for the symbol
   - NOT found → **Broken** (symbol removed/renamed)
   - Found → continue
3. **Line range check**: Is symbol at the cited line range?
   - YES → check excerpt
   - NO → record new line range → **Stale**
4. **Excerpt check** (Full and Signature tiers):
   - Matches current source → **Fresh** (no update needed)
   - Different from current source → **Drifted** (code changed)

## Update Actions by State

| State | Action |
|-------|--------|
| Fresh | No action |
| Stale | Update line range only. Keep excerpt. |
| Drifted | Update line range AND regenerate excerpt from current source. Re-apply tier rules. |
| Broken | Add `[NEEDS INVESTIGATION — cited symbol no longer exists]` marker. Do NOT remove citation. |

## Tier Selection Logic

Count lines in the source element body:

| Line Count | Tier | Content |
|-----------|------|---------|
| ≤ 15 lines | Full | Complete code excerpt, verbatim |
| 16–100 lines | Signature | Function signature + `// ... N lines: <summary>` + closing brace |
| > 100 lines | Reference | Marker only — file + symbol + line range, no code block |

Special cases:
- Hook registrations (`add_action`/`add_filter`): always Full tier
- Shortcode `shortcode_atts`: always Full tier
- REST `register_rest_route`: always Full tier
- Meta field tables from long methods: always Reference tier

## Citation Format Template

```markdown
> **Citation** · `{file_path}` · `{symbol_name}` · L{start}–{end}
> ```php
> {verbatim code excerpt}
> ```
```

## Batch Processing Rules

When processing multiple files:
1. Group citations by source file to minimize file reads
2. Process one doc at a time — don't interleave citation updates across docs
3. After updating citations in a doc, verify format before moving to next doc
4. Aggregate results for the batch report
