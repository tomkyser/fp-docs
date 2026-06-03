# Plan: User Guide Command & Pipeline System

> Created: 2026-04-11
> Status: APPROVED DESIGN — ready for implementation
> Prerequisite: scaffolding system (completed), CLAUDE.md (completed)

## Overview

Build the full command/workflow/agent/pipeline infrastructure for user-guide operations. The dev docs system has 23 commands with an 8-stage pipeline enforcing code-level accuracy. The user guide system needs its own commands and a separate pipeline enforcing **UI behavior accuracy** — does the documented workflow match what users actually see?

### Design Principles

1. **Dev-controlled scope**: The system never auto-generates content. Devs specify what to document. The system can infer scope from context (e.g., git diff) but doesn't act without direction.
2. **UI behavior first, code truth backing**: Accuracy is measured from the user's perspective — admin screens, menus, form fields, workflow steps. Code analysis supports this but isn't the primary lens.
3. **Separate pipeline**: User guide enforcement stages are different from dev docs stages. No code citations, no API refs, no verbosity audit. Instead: UI path verification, screenshot currency, jargon checks, completeness checks.
4. **Same architectural patterns**: Commands, workflows, agents, references, routing table — all follow the same patterns as the dev docs system.
5. **Branch-tracked, preview-deployable**: User docs live on the same branch as dev docs (tracking codebase state). Preview deploys via manual trigger or PR label.

---

## Pipeline: User Guide Enforcement (5 Stages, 2 Phases)

### Write Phase (Stages 1-2) — Primary agent

| Stage | Name | What It Checks | Skip? |
|-------|------|----------------|-------|
| 1 | **UI Behavior Verification** | Every documented step must correspond to a real UI path. Verified via Playwright MCP (navigate admin, check element existence) when available, code analysis as fallback (trace menu registrations, admin page hooks, form field definitions). | Never |
| 2 | **Screenshot Currency** | Referenced screenshots must exist as page bundle resources. If `last_verified` is older than the most recent codebase change touching the relevant source files, flag as potentially stale. When Playwright MCP is available, capture fresh screenshots and compare. | Never |

### Finalize Phase (Stages 3-5) — Validation + commit

| Stage | Name | What It Checks | Skip? |
|-------|------|----------------|-------|
| 3 | **Jargon & Tone** | User docs must use plain language. No PHP/JS identifiers, no dev jargon, no function names, no hook names. Audience: non-technical WordPress editors. Flag and fix violations. | Optional (`--no-tone-check`) |
| 4 | **Completeness** | Every workflow page must have: overview, prerequisites, numbered steps, outcome, troubleshooting. Every feature page must have: explanation, location, key fields, common tasks. No orphan steps, no missing outcomes. Validated against page template structure. | Never |
| 5 | **Changelog + Commit** | Update user-guide changelog (if one exists), update `last_verified` frontmatter date on all modified pages, commit to docs repo via `git -C {docs-root}`. | Never |

### Pipeline Config (addition to config.json)

```json
{
  "user_guide_pipeline": {
    "enabled": true,
    "stages": [
      { "id": "ug-ui-verify", "name": "UI Behavior Verification", "phase": "write", "skip": false },
      { "id": "ug-screenshots", "name": "Screenshot Currency", "phase": "write", "skip": false },
      { "id": "ug-tone", "name": "Jargon & Tone Check", "phase": "finalize", "skip": false },
      { "id": "ug-completeness", "name": "Completeness Check", "phase": "finalize", "skip": false },
      { "id": "ug-commit", "name": "Changelog + Commit", "phase": "finalize", "skip": false }
    ],
    "playwright_required": false,
    "playwright_preferred": true,
    "screenshot_staleness_days": 30,
    "jargon_banned_patterns": [
      "\\$[a-z_]+",
      "\\b(function|class|method|hook|filter|action|callback)\\b",
      "\\b(wp_[a-z_]+|add_action|add_filter|do_action|apply_filters)\\b",
      "\\b(array|string|int|bool|null|void)\\b",
      "\\b(REST API|WP-CLI|PHPDoc|ACF)\\b"
    ],
    "required_sections_by_type": {
      "feature-guide": ["what-is", "where-to-find", "how-it-works", "key-fields", "common-tasks"],
      "workflow-walkthrough": ["overview", "before-you-begin", "steps", "what-happens-next", "troubleshooting"],
      "quick-start": ["welcome", "what-youll-learn", "steps", "next-steps"],
      "reference": ["overview", "sections", "notes"],
      "faq": ["questions", "still-need-help"]
    }
  }
}
```

---

## Commands (8 new)

All namespaced as `/fp-docs:ug-*`. Each follows the existing command format: YAML frontmatter + delegation protocol + workflow `@-reference`.

### 1. `/fp-docs:ug-generate` (write)

**Purpose**: Generate a new user guide page. Dev specifies scope; system analyzes code, discovers UI paths, captures screenshots, synthesizes content using the appropriate page template.

**Argument hint**: `"feature or workflow to document" [--type feature-guide|workflow|quick-start|reference|faq] [--no-screenshots] [--plan-only]`

**Workflow steps**:
1. Initialize — `fp-tools init write-op ug-generate "$ARGUMENTS"`
2. Scope inference — If dev gave a vague target (e.g., "the region stuff"), use source-map + code analysis to identify the specific feature area, admin pages, and UI entry points
3. Code analysis — Spawn fp-docs-researcher to analyze the source files backing the feature. Output: admin menu registrations, form fields, custom post types, taxonomy registrations, shortcode handlers — whatever is user-visible
4. UI discovery — Spawn fp-docs-ug-writer with Playwright MCP access. Navigate WP admin to the relevant screens. Capture screenshots of key states (empty, populated, editing). Record the navigation path (Dashboard > X > Y)
5. Content synthesis — Using the page template (from `scaffolds/user-guide/templates/`) and the code analysis + screenshots, write the page as a Hugo page bundle (`content/{section}/{page-name}/index.md` + screenshots)
6. Pipeline enforcement — Stages 1-5 of user guide pipeline
7. Finalize — Commit to docs repo

### 2. `/fp-docs:ug-update` (write)

**Purpose**: Update an existing user guide page after codebase changes. Detects what changed, re-verifies UI paths, refreshes stale screenshots.

**Argument hint**: `"page path or feature name" [--refresh-screenshots] [--no-tone-check]`

**Workflow steps**:
1. Initialize
2. Identify target page(s) — resolve argument to specific `user-guide/content/` page(s)
3. Diff analysis — What changed in the codebase since `last_verified`? (git log on source files mapped to this feature)
4. Impact assessment — Which sections of the page are affected by the changes?
5. Spawn fp-docs-ug-writer — Update affected sections, re-verify UI paths, refresh screenshots if `--refresh-screenshots` or if staleness detected
6. Pipeline enforcement — Stages 1-5
7. Finalize — Commit

### 3. `/fp-docs:ug-screenshot` (write)

**Purpose**: Capture or refresh screenshots for a page. Uses Playwright MCP to navigate WP admin and capture current UI state.

**Argument hint**: `"page path" [--all] [--replace] [--dry-run]`

**Workflow steps**:
1. Initialize
2. Identify target page bundle(s)
3. Parse page for image references — which screenshots does it reference?
4. Spawn fp-docs-ug-writer with Playwright — navigate to each referenced admin screen, capture at current state
5. Compare with existing screenshots (if `--replace`, always overwrite; otherwise only replace if different)
6. Update `last_verified` frontmatter
7. Commit

### 4. `/fp-docs:ug-validate` (read)

**Purpose**: Validate user guide accuracy. Walk every documented step against current UI state. Report stale content, broken paths, outdated screenshots.

**Argument hint**: `"page path or section" [--depth quick|standard|deep] [--all]`

**Workflow steps**:
1. Initialize
2. Identify target pages
3. Spawn fp-docs-ug-validator — For each page:
   - Parse documented steps and UI paths
   - If Playwright available: navigate each path, verify elements exist
   - If not: trace code to verify menu registrations, form fields, hooks still exist
   - Check screenshot references resolve to actual files
   - Check `last_verified` staleness
4. Produce validation report with per-page status (PASS/WARN/FAIL)

### 5. `/fp-docs:ug-audit` (read)

**Purpose**: Audit coverage gaps. Compare user-visible features in codebase against documented pages. Report undocumented features.

**Argument hint**: `[--section getting-started|content-management|custom-features|workflows|site-features|troubleshooting]`

**Workflow steps**:
1. Initialize
2. Scan codebase for user-visible features — admin menu registrations, custom post types, taxonomies, shortcodes, admin pages, settings pages
3. Scan user-guide content for documented features
4. Cross-reference — what's in the code but not documented? What's documented but removed from code?
5. Produce coverage report with gap list and priority suggestions

### 6. `/fp-docs:ug-preview` (admin)

**Purpose**: Start local Hugo dev server or trigger preview deploy for current branch.

**Argument hint**: `[--local] [--deploy] [--stop]`

**Workflow steps**:
1. Verify user-guide scaffold exists (bootstrap if missing)
2. If `--local` or default: start `hugo server` from `{docs-root}/user-guide/` in background, report URL
3. If `--deploy`: trigger `deploy-user-guide-preview.yml` workflow via `gh workflow run`
4. If `--stop`: kill local Hugo server process

### 7. `/fp-docs:ug-status` (read)

**Purpose**: Report user guide health metrics.

**Argument hint**: `[--verbose]`

**Workflow steps**:
1. Verify user-guide scaffold exists
2. Count pages, screenshots, templates used
3. Report `last_verified` ages (oldest, newest, average)
4. Report coverage percentage (documented features / total user-visible features)
5. Report section breakdown

### 8. `/fp-docs:ug-batch` (batch)

**Purpose**: Batch operation across multiple user guide pages.

**Argument hint**: `<validate|screenshot|update> [--section <name>] [--all]`

**Workflow steps**:
1. Initialize — determine batch operation type and scope
2. Enumerate target pages
3. If Agent Teams enabled: create team, assign pages to teammates
4. If not: sequential execution
5. Aggregate results
6. If write operation: commit

---

## Agents (2 new)

### `fp-docs-ug-writer` (write-capable)

**File**: `agents/fp-docs-ug-writer.md`

```yaml
---
name: fp-docs-ug-writer
description: User guide content writer for the FP site. Creates and updates user-facing documentation with screenshots. Uses Playwright MCP for UI discovery and screenshot capture.
tools: Read, Write, Edit, Bash, Grep, Glob
color: cyan
---
```

**Domain**: User guide content creation and modification
**Operations**: ug-generate (write phase), ug-update (write phase), ug-screenshot
**Key behaviors**:
- Reads source code to understand feature behavior but writes from the USER's perspective
- Uses Playwright MCP (`browser_navigate`, `browser_screenshot`, `browser_click`) when available
- Falls back to code analysis when Playwright unavailable (traces admin menu hooks, form field registrations)
- Writes Hugo page bundles: `content/{section}/{page-name}/index.md` + co-located screenshots
- Uses page templates from `scaffolds/user-guide/templates/` as starting structure
- Enforces plain language — never includes code identifiers in output
- Updates `last_verified` and `screenshot_count` frontmatter on every write

**References to read** (via `<files_to_read>` in spawn prompt):
- `references/ug-standards.md` (NEW — user guide formatting and content rules)
- `references/ug-ui-verification.md` (NEW — how to verify UI paths via Playwright or code)
- `references/fp-project.md` (existing — project paths and environment)

### `fp-docs-ug-validator` (read-only)

**File**: `agents/fp-docs-ug-validator.md`

```yaml
---
name: fp-docs-ug-validator
description: User guide validation agent. Verifies documented UI paths match current codebase state. Checks screenshot currency, tone compliance, and content completeness.
tools: Read, Bash, Grep, Glob
disallowedTools: Write, Edit
color: yellow
---
```

**Domain**: User guide accuracy validation
**Operations**: ug-validate, ug-audit, ug-status, pipeline stages 1-4
**Key behaviors**:
- Walks documented steps against current UI state (Playwright or code trace)
- Checks screenshot file references resolve to actual page bundle resources
- Validates page structure against template requirements (completeness check)
- Scans for jargon/dev terminology violations
- Produces structured validation reports (per-page PASS/WARN/FAIL)
- NEVER modifies files — read-only agent

**References to read**:
- `references/ug-validation-rules.md` (NEW — validation criteria for user guide)
- `references/ug-standards.md` (NEW)
- `references/fp-project.md` (existing)

---

## References (3 new)

### `references/ug-standards.md`

User guide content standards. Covers:
- Page structure requirements per content type (feature-guide, workflow, quick-start, reference, faq)
- Hugo page bundle conventions (index.md + co-located assets)
- Frontmatter fields: title, description, weight, content_type, last_verified, screenshot_count, source_features
- Screenshot naming conventions: `{NN}-{slug}.png` (numbered, descriptive)
- Tone rules: plain language, no dev jargon, audience is non-technical WP editors
- Link conventions: relative links between user guide pages, no links to dev wiki
- Shortcode usage: `{{< recording >}}` for workflows, `{{< step >}}` for numbered steps

### `references/ug-ui-verification.md`

How to verify UI paths. Covers:
- Playwright MCP verification flow: navigate -> wait -> check element -> screenshot
- Code-based fallback verification: trace `add_menu_page`, `register_post_type`, `register_taxonomy`, `add_meta_box`, form field definitions
- Admin URL patterns: `/wp-admin/edit.php?post_type=X`, `/wp-admin/admin.php?page=X`
- Mapping documented navigation paths ("Dashboard > Posts > Add New") to actual WordPress admin URLs
- Screenshot capture protocol: viewport size, wait conditions, element targeting
- WP admin authentication via Playwright (cookie persistence with foreignpolicy.local)

### `references/ug-validation-rules.md`

Validation criteria for user guide content. Covers:
- UI path verification checks (does the documented menu path exist?)
- Screenshot currency checks (source file modification dates vs last_verified)
- Jargon detection rules (regex patterns, banned terms, allowed exceptions)
- Completeness matrix (required sections per content type)
- Coverage gap detection (user-visible features in code vs documented features)
- Validation report format (per-page status, issue classification, severity)

---

## Routing Table Changes

Add 8 entries to `ROUTING_TABLE` in `lib/routing.cjs`:

```javascript
'ug-generate':   { agent: 'fp-docs-ug-writer',    workflow: 'ug-generate.md',   operation: 'ug-generate',   type: 'write' },
'ug-update':     { agent: 'fp-docs-ug-writer',    workflow: 'ug-update.md',     operation: 'ug-update',     type: 'write' },
'ug-screenshot': { agent: 'fp-docs-ug-writer',    workflow: 'ug-screenshot.md', operation: 'ug-screenshot', type: 'write' },
'ug-validate':   { agent: 'fp-docs-ug-validator', workflow: 'ug-validate.md',   operation: 'ug-validate',   type: 'read' },
'ug-audit':      { agent: 'fp-docs-ug-validator', workflow: 'ug-audit.md',      operation: 'ug-audit',      type: 'read' },
'ug-preview':    { agent: 'fp-docs-system',       workflow: 'ug-preview.md',    operation: 'ug-preview',    type: 'admin' },
'ug-status':     { agent: 'fp-docs-ug-validator', workflow: 'ug-status.md',     operation: 'ug-status',     type: 'read' },
'ug-batch':      { agent: null,                    workflow: 'ug-batch.md',      operation: 'ug-batch',      type: 'batch' },
```

Also add 8 entries to `DESCRIPTIONS`:

```javascript
'ug-generate':   'Generate a new user guide page for a feature or workflow',
'ug-update':     'Update existing user guide page after codebase changes',
'ug-screenshot': 'Capture or refresh screenshots for user guide pages',
'ug-validate':   'Validate user guide accuracy against current UI state',
'ug-audit':      'Audit user guide coverage gaps against codebase features',
'ug-preview':    'Start local Hugo server or trigger preview deploy',
'ug-status':     'Report user guide health metrics and coverage',
'ug-batch':      'Batch operations across multiple user guide pages',
```

Routing table count changes from 23 to 31.

---

## Config Changes

Add to `config.json`:

1. `user_guide_pipeline` section (see Pipeline Config above)
2. `user_guide` section:

```json
{
  "user_guide": {
    "enabled": true,
    "scaffold_name": "user-guide",
    "content_dir": "user-guide/content",
    "templates_dir": "user-guide/templates",
    "sections": [
      "getting-started",
      "content-management",
      "custom-features",
      "workflows",
      "site-features",
      "troubleshooting"
    ],
    "page_types": [
      "feature-guide",
      "workflow-walkthrough",
      "quick-start",
      "reference",
      "faq"
    ],
    "screenshot": {
      "viewport_width": 1280,
      "viewport_height": 900,
      "format": "png",
      "quality": 85,
      "max_width": 1200,
      "naming_pattern": "{NN}-{slug}.{ext}"
    },
    "playwright": {
      "base_url": "https://foreignpolicy.local/wp-admin/",
      "auth_strategy": "cookie-persistence",
      "wait_after_navigate_ms": 2000,
      "ignore_certificate_errors": true
    }
  }
}
```

---

## Health Check Updates

Update `lib/health.cjs`:
- Change expected routing table count from 23 to 31
- Change expected command/workflow counts from 23 to 31
- Add expected agent count from 10 to 12
- Add user-guide scaffold existence check (when docs root available)

---

## Init Module Updates

Add to `lib/init.cjs`:
- `initUserGuideWriteOp()` — like `initWriteOp()` but loads `user_guide_pipeline` config instead of `pipeline` config
- `initUserGuideReadOp()` — like `initReadOp()` but includes user-guide-specific validation config
- Scaffold auto-check at init time (call `checkScaffold('user-guide')`, bootstrap if missing)

---

## File Manifest

### New files to create (28 total)

**Commands** (8):
- `commands/ug-generate.md`
- `commands/ug-update.md`
- `commands/ug-screenshot.md`
- `commands/ug-validate.md`
- `commands/ug-audit.md`
- `commands/ug-preview.md`
- `commands/ug-status.md`
- `commands/ug-batch.md`

**Workflows** (8):
- `workflows/ug-generate.md`
- `workflows/ug-update.md`
- `workflows/ug-screenshot.md`
- `workflows/ug-validate.md`
- `workflows/ug-audit.md`
- `workflows/ug-preview.md`
- `workflows/ug-status.md`
- `workflows/ug-batch.md`

**Agents** (2):
- `agents/fp-docs-ug-writer.md`
- `agents/fp-docs-ug-validator.md`

**References** (3):
- `references/ug-standards.md`
- `references/ug-ui-verification.md`
- `references/ug-validation-rules.md`

**Test specs** (8 — one per command):
- `tests/specs/ug-generate.md`
- `tests/specs/ug-update.md`
- `tests/specs/ug-screenshot.md`
- `tests/specs/ug-validate.md`
- `tests/specs/ug-audit.md`
- `tests/specs/ug-preview.md`
- `tests/specs/ug-status.md`
- `tests/specs/ug-batch.md`

### Files to modify (7)

- `lib/routing.cjs` — Add 8 routing entries + 8 descriptions (23 -> 31)
- `lib/health.cjs` — Update expected counts (routing: 23->31, commands: 23->31, workflows: 23->31, agents: 10->12)
- `lib/init.cjs` — Add user-guide init functions + scaffold auto-check
- `config.json` — Add `user_guide` and `user_guide_pipeline` sections
- `specs/architecture.md` — Document new agents, commands, pipeline, routing entries
- `specs/features-and-capabilities.md` — Document new commands, pipeline stages, agents
- `specs/usage-and-workflows.md` — Document new user workflows, command reference, config options

---

## Implementation Phases

### Phase 1: Foundation (references + agents + config)
Create the 3 reference files, 2 agent definitions, and config.json additions. These are the building blocks everything else depends on.

**Files**: 5 new, 1 modified
**Estimated scope**: ~5 files

### Phase 2: Read-only commands (validate, audit, status)
Build the read-only commands first — they don't modify docs, so they're lower risk and validate the pipeline design.

**Files**: 6 new (3 commands + 3 workflows), 1 modified (routing.cjs)
**Estimated scope**: ~7 files

### Phase 3: Write commands (generate, update, screenshot)
Build the write commands that create and modify user guide content. These depend on the pipeline and agents from Phase 1.

**Files**: 6 new (3 commands + 3 workflows)
**Estimated scope**: ~6 files

### Phase 4: Admin + batch commands (preview, batch)
Build the preview server/deploy command and the batch operation command.

**Files**: 4 new (2 commands + 2 workflows)
**Estimated scope**: ~4 files

### Phase 5: Integration (health, init, routing, specs, tests)
Wire everything together: update health checks, init module, routing table counts, specs, and create test specs.

**Files**: 8 new (test specs), 6 modified (health, init, routing, 3 specs)
**Estimated scope**: ~14 files

---

## Dependencies & Prerequisites

- Scaffolding system: DONE (lib/scaffold.cjs, scaffolds/user-guide/, session-start auto-bootstrap)
- CLAUDE.md for fp-docs: DONE
- Preview deploy workflow: DONE (scaffolds/user-guide/.github-workflows/deploy-user-guide-preview.yml)
- Playwright MCP: Already configured in .mcp.json (bumped to 0.0.70 in wave3)
- Hugo: Required for ug-preview (local server). Not required for content operations.
- FP codebase access: Required for Playwright-based UI verification. Code-based fallback works without it.

---

## Open Questions (resolved)

1. ~~Separate branch for user docs?~~ No — same branch model as dev docs, with preview deploys for pre-merge sharing.
2. ~~Auto-generate vs dev-controlled?~~ Dev-controlled scope with inference. System suggests but doesn't act without direction.
3. ~~Shared pipeline vs separate?~~ Separate pipeline. UI behavior accuracy, not code citation accuracy.
4. ~~Command namespace?~~ `/fp-docs:ug-*` prefix distinguishes from dev docs commands.
