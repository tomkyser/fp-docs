<purpose>
Take audit output and dispatch fixes to specialist engines in one orchestrated batch.
Supports plan-only mode (save plan without executing), plan loading by ID/path/number,
and interactive issue selection. Groups consecutive same-command same-file issues into
single operations. Tiered execution order: accuracy first, enrichment second, structural last.
Write operation -- triggers pipeline.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init remediate "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: pipeline config, operation context, remediation plan (if loading existing).
</step>

<step name="determine-source">
## 2. Determine Remediation Source

Parse `$ARGUMENTS` to determine which case applies:

**Case A -- Plan ID, path, or number provided:**
1. Run `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate load {id-or-path}`
2. If not found and input is a number, interpret as Nth most recent plan:
   run `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate list` and select by recency index
3. If still not found, show available plans and ask user to specify
4. If found, proceed to step 4 (interactive selection)

**Case B -- `--plan-only` flag present:**
1. Check session context for audit results (issue categories and findings)
2. If no audit results: report "No audit results found. Run /fp-docs:audit first."
3. If audit results exist: proceed to step 3, save the plan, display summary, and STOP

**Case C -- No arguments (default):**
1. Check session context for audit results
2. If no audit results: report "No audit results found. Run /fp-docs:audit first."
3. If audit results exist: proceed to step 3, then continue to step 4
</step>

<step name="build-plan" condition="cases-B-and-C">
## 3. Build Remediation Plan

From the session audit results:

1. Extract each issue: file path, category, severity, description, recommended command
2. Assign sequential issue IDs: `iss-001`, `iss-002`, etc.
3. Assign dependency tiers based on category precedence:
   - **Tier 1 (accuracy):** HALLUCINATION, STALE -- fix content accuracy first
   - **Tier 2 (enrichment):** CITATION COVERAGE, CITATION HEALTH -- enrich after content is accurate
   - **Tier 3 (structural):** MISSING, BROKEN, ORPHAN -- structural issues last
4. Within each tier, order by file dependency (source before dependent, parent before child)
5. Build execution_order array from tier + dependency ordering
6. Set all issues to `selected: true` by default
7. Save: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate save '{plan-json}'`

If `--plan-only` (Case B): Display plan summary, report plan ID, and STOP.
</step>

<step name="interactive-selection">
## 4. Interactive Selection

Display the remediation plan as a table:

```
| # | File | Category | Severity | Command | Selected |
|---|------|----------|----------|---------|----------|
```

Show execution order grouped by tier. Ask user how to proceed:
- `yes` / `proceed` / `all` -- Execute all selected issues
- `skip N` or `skip N,M` -- Deselect specific issues
- `only N` or `only N,M` -- Select only specific issues
- `cancel` -- Abort remediation

Update plan with selection: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate update {plan-id} '{updated-selection}'`

**Single-issue shortcut:** If only 1 issue, skip selection and proceed directly.
</step>

<step name="execute">
## 5. Execute Remediation

For each selected issue in execution order:

1. **Group consecutive issues** sharing same command AND target file into single operations
2. **For each group**, spawn the appropriate specialist engine as a subagent:
   - Use `Mode: DELEGATED` in the delegation prompt
   - Pass operation name, instruction file path, target files, and audit findings context
3. **Collect Delegation Result** from each subagent (summary metrics only -- context offloading)
4. **Mark completed:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate update {plan-id} '{"completed":["iss-001","iss-002"]}'`
5. **If specialist fails:** Mark failed issues and continue with remaining issues
</step>

<step name="pipeline">
## 6. Pipeline Enforcement

After all specialist groups complete:

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator for ALL modified files (sanity-check + 10-point verification).

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 6  # changelog (one combined entry)
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 7  # index (conditional -- only if structural changes)
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 8  # docs commit: "fp-docs: remediate -- {N} issues resolved from {plan-id}"
```
</step>

<step name="report">
## 7. Remediation Report

Generate report with sections:
- **Plan ID** and issue counts (completed/total)
- **Completed**: Per-issue status with resolution command
- **Failed**: Per-issue status with failure reason
- **Skipped**: Per-issue status (user deselected)
- **Validation**: Sanity-check and verification results
- **Finalization**: Changelog, index, docs commit status
- **Plan Status**: complete, partial, or failed

Update plan status: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate update {plan-id} '{"status":"{status}"}'`
</step>

</process>

<success_criteria>
- [ ] Remediation source correctly determined (session audit, saved plan, or plan-only)
- [ ] Plan built with tiered execution order
- [ ] User confirmation obtained via interactive selection
- [ ] Specialist engines dispatched for each issue group
- [ ] Failed issues logged without aborting remaining work
- [ ] Single validation pass over all modified files
- [ ] Single finalize phase with combined changelog entry
- [ ] Remediation report generated with per-issue status
</success_criteria>
