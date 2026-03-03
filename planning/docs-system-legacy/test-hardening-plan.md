# Implementation Plan: Harden cc-test.md Against Environmental Failures

> **Created**: 2026-02-28
> **Status**: IMPLEMENTED
> **Branch**: `task--theme-dev-docs`
> **Commit**: `9b59bccb82` — includes both planned test-hardening and approved zero-tolerance sanity-check enhancements

---

## Problem Statement

The `/docs-test` command (`cc-test.md`) can misclassify environmental failures as documentation failures. When a CLI command fails because ddev is down, or an API test fails because curl can't connect, the system may classify these as FAIL (doc is wrong) instead of ERROR (environment issue). Since FAILs trigger doc revisions and lower sanity-check confidence, this creates a pathway where accurate documentation gets "corrected" to match a broken environment.

The existing `ERROR ≠ confidence impact` rule (line 195) is the right safeguard, but only works when errors are correctly classified as ERROR in the first place. This plan adds the classification precision needed to make that rule effective.

---

## Design Principles

1. **Classification before execution** — validate each test category can run before running its tests
2. **Fail-safe defaults** — ambiguous results default to SKIP or ERROR, never FAIL
3. **Graceful degradation** — if one category can't run, skip it and run the others
4. **No new flags** — all changes are internal instruction logic; no user-facing additions needed
5. **Nested mode parity** — every safeguard that works in standalone mode must also work in nested mode

---

## Files Modified

| File | Edits | Nature | Status |
|------|-------|--------|--------|
| `docs/claude-code-docs-system/instructions/cc-test.md` | 11 | Primary — all hardening changes | Done |
| `docs/claude-code-docs-system/instructions/cc-sanity-check.md` | 2 planned + zero-tolerance rewrite | Alignment + approved enhancement | Done |
| `docs/claude-code-docs-system/instructions/cc-add.md` | 2 | Cascaded from zero-tolerance (confidence levels) | Done |
| `docs/claude-code-docs-system/instructions/cc-audit.md` | 2 | Cascaded from zero-tolerance (ASSUMPTION → UNVERIFIED) | Done |
| `docs/claude-code-docs-system/instructions/cc-auto-revise.md` | 1 | Cascaded from zero-tolerance (confidence display) | Done |
| `docs/claude-code-docs-system/instructions/cc-auto-update.md` | 2 | Cascaded from zero-tolerance (confidence levels) | Done |
| `docs/claude-code-docs-system/instructions/cc-revise.md` | 2 | Cascaded from zero-tolerance (confidence levels) | Done |
| `docs/docs-management.md` | 1 | Updated sanity-check description | Done |

### Sanity-Check Zero-Tolerance Enhancement (approved separately)

During implementation, the sanity-check agent also applied a broader enhancement to `cc-sanity-check.md` that was approved in a separate thread. This enhancement:

- **Replaced ASSUMPTION with UNVERIFIED** — claims that can't be verified are now blocking, not passable
- **Removed MEDIUM confidence** — only HIGH (all verified) or LOW (issues found) remain
- **Added Step 2b: Deep Verification** — UNVERIFIABLE claims trigger call-chain tracing, codebase search, and related-file checks before final classification
- **Added Zero-Tolerance Principle section** — explicit philosophy: every factual claim must be provably accurate or tagged `[NEEDS INVESTIGATION]`
- **Added `[NEEDS INVESTIGATION]` tagging** — UNVERIFIED claims must be explicitly tagged in the doc text so readers know
- **Cascaded confidence changes** to all 5 calling instructions (cc-add, cc-audit, cc-auto-revise, cc-auto-update, cc-revise) and docs-management.md

---

## Implementation Steps

### Step 1: Add Environment Availability State to Step 2

**File**: `cc-test.md`
**Location**: Step 2 (lines 40–66)
**Issue addressed**: HIGH #1 (no per-category gating), HIGH #3 (nested mode fallback), MEDIUM #6 (no timeouts), LOW #8 (abort vs. degrade)

**What to change**:

Replace the current "Verify environment accessibility" block (lines 62–66) and the "If no Local Development Environment block" block (lines 55–60) with a comprehensive environment availability check that:

1. Records an **availability state** for the environment as a whole and per category
2. Defines explicit behavior when the env block is missing in nested mode
3. Uses timeouts on all preflight checks
4. Specifies graceful degradation (skip env-dependent categories, still run file tests)

**New content to replace lines 55–66** (the two blocks starting with "If no Local Development Environment block" and "Verify environment accessibility"):

```markdown
**If no Local Development Environment block is found:**

1. **Standalone mode**: Inform the user that the block is required for testing. Point them to the setup guide in `docs-management.md`. Ask if they want to provide environment details manually for this session. If manual: accept the values and proceed. If not: abort with instructions.
2. **Nested mode**: Return immediately with `{ tests: 0, skipped: 'all', reason: 'no environment configuration found in CLAUDE.md' }`. Do NOT attempt user interaction.

**Verify environment accessibility and set category availability:**

Run these preflight checks to determine which test categories can execute. Record the result as an **availability state** — a per-category flag that gates test execution in Step 4.

| Check | Command | Timeout | Success | On Failure |
|-------|---------|---------|---------|------------|
| **Site reachable** | `curl --max-time 10 -sk [local-url] -o /dev/null -w '%{http_code}'` | 10s | HTTP 200 or 301 | Mark `api` and `browser` categories as UNAVAILABLE |
| **WP-CLI responsive** | `timeout 30 [wp-cli-access] eval 'echo "WP_CLI_OK";' 2>/dev/null \| tail -1` | 30s | Output ends with `WP_CLI_OK` | Mark `cli` category as UNAVAILABLE |
| **REST API functional** | `curl --max-time 10 -sk [rest-api-base]/wp-json/ -o /dev/null -w '%{http_code}'` | 10s | HTTP 200 | Mark `api` category as UNAVAILABLE |
| **Browser MCP responsive** | Attempt `browser_navigate` to `about:blank` | 15s | Navigation succeeds | Mark `browser` category as UNAVAILABLE |

**Rules:**

- The `file` category is ALWAYS available — it requires only disk access, no running environment.
- If `--skip-browser` is set or browser automation is `none`: mark `browser` as UNAVAILABLE (not an error — intentional skip).
- Browser MCP preflight is only attempted if the env block lists a browser automation tool AND `--skip-browser` is not set.
- If ALL environment-dependent categories (cli, api, browser) are UNAVAILABLE:
  - **Standalone mode**: Report the failures, ask the user to verify their environment is running. Offer to run file tests only or abort.
  - **Nested mode**: Run file tests only. Return results with a note: `environment_note: '[category]: unavailable — [reason]'` for each unavailable category.

**Report the availability state** in the Environment section of the final report (see Report Format).
```

---

### Step 2: Add HTTP Status Classification Table to API Tests

**File**: `cc-test.md`
**Location**: API Tests section (lines 130–141)
**Issue addressed**: HIGH #2 (no HTTP status-to-classification mapping)

**What to change**:

After the existing content about constructing URLs and sending requests (lines 132–139), replace the simple "Verify: HTTP status code matches expected" instruction and the auth SKIP note with a classification table.

**Replace lines 138–141** with:

```markdown
3. **Classify the HTTP response** using this table:

| HTTP Status | Classification | Meaning |
|-------------|---------------|---------|
| `000` or curl error | **ERROR** | Network/connection failure — environment issue |
| `200`, `201`, `204` matching expected | **PASS** | Endpoint exists and responds as documented |
| `200` but wrong response schema | **FAIL** | Endpoint exists but response structure doesn't match docs |
| `301`, `302` | **SKIP** | Redirect — cannot confirm endpoint behavior without following |
| `400` | **FAIL** or **SKIP** | FAIL if docs say no params required; SKIP if request was missing required params the test didn't provide |
| `401` | **SKIP** | Authentication required — cannot test without credentials |
| `403` | **SKIP** | Access denied — security plugin or permissions issue |
| `404` | **FAIL** | Route not registered — doc claims a non-existent endpoint |
| `405` | **FAIL** | Method not allowed — doc has wrong HTTP method |
| `500`, `502`, `503` | **ERROR** | Server error — environment issue, not a doc issue |
| Any other status | **ERROR** | Unexpected — classify as environment issue |

4. If response schema is documented and status is 200: check that response JSON contains the expected keys.

**Important**: A `404` from WordPress REST API (JSON response with `code: "rest_no_route"`) confirms the route does not exist — this is a valid **FAIL**. A `404` that returns HTML (e.g., a themed 404 page) may indicate the REST API itself is not reachable at that URL — classify as **ERROR**.
```

---

### Step 3: Add Category Gating to Step 4

**File**: `cc-test.md`
**Location**: Step 4 opening (lines 95–104)
**Issue addressed**: HIGH #1 (per-category preflight gating)

**What to change**:

After the existing "Run tests by category in order" instruction, add a gating rule that references the availability state from Step 2.

**Insert after line 97** (after "Run tests by category in order: **file → cli → api → browser**."):

```markdown
**Before running each category**, check its availability state from Step 2:

- If the category is **AVAILABLE**: run its tests normally.
- If the category is **UNAVAILABLE**: SKIP all tests in this category with the reason recorded in Step 2. Record each skipped test individually in the results with result `SKIP` and details from the availability check.

This ensures environmental issues detected in preflight are never misclassified as documentation failures.
```

---

### Step 4: Add Canonical WP-CLI Command Patterns to CLI Tests

**File**: `cc-test.md`
**Location**: CLI Tests section (lines 114–128)
**Issue addressed**: MEDIUM #4 (WP-CLI JSON parsing fragility)

**What to change**:

Replace the existing WP-CLI command table (lines 118–126) and the Note about noisy output (line 128) with a table that includes reliable command patterns with built-in noise filtering.

**Replace lines 116–128** with:

```markdown
Use the WP-CLI access command from the environment config. All commands MUST include noise filtering to handle deprecation warnings, VIP notices, and PHP notices that precede the actual output.

**Canonical command patterns:**

| Claim | Command | Parse Strategy |
|-------|---------|----------------|
| Post type registered | `[wp-cli] post-type list --format=csv --fields=name 2>/dev/null` | Grep for slug in output lines (CSV avoids JSON parsing issues) |
| Taxonomy registered | `[wp-cli] taxonomy list --format=csv --fields=name 2>/dev/null` | Grep for slug in output lines |
| Hook registered | `[wp-cli] eval 'echo has_filter("[hook_name]") ? "HOOK_YES" : "HOOK_NO";' 2>/dev/null \| tail -1` | Check last line for `HOOK_YES` or `HOOK_NO` |
| ACF field group loaded | `[wp-cli] eval 'echo acf_get_field_group("[group_key]") ? "ACF_YES" : "ACF_NO";' 2>/dev/null \| tail -1` | Check last line for `ACF_YES` or `ACF_NO` |
| Shortcode registered | `[wp-cli] eval 'echo shortcode_exists("[tag]") ? "SC_YES" : "SC_NO";' 2>/dev/null \| tail -1` | Check last line for `SC_YES` or `SC_NO` |
| Meta key in use | `[wp-cli] eval 'global $wpdb; echo $wpdb->get_var("SELECT COUNT(*) FROM $wpdb->postmeta WHERE meta_key = \"[key]\" LIMIT 1");' 2>/dev/null \| tail -1` | See meta key classification below |
| Option exists | `[wp-cli] option get [option_name] 2>/dev/null \| tail -1` | Non-empty output = exists |

**Key principles:**
- Use `--format=csv` instead of `--format=json` for list commands — CSV is resilient to prefixed noise; JSON is not.
- Use `2>/dev/null` to suppress stderr (PHP notices, deprecation warnings).
- Use `| tail -1` for `eval` commands to extract the final line (the actual return value).
- Use sentinel values (`HOOK_YES`/`HOOK_NO`) instead of `var_dump()` — sentinels are unambiguous; `var_dump` output can be corrupted by interleaved warnings.
- Wrap all commands with `timeout 30` to prevent hangs from stalled containers.

**Timeout handling**: If any WP-CLI command times out (exit code 124), classify the test as **ERROR** with reason "WP-CLI command timed out after 30s."
```

---

### Step 5: Add Meta Key Classification Rules

**File**: `cc-test.md`
**Location**: Immediately after the CLI Tests section (after the new content from Step 4)
**Issue addressed**: MEDIUM #5 (ambiguous empty-database semantics)

**Insert new subsection** after the CLI command patterns table:

```markdown
**Meta key classification:**

A `COUNT(*)` query returning `0` is ambiguous — the meta key may be valid but unused in this environment, or it may be fabricated. Apply this classification:

| Count | Source Code Check | Classification |
|-------|-------------------|----------------|
| `> 0` | — | **PASS** — meta key exists and is in use |
| `0` | Meta key string appears in source file (via grep) | **SKIP** — meta key is valid but no data exists in this environment |
| `0` | Meta key string does NOT appear in source file | **FAIL** — meta key appears to be fabricated |
| Error/timeout | — | **ERROR** — environment issue |

When the source file is available (it usually is — mapped in Step 3), always cross-reference a zero-count result against the source before classifying. This prevents fresh or staging environments from generating false FAILs.
```

---

### Step 6: Add Timeout Guidance

**File**: `cc-test.md`
**Location**: Step 4 opening, after the category gating rule (from Step 3 of this plan)
**Issue addressed**: MEDIUM #6 (no timeout handling)

**Insert after the category gating rule**:

```markdown
**Timeout policy:**

| Category | Timeout per test | On timeout |
|----------|-----------------|------------|
| `file` | N/A (filesystem operations are instant) | — |
| `cli` | 30 seconds | **ERROR** — "WP-CLI command timed out" |
| `api` | 10 seconds (curl `--max-time 10`) | **ERROR** — "API request timed out" |
| `browser` | 15 seconds (navigation timeout) | **ERROR** — "browser navigation timed out" |

Timeouts are always classified as **ERROR**, never **FAIL**. A timeout means the environment couldn't respond, not that the documentation is wrong.
```

---

### Step 7: Add Browser MCP Preflight

**File**: `cc-test.md`
**Location**: Browser Tests section (lines 143–157)
**Issue addressed**: MEDIUM #7 (browser MCP configured but not functional)

**Replace lines 145–147** with:

```markdown
**Requires**: Playwright MCP or Chrome DevTools MCP configured in the environment block.

If `--skip-browser` is set or browser automation is `none`: SKIP all browser tests with reason "browser testing not enabled."

If browser automation is configured but the browser category was marked UNAVAILABLE in Step 2 (MCP preflight failed): SKIP all browser tests with reason "browser MCP not responding."
```

---

### Step 8: Update Nested Mode Steps

**File**: `cc-test.md`
**Location**: Steps (Nested Mode) section (lines 177–195)
**Issue addressed**: HIGH #3 (nested mode fallback), LOW #10 (escape hatch in cc-test.md)

**Replace lines 179–185** with:

```markdown
When called from `cc-sanity-check.md` as a sub-instruction (triggered by `--enable-testing` on the calling command):

1. **Receive context** from sanity-check: the list of documentation files being checked, their mapped source files, and any issues already identified in Steps 1–3.
2. **Load Environment Configuration** — same as standalone Step 2, with these nested-mode overrides:
   - If no Local Development Environment block is found: return immediately with `{ tests: 0, skipped: 'all', reason: 'no environment configuration' }`. Do NOT prompt the user.
   - If the environment is unreachable (all preflight checks fail): return immediately with `{ tests: 0, skipped: 'all', reason: 'environment not accessible' }`. Do NOT prompt the user.
   - If some categories are unavailable: proceed with available categories. Include unavailability reasons in the returned results.
3. **Discover Test Targets** — same as standalone Step 3, scoped to the docs sanity-check is reviewing.
4. **Execute Tests** — same as standalone Step 4 (including category gating and timeout policies).
5. **Return results** to sanity-check for integration into its report. Do NOT output a standalone report.
```

---

### Step 9: Add Error Deduplication to Multi-Agent Testing

**File**: `cc-test.md`
**Location**: Multi-Agent Testing section (lines 264–273)
**Issue addressed**: LOW #9 (multi-agent error aggregation)

**Insert after line 273** (after "Aggregate all agent results into the final report."):

```markdown
7. **Deduplicate environmental errors**: If multiple agents report ERROR for the same root cause (e.g., "WP-CLI command timed out", "API request timed out"), consolidate into a single environment note in the report rather than listing the same error on every affected test.
```

---

### Step 10: Update Report Format — Add Environment Availability

**File**: `cc-test.md`
**Location**: Report Format section (lines 199–248)
**Issue addressed**: Supports all fixes by making availability visible in output

**Replace lines 204–209** (the Environment subsection of the report template) with:

```markdown
### Environment
- Local URL: [url] — [reachable | unreachable]
- WordPress root: [path]
- WP-CLI: [access command] — [responsive | unavailable: reason]
- REST API: [base url] — [functional | unavailable: reason]
- Browser automation: [tool — responsive | tool — unavailable: reason | not configured]
```

---

### Step 11: Update Notes Section

**File**: `cc-test.md`
**Location**: Notes section (lines 277–287)
**Issue addressed**: Consolidates guidance, removes now-redundant notes

**Replace lines 279–287** with:

```markdown
- This instruction **executes commands** against the live local environment. It is NOT read-only.
- Browser tests require Playwright MCP or Chrome DevTools MCP. If neither is configured or the MCP is unresponsive, browser tests are SKIPPED — not failed.
- All WP-CLI commands use the access pattern from the Local Development Environment block (e.g., `ddev wp`, `lando wp`, `wp`).
- REST API calls use the local URL and SSL settings from the Local Development Environment block.
- The Local Development Environment block is **developer-specific** — each team member configures their own in their project's `CLAUDE.md`.
- **Classification hierarchy**: When in doubt, classify as **SKIP** (cannot test) over **ERROR** (env issue) over **FAIL** (doc is wrong). Reserve FAIL exclusively for claims that clearly contradict what the live environment shows. This hierarchy prevents environmental problems from triggering incorrect doc revisions.
- All WP-CLI commands use `--format=csv` (not JSON) for list commands and sentinel echo values (not `var_dump`) for eval commands. This avoids JSON parsing failures caused by PHP notices prepended to output.
- All environment-dependent commands have explicit timeouts (see Step 4). Timeouts are always ERROR, never FAIL.
- Browser tests should be conservative: verify pages load and expected elements exist. Do not attempt complex interaction flows unless specifically requested.
```

---

### Step 12: Align cc-sanity-check.md Nested Mode Language

**File**: `cc-sanity-check.md`
**Location**: Step 4 (lines 64–82) and Notes (line 170)
**Issue addressed**: LOW #10 (escape hatch alignment)

**Change 1**: Replace line 170 with:

```markdown
- When `--enable-testing` is active, the testing step requires a running local development environment and a `## Local Development Environment` block in the project's `CLAUDE.md`. If either is missing, the testing step returns immediately with zero tests and a skip reason — it does not fail and does not lower confidence. See `cc-test.md` nested mode for the full fallback behavior.
```

**Change 2**: In Step 4 (lines 66–81), after "Call `cc-test.md` in nested mode", insert clarifying sentence:

After line 68 ("Call `cc-test.md` in nested mode: Execute runtime validations..."), insert:

```markdown
`cc-test.md` handles all environment availability checks internally. If the environment is unavailable, it returns `{ tests: 0, skipped: 'all', reason: '...' }` — integrate this gracefully into the report rather than treating it as a failure.
```

---

## Implementation Order

Execute steps 1–12 sequentially. Steps 1–11 modify `cc-test.md`; step 12 modifies `cc-sanity-check.md`.

| Order | Step | Target | Severity Addressed |
|-------|------|--------|--------------------|
| 1 | Environment availability state | `cc-test.md` Step 2 | HIGH #1, #3; MEDIUM #6; LOW #8 |
| 2 | HTTP status classification | `cc-test.md` API Tests | HIGH #2 |
| 3 | Category gating in Step 4 | `cc-test.md` Step 4 | HIGH #1 |
| 4 | Canonical WP-CLI patterns | `cc-test.md` CLI Tests | MEDIUM #4 |
| 5 | Meta key classification | `cc-test.md` CLI Tests | MEDIUM #5 |
| 6 | Timeout guidance | `cc-test.md` Step 4 | MEDIUM #6 |
| 7 | Browser MCP preflight | `cc-test.md` Browser Tests | MEDIUM #7 |
| 8 | Nested mode overrides | `cc-test.md` Nested Mode | HIGH #3, LOW #10 |
| 9 | Error deduplication | `cc-test.md` Multi-Agent | LOW #9 |
| 10 | Report format update | `cc-test.md` Report Format | Supports all |
| 11 | Notes section update | `cc-test.md` Notes | Consolidation |
| 12 | Sanity-check alignment | `cc-sanity-check.md` | LOW #10 |

---

## Verification Checklist

- [x] `cc-test.md` compiles as valid markdown with no broken internal references
- [x] All 10 issues from the analysis are addressed (map each to its step)
- [x] No new flags were added (user-facing test interface unchanged)
- [x] Nested mode has explicit no-user-interaction paths for every failure case
- [x] The classification hierarchy (SKIP > ERROR > FAIL) is consistent throughout
- [x] WP-CLI command patterns use CSV not JSON, sentinels not var_dump
- [x] Every timeout has an explicit duration and ERROR classification
- [x] Report format includes availability state
- [x] `cc-sanity-check.md` nested mode language aligns with `cc-test.md` changes
- [x] Zero-tolerance changes cascade correctly to all 5 calling instructions
- [x] `docs-management.md` sanity-check description updated

---

## Post-Implementation

1. **Consider running** `/docs-test docs/09-api/ --type api` to validate the new HTTP classification against live REST endpoints
2. **Update MEMORY.md** to reflect this enhancement is complete
