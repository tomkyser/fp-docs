# Project Configuration: Foreign Policy

## Project Identity
- Project: Foreign Policy magazine WordPress site
- Theme root: themes/foreign-policy-2017
- Docs root: themes/foreign-policy-2017/docs (relative to wp-content)
- WP-CLI prefix: ddev wp
- Local URL: https://foreignpolicy.local/
- SSL: self-signed (use curl -sk)
- PHP namespace: ForeignPolicy\Helpers\{Feature}\function_name()

## Source-to-Documentation Mapping

**Extracted to `source-map.json`** -- Source-to-doc mappings are now managed by `lib/source-map.cjs` and stored in `source-map.json` at the plugin root. Use `node {plugin-root}/fp-tools.cjs source-map lookup <source-path>` for lookups, or `source-map dump` for the full mapping.

This extraction eliminates the previous three-way mapping divergence (config.json, project-config.md, mod-project module).

## Appendix Cross-References

| Code Pattern | Appendix Path |
|-------------|---------------|
| add_action() / add_filter() | docs/24-appendices/A-complete-hook-registry.md |
| Shortcode registration | docs/24-appendices/B-shortcode-quick-reference.md |
| register_rest_route() | docs/24-appendices/C-rest-route-reference.md |
| define() / const | docs/24-appendices/D-constants-reference.md |
| Composer/npm dependency | docs/24-appendices/E-third-party-dependencies.md |
| ACF field group | docs/24-appendices/F-acf-field-group-reference.md |
| Feature template | docs/24-appendices/G-feature-template-catalog.md |

## Feature Enables
- Citations: enabled
- API References: enabled
- Locals contracts: enabled
- Verbosity enforcement: enabled
- Sanity-check: enabled

## Repository Configuration

### Codebase Repo
- Git root: wp-content/ (relative to workspace)
- Docs-relevant scope: themes/foreign-policy-2017/
- Remote: origin (VIP Go deployment repo)

### Docs Repo
- Git root: themes/foreign-policy-2017/docs/ (nested in codebase workspace)
- Remote: https://github.com/tomkyser/docs-foreignpolicy-com
- Visibility: private
- Branch strategy: mirrors codebase branches
- Source of truth: remote origin
- Pull behavior: always fetch/pull before work and before commit
- Offline work: requires explicit --offline flag

### Plugin Repo
- Remote: https://github.com/tomkyser/fp-docs
- Visibility: public
- Branch strategy: master for all users

### Path Resolution
- Codebase root detection: `git rev-parse --show-toplevel` from working directory
- Docs root: {codebase-root}/themes/foreign-policy-2017/docs/
- Docs is a separate git repo — use `git -C {docs-root}` for all docs git operations
- NEVER use the codebase repo's git for docs operations

### Diff Reports
- Location: docs/diffs/
- Format: {YYYY-MM-DD}_{branch-name}_diff_report.md
- Accumulate as history (do not clean up)
- Committed to docs repo on the feature branch
