# Test — Instruction

## Inputs
- `$ARGUMENTS`: Test scope (rest-api|cli|templates|all)
- Preloaded modules: docs-mod-standards, docs-mod-project, docs-mod-validation

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

6. Generate test report with passed, failed, skipped counts.

## Output

Test report. Read-only — modifies nothing except running test commands.
