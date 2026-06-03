# Citation Pipeline Algorithm

Execute these steps during Pipeline Stage 2 (Citations).
All format rules, tier definitions, and freshness states are in your preloaded mod-citations module.

## When to Generate New Citations

Generate citations when:
1. New documentation file created (add operation)
2. New function/hook/route added to existing doc (revise operation)
3. Doc element exists without a citation block
4. Deprecated citation removed and replacement needed

## When to Update Existing Citations

Update citations when:
1. Source code modified since last citation update
2. Staleness detection finds Stale, Drifted, or Broken citations
3. Function renamed or moved to different file
4. Line numbers shifted due to edits above/below the function

## Staleness Detection Algorithm

For each existing `> **Citation**` block in the doc:

1. **Parse Citation Marker** — extract `file_path`, `symbol_name`, `line_range`
2. **Locate Current Source** — read cited file
   - If file missing → classify as **Broken** (High severity)
3. **Symbol Search** — search for `function {name}(` or `add_action`/`add_filter` with the symbol name
   - If not found → classify as **Broken** (High severity)
4. **Line Range Comparison** — compare `L{start}-{end}` against actual location
   - If lines differ but code matches → classify as **Stale** (Low severity)
5. **Excerpt Comparison** (Full and Signature tiers only) — compare code block against current source
   - If code changed → classify as **Drifted** (Medium severity)
   - If code matches → classify as **Fresh** (No action)

Apply the action for each state from your preloaded mod-citations freshness model.

## Tier Selection Logic

Apply tier selection from your preloaded mod-citations module.
Special cases:
- Hook registrations (`add_action`/`add_filter`): always Full tier
- Shortcode attribute defaults: always Full tier
- REST route registrations: always Full tier
- Meta field tables derived from long methods: always Reference tier

## Batch Processing Rules

When processing multiple files in a single operation:
1. Collect all unique source file paths from citations across all target docs
2. Read each source file ONCE and cache in working memory
3. For each citation in each doc, run detection/generation using the cached source
4. Report results grouped by state (Fresh/Stale/Drifted/Broken) across all docs
