# Cross-Reference Validation Rules

Link validation rules, relative path resolution, and broken link detection. Loaded on-demand during verification.

## Link Validation Algorithm

For each relative markdown link in a doc file:

1. Extract the link target from `[text](target)`
2. Resolve the path relative to the containing file's directory
3. Check if the resolved path exists on disk
4. Report broken links with file, line, and target path

## Relative Path Resolution

All links between docs MUST be relative markdown links.

Examples:
- Same directory: `[Post](post.md)`
- Parent directory: `[About](../About.md)`
- Sibling section: `[Hooks](../08-hooks/_index.md)`
- Subdirectory: `[REST API](rest-api/overview.md)`

## Anchor Links

For links with anchors (`file.md#section`):
- Verify the file exists
- Optionally verify the anchor exists (heading slug match)
- Anchor-only links (`#section`) reference the current file

## Appendix Cross-Reference Validation

When a doc modifies code patterns, the corresponding appendix must be updated:

| Pattern | Appendix |
|---------|----------|
| `add_action`/`add_filter` | `A-complete-hook-registry.md` |
| Shortcode registration | `B-shortcode-quick-reference.md` |
| `register_rest_route` | `C-rest-route-reference.md` |
| `define()`/`const` | `D-constants-reference.md` |
| Composer/npm dependency | `E-third-party-dependencies.md` |
| ACF field group | `F-acf-field-group-reference.md` |
| Feature template | `G-feature-template-catalog.md` |

## Broken Link Categories

| Category | Description | Severity |
|----------|-------------|----------|
| MISSING_FILE | Target file does not exist | High |
| WRONG_PATH | File exists but at different path | Medium |
| BROKEN_ANCHOR | File exists but anchor heading not found | Low |
| ORPHANED | File exists but no link points to it | Medium |
