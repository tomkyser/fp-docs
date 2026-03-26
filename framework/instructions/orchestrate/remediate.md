# Remediate -- Instruction

> Read by the orchestrate engine when `/fp-docs:remediate` is invoked. Takes audit output and dispatches to specialist engines in one orchestrated batch.

---

## Inputs

- `$ARGUMENTS`: One of:
  - *(empty)* -- Use session audit results from current context
  - `--plan-only` -- Save a remediation plan without executing
  - `{plan-id}` -- Load a saved plan by ID (e.g., `rem-a1b2c3d4`)
  - `{plan-path}` -- Load a saved plan by absolute or relative path
  - `{plan-number}` -- Load the Nth most recent plan (e.g., `1` = most recent, `2` = second most recent)
- Preloaded modules: mod-orchestration, mod-standards, mod-project

## Steps

### 1. Determine Remediation Source

Parse `$ARGUMENTS` to determine which case applies:

**Case A -- Plan ID, path, or number provided:**
1. Run `fp-tools.cjs remediate load {id-or-path}` to load the plan
2. If not found and input looks like a number, interpret as Nth most recent plan: run `fp-tools.cjs remediate list` and select by recency index
3. If still not found, show available plans via `fp-tools.cjs remediate list` and ask user to specify
4. If found, proceed to Step 3

**Case B -- `--plan-only` flag present:**
1. Check session context for audit results (look for audit report with issue categories and findings)
2. If no audit results exist, tell user: "No audit results found in session. Run `/fp-docs:audit` first, then `/fp-docs:remediate --plan-only` to save a plan."
3. If audit results exist, proceed to Step 2, save the plan, display summary, and **stop** (do not execute)

**Case C -- No arguments (default):**
1. Check session context for audit results
2. If no audit results exist, tell user: "No audit results found in session. Run `/fp-docs:audit` first to identify issues, then run `/fp-docs:remediate` to fix them."
3. If audit results exist, proceed to Step 2, then continue to Step 3 for execution

### 2. Build Remediation Plan

From the session audit results:

1. Extract each issue found during the audit. For each issue capture:
   - File path (the documentation file with the issue)
   - Category (MISSING, STALE, BROKEN, ORPHAN, CITATION COVERAGE, CITATION HEALTH, HALLUCINATION, etc.)
   - Severity (CRITICAL, HIGH, MEDIUM, LOW)
   - Description (what is wrong)
   - Recommended command (the `/fp-docs:` command best suited to resolve it -- this was determined by LLM judgment during the audit per D-01)

2. Assign sequential issue IDs: `iss-001`, `iss-002`, `iss-003`, etc.

3. Assign dependency tiers based on category precedence (per D-05):
   - **Tier 1 (accuracy):** HALLUCINATION, STALE -- fix source content accuracy first
   - **Tier 2 (enrichment):** CITATION COVERAGE, CITATION HEALTH -- after content is accurate, enrich with citations
   - **Tier 3 (structural):** MISSING, BROKEN, ORPHAN -- structural issues last to avoid cascading re-work

4. Within each tier, order by file dependency:
   - Source docs before dependent docs
   - Parent docs before child docs
   - Files with more downstream dependents first

5. Build the `execution_order` array from the tier + dependency ordering

6. Set all issues to `selected: true` by default

7. Save the plan via `fp-tools.cjs remediate save '{plan-json}'`

8. If `--plan-only` (Case B): Display the plan summary showing issue count, tiers, and execution order. Tell user:
   - "Plan saved. Run `/fp-docs:remediate {plan-id}` to execute."
   - "You can `/clear` first to free context, then run `/fp-docs:remediate {plan-id}` from a clean session."
   - **Stop here -- do not proceed to Step 3.**

### 3. Interactive Selection (per D-13)

Display the remediation plan as a table:

```
| # | File | Category | Severity | Command | Selected |
|---|------|----------|----------|---------|----------|
| 1 | docs/06-helpers/posts.md | STALE | CRITICAL | /fp-docs:revise | Yes |
| 2 | docs/06-helpers/posts.md | CITATION HEALTH | HIGH | /fp-docs:citations update | Yes |
| 3 | docs/04-components/hero.md | MISSING | MEDIUM | /fp-docs:add | Yes |
```

Show execution order (grouped by tier):
- **Tier 1 (accuracy):** Issues #1
- **Tier 2 (enrichment):** Issues #2
- **Tier 3 (structural):** Issues #3

Ask user how to proceed:
- `yes` / `proceed` / `all` -- Execute all selected issues
- `skip N` or `skip N,M` -- Deselect specific issues by number
- `only N` or `only N,M` -- Select only specific issues (deselect all others)
- `cancel` -- Abort remediation

Update the plan with the user's selection via `fp-tools.cjs remediate update {plan-id} '{updated-selection}'`.

**Single-issue shortcut:** If the plan has only 1 issue, skip the interactive selection and proceed directly to execution.

### 4. Execute Remediation

For each selected issue in execution order:

1. **Group consecutive issues** that share the same recommended command AND target file into a single operation. For example, two STALE issues on the same file using `/fp-docs:revise` become one revise operation with combined context.

2. **For each group**, spawn the appropriate specialist engine as a subagent:
   - Use `Mode: DELEGATED` in the delegation prompt
   - Pass the operation name, instruction file path, target file(s), and context about the specific audit findings
   - Include the original issue descriptions so the specialist knows exactly what to fix

3. **Collect Delegation Result** from each subagent:
   - Extract summary: files modified, enforcement stage status, issue count
   - Discard detailed descriptions (context offloading per D-09)

4. **Mark completed issues** via `fp-tools.cjs remediate update {plan-id} '{"completed":["iss-001","iss-002"]}'`

5. **If a specialist fails**, mark the failed issues via `fp-tools.cjs remediate update {plan-id} '{"failed":["iss-003"]}'` and continue with remaining issues. Do not abort the entire remediation.

6. **After all groups complete**, spawn ONE validate engine in `PIPELINE-VALIDATION` mode for all modified files (stages 4-5: sanity-check + 10-point verification)

7. **Execute finalization** as a single batch:
   - Stage 6 (Changelog): One combined entry covering all remediation fixes
   - Stage 7 (Index): Conditional -- only if structural changes occurred
   - Stage 8 (Docs Commit): One commit for all changes, message: `fp-docs: remediate -- {N} issues resolved from {plan-id}`

### 5. Report

Generate the Remediation Report:

```
## Remediation Report

**Plan ID:** {plan-id}
**Issues:** {completed}/{total} resolved

### Completed
- iss-001: docs/06-helpers/posts.md (STALE) -- RESOLVED via /fp-docs:revise
- iss-002: docs/06-helpers/posts.md (CITATION HEALTH) -- RESOLVED via /fp-docs:citations update

### Failed
- iss-003: docs/04-components/hero.md (MISSING) -- FAILED: {reason}

### Skipped
- iss-004: docs/08-api/rest.md (BROKEN) -- SKIPPED (user deselected)

### Validation
- Sanity-check: {PASS|FAIL} ({confidence})
- Verification: {PASS|FAIL} ({score}/10)

### Finalization
- Changelog: {updated|skipped}
- Index: {updated|skipped}
- Docs commit: {committed|skipped} ({commit hash if committed})

### Plan Status
{complete|partial|failed}
```

Update the plan status via `fp-tools.cjs remediate update {plan-id} '{"status":"{status}"}'`:
- `complete` -- All selected issues resolved
- `partial` -- Some issues resolved, some failed or skipped
- `failed` -- All issues failed

## Output

Remediation Report with per-issue status, validation results, and finalization summary.
