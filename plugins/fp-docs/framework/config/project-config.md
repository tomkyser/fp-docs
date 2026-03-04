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

| Source Path | Documentation Target |
|------------|---------------------|
| functions.php | docs/01-architecture/bootstrap-sequence.md |
| inc/post-types/ | docs/02-post-types/ |
| inc/taxonomies/ | docs/03-taxonomies/ |
| inc/custom-fields/ | docs/04-custom-fields/ |
| components/ | docs/05-components/ |
| helpers/ | docs/06-helpers/ |
| inc/shortcodes/ | docs/07-shortcodes/ |
| inc/hooks/ | docs/08-hooks/ |
| inc/rest-api/ | docs/09-api/rest-api/ |
| inc/endpoints/ | docs/09-api/custom-endpoints/ |
| layouts/ | docs/10-layouts/ |
| features/ | docs/11-features/ |
| lib/autoloaded/ | docs/12-integrations/ |
| inc/cli/ | docs/16-cli/ |
| inc/admin-settings/ | docs/17-admin/ |
| assets/src/scripts/ | docs/18-frontend-assets/js/ |
| assets/src/styles/ | docs/18-frontend-assets/css/ |
| build/ | docs/00-getting-started/build-system.md |
| inc/roles/ | docs/20-exports-notifications/ |

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
