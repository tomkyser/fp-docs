<purpose>
Audit user guide coverage gaps. Scan the codebase for user-visible features (admin menus,
custom post types, taxonomies, settings pages, meta boxes, shortcodes, dashboard widgets)
and compare against documented user guide pages. Report undocumented features, stale
documentation for removed features, and partial coverage. Read-only operation — no files
are modified. Delegates audit execution to the fp-docs-ug-validator agent.
</purpose>

<required_reading>
DO NOT read reference files yourself. Each step below specifies which files
its specialist agent will read via files_to_read. You are a dispatcher — pass
arguments and results between steps, nothing more.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize
```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op ug-audit "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- `--section <name>`: Limit audit to a specific user guide section (getting-started, content-management, custom-features, workflows, site-features, troubleshooting)
</step>

<step name="execute">
## 2. Execute Coverage Audit
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute ug-audit operation -- coverage gap analysis.
    Section filter: {section or 'all'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Coverage audit steps:

    1. Scan codebase for user-visible features:
       - Grep for add_menu_page, add_submenu_page (admin menus)
       - Grep for register_post_type (custom post types with show_ui !== false)
       - Grep for register_taxonomy (taxonomies with show_ui !== false)
       - Grep for add_options_page, add_settings_section (settings pages)
       - Grep for add_meta_box (meta boxes)
       - Grep for add_shortcode (shortcodes)
       - Grep for wp_add_dashboard_widget (dashboard widgets)
       Filter to features in themes/foreign-policy-2017/ scope.
       Exclude features with show_in_menu === false or show_ui === false.

    2. Scan user guide pages:
       - Read all index.md files in user-guide/content/
       - Collect source_features from frontmatter
       - Extract feature names from titles and headings
       - Map each page to the codebase features it documents

    3. Cross-reference:
       - UNDOCUMENTED: Feature exists in code but no user guide page covers it
       - STALE: User guide page documents a feature removed from code
       - PARTIAL: Feature exists and has a page, but page covers only some aspects
       - COVERED: Feature fully documented

    4. If --section specified, limit both scans to that section's domain.

    5. Produce coverage report:
       - Total user-visible features found
       - Coverage percentage (documented / total)
       - Gap list with priority classification:
         HIGH: Core admin features used daily (post types, menus)
         MEDIUM: Secondary features (settings, meta boxes)
         LOW: Rarely used features (dashboard widgets, shortcodes)
       - For each gap, recommend: /fp-docs:ug-generate {feature}
       - For each stale page, recommend: /fp-docs:ug-update or removal
       - Section breakdown if auditing all sections

    Read-only -- do NOT modify any files.",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] Codebase scanned for all user-visible feature categories
- [ ] User guide pages inventoried with source_features mapped
- [ ] Cross-reference complete: UNDOCUMENTED, STALE, PARTIAL, COVERED classified
- [ ] Coverage percentage calculated
- [ ] Gaps prioritized (HIGH/MEDIUM/LOW)
- [ ] Each gap includes specific /fp-docs:ug-* remediation command
- [ ] Section breakdown included (if --section not specified)
- [ ] No files modified (read-only)
</success_criteria>
