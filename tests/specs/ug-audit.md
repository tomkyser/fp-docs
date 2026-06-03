---
command: ug-audit
engine: ug-validator
operation: ug-audit
workflow: workflows/ug-audit.md
agent: fp-docs-ug-validator
type: read
pipeline_stages: none
subcommands: none
flags: --section <name>
---

# /fp-docs:ug-audit - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:ug-audit [--section getting-started|content-management|custom-features|workflows|site-features|troubleshooting]`
2. Command file loads workflow `workflows/ug-audit.md` via `@-reference`
3. Workflow initializes via `fp-tools init read-op`
4. Workflow spawns fp-docs-ug-validator with references: ug-standards.md, ug-validation-rules.md, fp-project.md
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path. The agent performs coverage gap detection:
1. Scan codebase for user-visible features (admin menus, CPTs, taxonomies, settings pages, shortcodes, meta boxes, dashboard widgets)
2. Scan user guide pages for documented features (via `source_features` frontmatter and page titles)
3. Cross-reference to find undocumented, stale/removed, and partially documented features

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + ug-validator)

## Files Typically Touched

- No files modified (read-only operation)
- Reads all `user-guide/content/**/_index.md` and `user-guide/content/**/index.md` files
- Greps codebase for feature registration patterns (`add_menu_page`, `register_post_type`, `register_taxonomy`, `add_options_page`, `add_shortcode`, `add_meta_box`, `wp_add_dashboard_widget`)

## Error Paths

- Codebase root unavailable (plugin dev mode): agent reports cannot scan codebase, skips code-side scan
- User guide scaffold not bootstrapped: agent reports no content to audit
- Invalid `--section` value: agent reports error with valid section names

## Edge Cases

- Audit with `--section`: limits both code scan and guide scan to features relevant to that section
- Audit with no flags: full coverage analysis across all sections
- Feature with `show_in_menu: false`: excluded from expected coverage (not user-visible)
- Feature documented in guide but removed from code: classified as STALE/REMOVED
- Feature split across multiple guide pages: each page's `source_features` contributes to coverage
- Empty user guide (scaffold just bootstrapped): reports all features as undocumented with priority list
