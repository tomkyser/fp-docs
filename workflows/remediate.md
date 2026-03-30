<purpose>
Take audit output and dispatch fixes to specialist agents in one orchestrated batch.
Supports plan-only mode (save plan without executing), plan loading by ID/path/number,
and interactive issue selection. Groups consecutive same-command same-file issues into
single operations. Tiered execution order: accuracy first, enrichment second, structural last.
Delegates to specialized agents for each phase: scope assessment, planning, per-issue
specialist execution, verbosity enforcement, citation enforcement, API reference enforcement,
review, and finalization.
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

Check for flags:
- `--plan-only`: Save plan without executing, then STOP
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity enforcement
- `--no-citations`: Skip dedicated citation enforcement
- `--no-api-ref`: Skip dedicated API reference enforcement
</step>

<step name="determine-source">
## 2. Determine Remediation Source

Parse `$ARGUMENTS` to determine which case applies:

**Case A -- Plan ID, path, or number provided:**
1. Run `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate load {id-or-path}`
2. If not found and input is a number, interpret as Nth most recent plan:
   run `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate list` and select by recency index
3. If still not found, show available plans and ask user to specify
4. If found, proceed to step 5 (interactive selection)

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

<step name="scope-assess">
## 4. Scope Assessment
```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess remediate "$ARGUMENTS")
if [[ "$SCOPE" == @file:* ]]; then SCOPE=$(cat "${SCOPE#@file:}"); fi
```
Parse JSON for: complexity, targets, trackerRequired, delegationPlan.

Scope assessment uses the remediation plan to determine:
- Total issue count and affected file count
- Whether a tracker is needed for this batch operation

If trackerRequired:
```bash
TRACKER_ID=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --command remediate --complexity ${complexity})
```
</step>

<step name="interactive-selection">
## 5. Interactive Selection

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

<step name="execute-primary">
## 6. Write Phase (Primary Operations -- Per-Issue Specialist Spawns)

For each selected issue in execution order:

1. **Group consecutive issues** sharing same command AND target file into single operations
2. **For each group**, resolve the appropriate specialist agent and spawn:
   ```bash
   SPECIALIST_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model {specialist-agent} --raw)
   ```
   ```
   Agent(
     prompt="Execute {command} operation for remediation -- PRIMARY OPERATION ONLY.
       Issues: {grouped issue descriptions}
       Target file: {target}
       Audit findings context: {relevant audit findings}
       Tracker: {TRACKER_ID or 'none'}

       <files_to_read>
       - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
       - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
       </files_to_read>

       Execute the remediation fix per the issue descriptions.
       Use Mode: DELEGATED.

       IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations, API refs).
       Those are handled by dedicated agents in subsequent steps.
       Do NOT run stages 4-8.
       Return a Primary Operation Result listing files modified and a brief summary.

       If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step write --agent {specialist} --status done --detail {summary}",
     agent="{specialist-agent}",
     model="${SPECIALIST_MODEL}"
   )
   ```
3. **Collect Delegation Result** from each subagent (summary metrics only -- context offloading)
4. **Mark completed:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate update {plan-id} '{"completed":["iss-001","iss-002"]}'`
5. **If specialist fails:** Mark failed issues and continue with remaining issues

Merge file lists across all specialist spawns for enforcement agents.
</step>

<step name="enforce-verbosity">
## 7. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity --raw)
```
Spawn ONE dedicated verbosity agent for ALL files from write phase:
```
Agent(
  prompt="Enforce verbosity on files modified by remediate operation.
    Target files: {all files from write phase -- merged across specialists}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Identify the corresponding source file(s) via source-map lookup
    2. Build scope manifest: count every documentable item in source
    3. Compare against documentation: verify 100% coverage
    4. Scan for banned summarization phrases
    5. If gaps found: fix them (add missing items, expand summaries)

    Return a Verbosity Enforcement Result with per-file status (PASS/FIXED/FAIL).

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step verbosity --agent fp-docs-verbosity --status done --detail {summary}",
  agent="fp-docs-verbosity",
  model="${VERBOSITY_MODEL}"
)
```
</step>

<step name="enforce-citations">
## 8. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn ONE dedicated citations agent for ALL files:
```
Agent(
  prompt="Enforce citations on files modified by remediate operation.
    Target files: {all files from write phase -- merged across specialists}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Parse existing citation blocks
    2. Check staleness against current source (Fresh/Stale/Drifted/Broken/Missing)
    3. Update stale/drifted citations with current source
    4. Generate missing citations for undocumented elements
    5. Verify citation format compliance

    Return a Citation Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step citations --agent fp-docs-citations --status done --detail {summary}",
  agent="fp-docs-citations",
  model="${CITATIONS_MODEL}"
)
```
</step>

<step name="enforce-api-refs">
## 9. API Reference Enforcement (Stage 3 -- Dedicated)
Skip if `--no-api-ref` flag is set or `api_ref.enabled` is false.
Also skip if no target files require API Reference sections (per doc type).

```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn dedicated API refs agent:
```
Agent(
  prompt="Enforce API references on files modified by remediate operation.
    Target files: {files from write phase that require API Reference}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file that requires API Reference:
    1. Verify API Reference section exists
    2. Extract function signatures from source code
    3. Compare against documented signatures
    4. Update stale rows, add missing rows
    5. Verify provenance column is populated

    Return an API Reference Enforcement Result with per-file status.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step api-refs --agent fp-docs-api-refs --status done --detail {summary}",
  agent="fp-docs-api-refs",
  model="${APIREFS_MODEL}"
)
```
</step>

<step name="execute-review-phase">
## 10. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator for ALL modified files:
```
Agent(
  prompt="Validate all files modified by the remediate operation.
    Target files: {all files from write phase}
    Tracker: {TRACKER_ID or 'none'}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run sanity-check (stage 4) on all target files.
    Run 10-point verification (stage 5) on all target files.
    Return a Pipeline Validation Report.

    If tracker exists: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update ${TRACKER_ID} --step review --agent fp-docs-validator --status done --detail {summary}",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
If sanity-check confidence is LOW: retry once. If still LOW, report without committing.
</step>

<step name="execute-finalize-phase">
## 11. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation remediate --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update (one combined entry)
#   Stage 7: Index update (conditional -- only if structural changes)
#   Stage 8: Docs commit and push: "fp-docs: remediate -- {N} issues resolved from {plan-id}"
# action == "complete" -> done, extract completion marker
# action == "blocked" -> HALLUCINATION detected, halt
```

If tracker exists:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker update ${TRACKER_ID} --step finalize --agent workflow --status done --detail '{commit-hash}'
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker complete ${TRACKER_ID}
```
</step>

<step name="report">
## 12. Remediation Report

Generate report with sections:
- **Plan ID** and issue counts (completed/total)
- **Completed**: Per-issue status with resolution command
- **Failed**: Per-issue status with failure reason
- **Skipped**: Per-issue status (user deselected)
- **Enforcement**: Verbosity, citations, API refs results
- **Validation**: Sanity-check and verification results
- **Finalization**: Changelog, index, docs commit status
- **Plan Status**: complete, partial, or failed

Update plan status: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" remediate update {plan-id} '{"status":"{status}"}'`

Include completion marker verbatim in final report.
</step>

</process>

<success_criteria>
- [ ] Remediation source correctly determined (session audit, saved plan, or plan-only)
- [ ] Plan built with tiered execution order
- [ ] User confirmation obtained via interactive selection
- [ ] Specialist agents dispatched for each issue group (step 6)
- [ ] Failed issues logged without aborting remaining work
- [ ] Verbosity enforcement completed by dedicated agent (step 7)
- [ ] Citation enforcement completed by dedicated agent (step 8)
- [ ] API reference enforcement completed by dedicated agent (step 9)
- [ ] Pipeline stages 4-5 completed by validator agent (step 10)
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop (step 11)
- [ ] Tracker updated at each phase (if created)
- [ ] Single finalize phase with combined changelog entry
- [ ] Remediation report generated with per-issue status
</success_criteria>
