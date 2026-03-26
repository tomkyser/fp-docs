# Test — Instruction

## Inputs
- `$ARGUMENTS`: Test scope (rest-api|cli|templates|visual|all)
- Preloaded modules: mod-standards, mod-project, mod-validation

## Steps

1. Check local development environment availability:
   - Verify local URL is accessible: `curl -sk https://foreignpolicy.local/`
   - Verify WP-CLI works: `ddev wp cli version`
   - If unavailable: report skip with reason and exit.

2. Parse test scope from $ARGUMENTS.

3. For `rest-api` scope:
   - Read REST endpoint docs in docs/09-api/
   - For each documented endpoint: make a curl request, verify response shape matches doc
   - Report pass/fail per endpoint

4. For `cli` scope:
   - Read CLI docs in docs/15-cli/
   - For each documented command: run with --help, verify args and description match doc
   - Report pass/fail per command

5. For `templates` scope:
   - Read component/layout docs
   - Verify template files exist at documented paths
   - Report pass/fail per template

6. For `visual` scope (requires `visual.enabled` = true in system-config):
   a. Check visual verification prerequisites:
      - Read system-config `visual.enabled` -- if `false`, skip visual scope with "Visual verification disabled in system-config" message.
      - Verify Playwright MCP tools are available by checking that `browser_navigate` is a callable tool. If not available, skip with "Playwright MCP server not running -- ensure plugin .mcp.json is loaded" message.
      - Verify local development environment: `curl -sk https://foreignpolicy.local/ -o /dev/null -w "%{http_code}"`. If not 200, skip with "ddev not running or foreignpolicy.local unreachable" message.
   b. Read component and layout documentation files that describe rendered UI elements. Use the source-to-documentation mapping from project-config to identify docs that correspond to navigable pages.
   c. For each documented page or component with a determinable URL on foreignpolicy.local:
      i.   Navigate: call `browser_navigate` with `url: "https://foreignpolicy.local/{path}"`.
      ii.  Snapshot: call `browser_snapshot` to capture the accessibility tree for structural verification. This is the primary verification tool (far fewer tokens than screenshot analysis).
      iii. Screenshot: call `browser_take_screenshot` for visual evidence. Use filename pattern `{component-name}.jpeg`.
      iv.  Structural verify: compare documented elements (headings, components, layout regions, template structures) against accessibility tree nodes. Each documented element is a pass/fail check.
      v.   Visual analyze: use screenshot vision to verify visual layout matches documentation claims where structural verification is insufficient (e.g., styling, positioning, visual hierarchy).
      vi.  Interactive verify (if applicable): if documentation claims specific behavior (e.g., "clicking X shows Y", "form submits to Z"), use `browser_click` or other interaction tools to verify. Only test interactions that are explicitly documented.
   d. Save all screenshots to `.fp-docs/screenshots/test-{timestamp}/` directory (per system-config `visual.default_screenshot_dir`). Create the directory if it does not exist.
   e. Report pass/fail per page/component with:
      - Page URL navigated
      - Screenshot filename reference
      - Accessibility tree verification result (elements found vs expected)
      - Visual analysis summary (2-3 sentences)
      - Any discrepancies found between documentation and rendered page

7. Generate test report with passed, failed, skipped counts.

## Output

Test report with per-scope results. For visual scope: includes screenshot references and visual analysis summaries. Read-only — modifies nothing except running test commands and saving screenshots.
