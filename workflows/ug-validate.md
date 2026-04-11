<purpose>
Validate user guide accuracy against current UI state. Walk every documented step against
the actual WordPress admin interface. Report stale content, broken navigation paths, outdated
screenshots, tone violations, and structural incompleteness. Read-only operation — no files
are modified. Delegates validation execution to the fp-docs-ug-validator agent.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init read-op ug-validate "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Parse JSON for: operation, agent, target_scope, validation_config, feature_flags.

Check for flags:
- `--depth quick|standard|deep`: Validation depth (default: standard)
- `--all`: Validate all user guide pages
- `--no-tone-check`: Skip jargon & tone stage
- Scope from $ARGUMENTS (page path or section name)
</step>

<step name="resolve-targets">
## 2. Resolve Target Pages
Determine which pages to validate:

If `--all` flag: target is entire `user-guide/content/` directory.
If section specified (e.g., `content-management`): target is `user-guide/content/{section}/`.
If page path specified: target is that specific page bundle.
If no scope: prompt user to specify scope or use `--all`.

Verify target path(s) exist in docs root:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths docs-root
```
</step>

<step name="execute">
## 3. Execute Validation
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Execute ug-validate operation.
    Targets: {resolved target paths}
    Depth: {depth}
    Flags: {flags including --no-tone-check if set}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Validation checks by depth:

    For quick depth (stages 3-4 only):
    a. Jargon & Tone (unless --no-tone-check): Scan page body for banned patterns.
       Flag dev jargon, PHP/JS identifiers, technical terminology.
    b. Completeness: Check required sections per content_type.
       Validate frontmatter fields. Check structural quality.

    For standard depth (all 4 stages, code-based):
    a. UI Path Verification: Parse documented navigation paths. Trace code
       registrations (add_menu_page, register_post_type, register_taxonomy,
       add_meta_box, add_shortcode) to verify features still exist.
       Classify: VERIFIED, BROKEN, PARTIAL, STALE.
    b. Screenshot Currency: Check last_verified against source file modification
       dates. Verify all referenced screenshot files exist as page bundle resources.
       Flag orphan assets and naming convention violations.
    c. Jargon & Tone (unless --no-tone-check): Same as quick.
    d. Completeness: Same as quick.

    For deep depth (all 4 stages, Playwright when available):
    a. UI Path Verification: If Playwright MCP available, navigate each documented
       path in the WordPress admin and verify elements exist. If not available,
       fall back to code-based verification as in standard.
    b. Screenshot Currency: If Playwright available, capture fresh screenshots and
       compare with documented ones. Otherwise same as standard.
    c. Jargon & Tone: Same as standard.
    d. Completeness: Same as standard.

    For each issue found, recommend the specific /fp-docs:ug-* command:
    - BROKEN UI path -> /fp-docs:ug-update
    - Stale screenshot -> /fp-docs:ug-screenshot --refresh
    - Jargon violation -> /fp-docs:ug-update
    - Missing section -> /fp-docs:ug-update
    - Missing page -> /fp-docs:ug-generate

    Produce per-page validation report (PASS/WARN/FAIL).
    Read-only -- do NOT modify any files.",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```
</step>

</process>

<success_criteria>
- [ ] All target pages validated at requested depth
- [ ] UI paths verified against code or Playwright (not assumed)
- [ ] Screenshot references checked against actual files on disk
- [ ] Jargon scan executed (unless --no-tone-check)
- [ ] Completeness check run against correct required sections per content type
- [ ] Per-page status reported (PASS/WARN/FAIL)
- [ ] Each issue includes remediation command recommendation
- [ ] No files modified (read-only)
</success_criteria>
