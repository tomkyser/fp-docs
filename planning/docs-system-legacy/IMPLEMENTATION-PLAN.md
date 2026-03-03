# Implementation Plan: Claude Code Documentation Management System

> **Created**: 2026-02-26
> **Status**: PLAN — awaiting approval before implementation
> **Scope**: 17 files to create/rewrite across `docs/claude-code-docs-system/`, `docs/docs-management.md`, and `docs/claude-code-config/example-CLAUDE.md`

---

## 1. System Architecture

### 1.1 Design Philosophy

The current docs management approach relies on the user pasting long prompts that embed rules, mapping tables, and instructions inline. Each Claude Code session interprets these prompts independently, leading to inconsistency. This system replaces that with a **deterministic instruction architecture** where:

- Every operation is pre-scripted in a dedicated instruction file
- Claude Code follows explicit steps — no interpretation, no improvisation
- Instructions compose like function calls — parent instructions call sub-instructions
- Planning and execution are always separate steps for intensive operations
- Verification is mandatory, not optional

### 1.2 Execution Flow

```
User pastes prompt from docs-management.md
  │
  ▼
Prompt says: "Read docs/claude-code-docs-system/docs-system.md — execute: <command>"
  │
  ▼
docs-system.md (THE KERNEL)
  ├── Loads: docs-standards.md (rules, formatting, conventions)
  ├── Loads: docs-commands-list.md (command → instruction routing table)
  ├── Contains: source-to-docs mapping table
  ├── Contains: execution lifecycle definition
  │
  ▼
Routes to: instructions/cc-<command>.md
  │
  ▼
Instruction executes step-by-step
  ├── May call sub-instructions (cc-planning.md, cc-verify.md, etc.)
  ├── May write plans to update-plans/ before executing
  │
  ▼
Post-execution sub-instructions run
  ├── cc-verify.md (ALWAYS)
  ├── cc-changelog.md (ALWAYS after changes)
  ├── cc-update-doc-links.md (IF docs added/removed)
  └── cc-update-project-index.md (IF structural changes)
```

### 1.3 File Map

```
docs/
├── docs-management.md                          ← USER-FACING: command reference + copy-paste prompts
├── changelog.md                                ← Updated by cc-changelog.md
├── About.md                                    ← Updated by cc-update-doc-links.md
│
├── claude-code-docs-system/                    ← THE SYSTEM
│   ├── docs-system.md                          ← "OS kernel" — entry point, routing, lifecycle
│   ├── docs-standards.md                       ← Rules, formatting, naming, structure, depth requirements
│   ├── docs-commands-list.md                   ← Command → instruction file routing table
│   ├── PROJECT-INDEX.md                        ← Codebase reference (updated by cc-update-project-index)
│   │
│   ├── instructions/                           ← One file per operation
│   │   ├── cc-auto-update.md                   ← PRIMARY: auto-detect changes, plan, execute
│   │   ├── cc-revise.md                        ← PRIMARY: user-directed targeted revision
│   │   ├── cc-auto-revise.md                   ← PRIMARY: revise what is listed in themes/foreign-policy-2017/docs/needs-revision-tracker.md (run cc-revise for each)
│   │   ├── cc-add.md                           ← PRIMARY: create docs for new code
│   │   ├── cc-deprecate.md                     ← PRIMARY: mark docs as deprecated
│   │   ├── cc-audit.md                         ← PRIMARY: compare docs vs code, report discrepancies
│   │   ├── cc-update-example-CLAUDE.md         ← PRIMARY: generate/refresh example CLAUDE.md
│   │   │
│   │   ├── cc-planning.md                      ← SUB: write update plan to update-plans/
│   │   ├── cc-changelog.md                     ← SUB: append entry to docs/changelog.md
│   │   ├── cc-verify.md                        ← SUB: full 6-point verification checklist
│   │   ├── cc-verify-docs-links.md             ← SUB: link-only verification (subset of verify)
│   │   ├── cc-update-doc-links.md              ← SUB: update About.md + _index.md files
│   │   └── cc-update-project-index.md          ← SUB: refresh PROJECT-INDEX.md
│   │
│   ├── update-plans/                           ← Plans written before execution
│   │   └── (update-plan-YYYY-MM-DD.md files)
│   │
│   └── IMPLEMENTATION-PLAN.md                  ← THIS FILE (remove after implementation)
│   └── needs-revision-tracker.md               ← for batch revisions, curate after command run and track via changelog and summarize to user in prompt response.
│
└── claude-code-config/
    └── example-CLAUDE.md                       ← Template CLAUDE.md for developer setup
```

---

## 2. File Specifications

### 2.1 docs-system.md — "The Kernel"

**Purpose**: Entry point for every docs management operation. Claude reads this first; it bootstraps the system.

**Sections**:

1. **System Identity** (~5 lines)
   - What this system is: a deterministic instruction system for managing 301+ developer docs
   - Rule: Claude MUST follow instruction files exactly — no interpretation, no improvisation

2. **Bootstrap Sequence** (~10 lines)
   - When this file is loaded, Claude MUST ALSO read (in order):
     1. `docs-standards.md` — all formatting, naming, and structural rules
     2. `docs-commands-list.md` — the command-to-instruction routing table
   - Then: match the user's command from the prompt to the routing table
   - Then: read the corresponding instruction file from `instructions/`
   - Then: if the instruction references sub-instructions, read those as needed during execution

3. **Execution Lifecycle** (~15 lines)
   - Every operation follows: LOAD → ROUTE → PLAN → EXECUTE → VERIFY → LOG → INDEX
   - PLAN phase: for any operation that creates or modifies docs, write a plan to `update-plans/` first
   - VERIFY phase: mandatory — run `cc-verify.md` after every operation that changes docs
   - LOG phase: mandatory — run `cc-changelog.md` after every operation that changes docs
   - INDEX phase: conditional — run `cc-update-project-index.md` only if structural changes occurred (new sections, major reorganization)

4. **Source-to-Documentation Mapping Table** (~40 lines)
   - The complete mapping table (currently 32 entries) from source directories to doc targets
   - Also includes the appendix cross-reference rules (hooks→A, shortcodes→B, etc.)
   - This table is the single source of truth — instructions reference it, not their own copies

5. **Integrity Rules** (~10 lines)
   - NEVER guess — read actual source code
   - NEVER skip verification
   - ALWAYS update changelog after changes
   - ALWAYS read a sibling doc for format before creating a new doc
   - NEVER duplicate mapping tables or rules — reference docs-system.md and docs-standards.md
   - When in doubt, use `[NEEDS INVESTIGATION]` — never fabricate

**Estimated length**: ~100 lines

---

### 2.2 docs-standards.md — "The Rules Bible"

**Purpose**: Every formatting, naming, structural, and depth rule in one place. Referenced by all instruction files.

**Sections**:

1. **File Naming Conventions** (~10 lines)
   - Section indexes: `_index.md` (underscore prefix)
   - Individual docs: kebab-case matching source file or system name
   - Appendices: letter prefix (`A-`, `B-`, etc.)
   - Update plans: `update-plan-{YYYY-MM-DD}.md`
   - Changelog entries: date-based under month headings

2. **Directory Structure Rules** (~15 lines)
   - Every `docs/NN-section/` MUST have `_index.md`
   - Every doc file MUST be linked from its parent `_index.md`
   - Every section MUST be linked from `About.md`
   - New appendices use next available letter prefix (currently through `G-`)
   - Subdirectory conventions: `field-groups/`, `options-pages/`, `actions/`, `filters/`, `rest-api/`, `custom-endpoints/`, `javascript/`, `styles/`

3. **Document Format Templates** (~60 lines)
   - **Post Type doc**: Title, Overview, Source File, Registration, Fields/Meta Keys, Hooks, Templates, Admin UI, Related Docs
   - **Taxonomy doc**: Title, Overview, Source File, Registration Args, Term Meta, Admin UI, Query Modifications, Related Docs
   - **Helper doc**: Title, Overview, Source File, Namespace, Functions (table: name, signature, params, return, callers), Related Docs
   - **Hook doc**: Title, Overview, Hooks (table: name, type, priority, callback, behavior), Dependencies, Related Docs
   - **Shortcode doc**: Title, Overview, Shortcodes (for each: tag, attributes with types/defaults, output HTML, example), Related Docs
   - **REST Endpoint doc**: Title, Overview, Route, Method, Parameters, Response Shape, Authentication, Related Docs
   - **Component doc**: Title, Overview, Files (table: path, purpose), Variables/Context, Callers, Related Docs
   - **JavaScript doc**: Title, Overview, Source File, Exports, Event Listeners, DOM Dependencies, Imports, Related Docs
   - **ACF Field Group doc**: Title, Overview, Sync Method, Fields (table: key, label, type, conditional logic), Location Rules, Related Docs
   - **Integration doc**: Title, Overview, Service, API, Credentials, Data Flow, Error Handling, Related Docs

4. **Content Rules** (~15 lines)
   - All file paths relative to theme root (`themes/foreign-policy-2017/`)
   - Code references in backticks
   - `[LEGACY]` tag for deprecated systems
   - `[NEEDS INVESTIGATION]` for unclear behavior
   - Relative markdown links between docs
   - Present tense ("The function returns..." not "will return")
   - Second person for instructions ("You can configure...")
   - Paragraphs 3-5 sentences max
   - Tables for reference data, prose for explanations

5. **Depth Requirements** (~20 lines)
   - The complete depth requirements table (post types, taxonomies, helpers, hooks, shortcodes, REST endpoints, components, JavaScript, ACF field groups, integrations)

6. **Cross-Reference Requirements** (~15 lines)
   - The appendix sync table (hook→A, shortcode→B, REST→C, constant→D, dependency→E, ACF→F, feature template→G)
   - Rule: when creating/modifying docs that contain any of the above, the corresponding appendix MUST be checked and updated

**Estimated length**: ~140 lines

---

### 2.3 docs-commands-list.md — "The Routing Table"

**Purpose**: Maps command names to instruction files. This is what docs-system.md reads to determine which instruction file to load.

**Format**:

```markdown
# Documentation Commands

## Primary Commands (user-invoked)

| Command | Instruction | Description | SuperClaude Skill | Flags |
|---------|------------|-------------|-------------------|-------|
| auto-update | cc-auto-update.md | Auto-detect code changes and update docs | /sc:analyze (plan) + /sc:document (execute) | --orchestrate |
| revise | cc-revise.md | Targeted revision of specific docs | /sc:document | -- |
| add | cc-add.md | Create docs for new code | /sc:document | --orchestrate |
| deprecate | cc-deprecate.md | Mark docs as deprecated/legacy | /sc:document | -- |
| audit | cc-audit.md | Compare docs vs code, report findings | /sc:analyze | --depth, --orchestrate, --section |
| verify | cc-verify.md | Run verification checklist | /sc:analyze | -- |
| update-project-index | cc-update-project-index.md | Refresh PROJECT-INDEX.md | /sc:index-repo | --mode |
| update-example-claude | cc-update-example-CLAUDE.md | Generate/refresh example CLAUDE.md | /sc:document | -- |

## Sub-Instructions (called by primary commands, not directly by users)

| Sub-Instruction | Called By | Purpose |
|----------------|-----------|---------|
| cc-planning.md | auto-update, add | Write update plan to update-plans/ |
| cc-changelog.md | auto-update, revise, add, deprecate | Append entry to changelog.md |
| cc-verify.md | auto-update, revise, add, deprecate | Full verification checklist |
| cc-verify-docs-links.md | cc-verify.md | Link-only verification |
| cc-update-doc-links.md | auto-update, add, deprecate | Update About.md + _index.md files |
| cc-update-project-index.md | auto-update (conditional) | Refresh PROJECT-INDEX.md |
```

**Estimated length**: ~40 lines

---

### 2.4 Instruction Files — Primary Commands

#### 2.4.1 cc-auto-update.md

**Purpose**: The "I don't want to think about it" command. Auto-detects what changed since the last doc update and handles everything.

**Steps**:
1. Read `docs/changelog.md` — find the date of the most recent entry
2. Run `git log --since=<date> --name-only --pretty=format:'%H %ai %s'` in the theme directory
3. Filter results to source files only (exclude docs/, node_modules/, vendor/, public/)
4. Cross-reference changed files against the source-to-docs mapping table in `docs-system.md`
5. If no documentation-relevant changes found → report "No updates needed" and exit
6. **→ Call cc-planning.md**: write an update plan to `update-plans/update-plan-{YYYY-MM-DD}.md`
7. Present plan summary to user (files to create/modify/remove, estimated scope)
8. Execute the plan:
   - For each affected doc: read current source code → read existing doc → update doc
   - For new code without docs: read sibling doc for format → read source → create doc
   - For removed code: add REMOVED notice to doc
   - Follow all rules from `docs-standards.md`
9. **→ Call cc-update-doc-links.md**: update About.md and affected _index.md files
10. **→ Call cc-verify.md**: run full verification checklist
11. **→ Call cc-changelog.md**: append entry to changelog.md
12. If structural changes occurred → **call cc-update-project-index.md**
13. Report: list every file created/modified/removed with one-line summaries

**Flags**:
- `--orchestrate`: use parallel Task agents for large change sets (>10 files affected)

**Estimated length**: ~80 lines

---

#### 2.4.2 cc-revise.md

**Purpose**: User-directed targeted revision. The user describes what's wrong or what needs updating.

**Steps**:
1. Parse the user's description to identify:
   - Which doc file(s) need revision
   - What aspect is incorrect or outdated
2. For each affected doc:
   a. Read the current documentation file
   b. Read the corresponding source code file(s) (using mapping table in docs-system.md)
   c. Compare and identify discrepancies
   d. Make targeted edits following `docs-standards.md` rules
   e. Preserve all content that is still accurate
3. **→ Call cc-verify.md**: run verification checklist
4. **→ Call cc-changelog.md**: append entry to changelog.md
5. Report: list every file modified with one-line summaries

**No planning step** — revise is for targeted, scoped edits that don't require a plan.

**Estimated length**: ~50 lines

---

#### 2.4.3 cc-add.md

**Purpose**: Create documentation for entirely new code that has never been documented.

**Steps**:
1. Parse the user's description to identify:
   - What new code was added (file paths, system type)
   - Which docs/ section it belongs in (using mapping table in docs-system.md)
2. **→ Call cc-planning.md**: write a plan covering:
   - New doc file(s) to create (with paths and naming per `docs-standards.md`)
   - Which _index.md files need updating
   - Whether About.md needs a new entry
   - Which appendices may be affected
3. Execute the plan:
   a. Read an existing sibling doc in the same section for format template
   b. Read the new source code file(s)
   c. Create the new documentation file(s) following the template and depth requirements
4. **→ Call cc-audit.md** (scoped — quick depth): check what other docs are affected by the addition (cross-references, dependencies, hooks used by new code, etc.)
5. **→ Call cc-update-doc-links.md**: add new entries to About.md and _index.md files
6. **→ Call cc-verify.md**: run full verification checklist
7. **→ Call cc-changelog.md**: append entry to changelog.md
8. Report: list every file created/modified with one-line summaries

**Flags**:
- `--orchestrate`: use parallel Task agents if adding docs for multiple new files

**Estimated length**: ~70 lines

---

#### 2.4.4 cc-deprecate.md

**Purpose**: Mark documentation (and its corresponding code) as deprecated/legacy.

**Steps**:
1. Parse the user's description to identify:
   - Which code/docs are being deprecated
   - What the replacement is (if any)
   - Whether the code is being removed or just deprecated
2. For code being **deprecated** (still in codebase):
   a. Add `[LEGACY]` tag to the document title
   b. Add deprecation notice: "> **Deprecated**: [date]. [Replacement info if applicable]."
   c. Update _index.md entries to include `[LEGACY]` marker
3. For code being **removed**:
   a. Add REMOVED notice: "> **REMOVED**: This file was deleted on [date]. This documentation is retained for historical reference."
   b. Remove the entry from _index.md
   c. Remove the entry from About.md
4. Update any cross-references in other docs that link to the deprecated/removed doc
5. **→ Call cc-verify.md**: run verification checklist
6. **→ Call cc-changelog.md**: append entry to changelog.md
7. Report: list every file modified with one-line summaries

**Estimated length**: ~50 lines

---

#### 2.4.5 cc-audit.md

**Purpose**: Compare documentation against code and report discrepancies. Does NOT automatically fix anything.

**Steps**:
1. Determine scope based on flags:
   - `--depth quick`: file existence + link validity only
   - `--depth standard` (default): check recently changed files (last 30 days) against their docs
   - `--depth deep`: full comparison of ALL docs against ALL source files
   - `--section NN`: limit to a specific section (e.g., `--section 02` for post types only)
2. For `quick` depth:
   a. Run cc-verify-docs-links.md
   b. Check that every doc file mentioned in About.md exists
   c. Check that every source file in the mapping table has a corresponding doc
3. For `standard` depth:
   a. Everything in `quick`
   b. Run `git log --since="30 days ago" --name-only` to find recently changed source files
   c. For each changed file that maps to a doc: read both source and doc, flag discrepancies
4. For `deep` depth:
   a. Everything in `standard`
   b. For EVERY doc file: read the doc, read the corresponding source, compare
   c. If `--orchestrate` flag: use parallel Task agents (batch by section)
5. Output audit report with findings categorized as:
   - **MISSING**: source code exists but no documentation file
   - **STALE**: documentation doesn't match current source code (specific discrepancies listed)
   - **BROKEN**: broken links, invalid references, or formatting violations
   - **ORPHAN**: documentation exists but no corresponding source code
6. Report includes recommended actions but does NOT execute them

**Flags**:
- `--depth quick|standard|deep`
- `--orchestrate`: use parallel agents for deep audits
- `--section NN`: limit to specific section number

**Estimated length**: ~80 lines

---

#### 2.4.6 cc-update-example-CLAUDE.md

**Purpose**: Generate or refresh the example CLAUDE.md template that new developers copy into their `.claude/` directory.

**Steps**:
1. Read the current theme structure:
   a. `functions.php` (bootstrap sequence overview)
   b. `inc/` directory structure (post types, taxonomies, etc.)
   c. `helpers/` directory (count and list)
   d. `components/` directory (count)
   e. `build/package.json` (build commands)
   f. `lib/autoloaded/composer.json` (Composer deps)
2. Read `docs/claude-code-docs-system/docs-system.md` for system reference
3. Generate `docs/claude-code-config/example-CLAUDE.md` with these sections:
   - **Project Overview**: FP magazine, VIP Go, codebase age
   - **Common Commands**: build, lint, test, deploy (from build system)
   - **Architecture**: directory structure, theme structure, namespace conventions, build system, plugin loading
   - **Key Integrations**: Piano, Sailthru, Coral, Chartbeat, Meilisearch, Apple News, GA
   - **VIP Environment Detection**: the 3 helper functions + staging env list
   - **CI/CD**: CircleCI branch strategy
   - **Code Standards**: PHPCS, PHP version, Psalm level
   - **Developer Documentation**: point to `docs/About.md`, note 301 docs / 24 sections / ~48K lines
   - **Documentation Management**: point to `docs/docs-management.md` for user commands, point to `docs/claude-code-docs-system/docs-system.md` for the management system, note: "When asked to update, manage, or audit documentation, read docs-system.md first."
   - **Quick Reference**: common tasks with doc pointers (adding a post type, adding a helper, adding a REST endpoint, etc.)
4. Report: file created/updated

**Estimated length**: ~60 lines

---

### 2.5 Instruction Files — Sub-Instructions

#### 2.5.1 cc-planning.md

**Purpose**: Write an update plan to `update-plans/` before execution begins. Called by auto-update and add.

**Steps**:
1. Analyze the scope of work (files to create, modify, or remove)
2. Create file: `docs/claude-code-docs-system/update-plans/update-plan-{YYYY-MM-DD}.md`
3. Plan format:
   ```
   # Update Plan — YYYY-MM-DD

   ## Trigger
   [What initiated this update — auto-detect, user request, etc.]

   ## Source Changes
   [List of source files that changed, from git log or user description]

   ## Documentation Impact
   | Action | Doc File | Source File | Description |
   |--------|----------|-------------|-------------|
   | CREATE | docs/02-post-types/new-type.md | inc/post-types/class-post-type-new.php | New post type |
   | MODIFY | docs/06-helpers/posts.md | helpers/posts.php | Added new function |
   | REMOVE | docs/02-post-types/old-type.md | (deleted) | Post type removed |

   ## Cross-References to Update
   - About.md: add entry for new-type.md
   - 02-post-types/_index.md: add entry
   - appendices/A-complete-hook-registry.md: add 3 new hooks

   ## Estimated Scope
   - Files to create: N
   - Files to modify: N
   - Files to remove: N
   ```
4. Return the plan file path to the parent instruction

**Estimated length**: ~40 lines

---

#### 2.5.2 cc-changelog.md

**Purpose**: Append an entry to `docs/changelog.md` after any operation that changes docs.

**Steps**:
1. Read `docs/changelog.md`
2. Determine if today's month header (`## YYYY-MM`) already exists; if not, add it
3. Append entry under today's date:
   ```
   ### YYYY-MM-DD — [Short Title]

   - **Files changed**:
     - `docs/path/to/file.md` (created | modified | removed)
     - ...
   - **Summary**: [One-line description of what changed and why]
   ```
4. The entry MUST list every file that was created, modified, or removed
5. The summary MUST describe why the change was made (e.g., "Updated post type docs after adding new meta key" not just "Updated docs")

**Estimated length**: ~30 lines

---

#### 2.5.3 cc-verify.md

**Purpose**: Full 6-point verification checklist. Called after every operation that changes docs.

**Steps**:
1. **File existence check**: extract all relative links from About.md → verify each target file exists on disk
2. **Orphan check**: list all .md files in docs/ recursively → confirm each is linked from About.md or its parent _index.md (exceptions: docs-management.md, changelog.md, needs-revision-tracker.md, and everything in claude-code-docs-system/)
3. **Index completeness**: for each _index.md file, list all .md files in that directory → confirm each is linked from the _index.md
4. **Appendix spot-check**: if the operation touched code that registers hooks, shortcodes, REST routes, constants, ACF groups, or dependencies → verify the corresponding appendix was updated
5. **→ Call cc-verify-docs-links.md**: run link validation across all docs
6. **Changelog check**: confirm docs/changelog.md has an entry for today's date
7. Report results: PASS (all checks passed) or FAIL (list each failure with details)

**Estimated length**: ~50 lines

---

#### 2.5.4 cc-verify-docs-links.md

**Purpose**: Validate all relative markdown links across the documentation.

**Steps**:
1. Find all .md files in docs/ (excluding claude-code-docs-system/)
2. Extract all relative markdown links (pattern: `](relative/path.md)`)
3. For each link, resolve the path relative to the file containing the link
4. Verify the target file exists on disk
5. Report: list of broken links (source file, link text, target path)

**Estimated length**: ~25 lines

---

#### 2.5.5 cc-update-doc-links.md

**Purpose**: Update About.md and _index.md files when docs are added, removed, or moved.

**Steps**:
1. Read About.md
2. Read the list of changes from the current operation (files created, removed, moved)
3. For each **new doc created**:
   a. Add an entry to the appropriate section in About.md (matching the table format of that section)
   b. Add an entry to the parent _index.md
4. For each **doc removed**:
   a. Remove the entry from About.md
   b. Remove the entry from the parent _index.md
5. For each **doc moved/renamed**:
   a. Update the link in About.md
   b. Update the link in the parent _index.md
6. Verify the About.md description for the entry is accurate (read the first few lines of the doc if needed)

**Estimated length**: ~40 lines

---

#### 2.5.6 cc-update-project-index.md

**Purpose**: Refresh `docs/claude-code-docs-system/PROJECT-INDEX.md` to reflect the current state of the codebase.

**Steps**:
1. Determine mode from flag:
   - `full`: regenerate entirely from codebase scan
   - `update` (default): read existing, identify what changed, update incrementally
   - `quick`: update file counts and recently-changed modules only
2. For `update` mode:
   a. Read existing PROJECT-INDEX.md
   b. Run `git log --since="last project index update" --name-only` (or check last modified time)
   c. For changed areas: rescan and update the relevant section
   d. Update file statistics table
3. For `full` mode:
   a. Scan theme directory structure
   b. Generate complete index (entry points, core modules, helpers, CLI, REST, crons, feeds, mobile, integrations, namespaces, constants, quick reference)
   c. This is equivalent to `/sc:index-repo`
4. Write updated content to PROJECT-INDEX.md

**Estimated length**: ~50 lines

---

### 2.6 User-Facing Files

#### 2.6.1 docs-management.md — Complete Rewrite

**Purpose**: The user-facing command reference. Simple, clean, copy-paste prompts.

**Structure**:

```markdown
# Documentation Management Guide

[Brief intro: what this is, how it works]

## Quick Reference

| What you want to do | Command | Section |
|---------------------|---------|---------|
| Auto-detect changes and update docs | [Auto Update](#auto-update) | — |
| Fix specific docs you know are wrong | [Revise](#revise) | — |
| Create docs for new code you added | [Add](#add) | — |
| Mark docs as deprecated | [Deprecate](#deprecate) | — |
| Audit docs for accuracy | [Audit](#audit) | --depth, --orchestrate |
| Verify doc integrity | [Verify](#verify) | — |
| Refresh the codebase index | [Update Index](#update-project-index) | --mode |
| Generate CLAUDE.md template | [Update CLAUDE.md](#update-example-claude) | — |

---

## Auto Update

Use when you want Claude to automatically detect what's changed and update docs.

```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: auto-update" --orchestrate
```

Then, after reviewing the plan:

```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: auto-update — proceed with plan at `docs/claude-code-docs-system/update-plans/update-plan-YYYY-MM-DD.md`" --type guide --style detailed --orchestrate
```

---

## Revise

Use when you know exactly what's wrong and want to direct the fix.

```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: revise — [DESCRIBE WHAT NEEDS REVISION]" --type guide --style detailed
```

Example:
```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: revise — The sponsored post type doc is missing the new template_type meta key added in PR #1234" --type guide --style detailed
```

---

## Add

Use when you've added entirely new code that needs fresh documentation.

```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: add — [DESCRIBE WHAT WAS ADDED WITH FILE PATHS]" --type guide --style detailed --orchestrate
```

---

## Deprecate

Use when code is being deprecated or removed.

```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: deprecate — [DESCRIBE WHAT IS DEPRECATED AND ITS REPLACEMENT]" --type guide --style detailed
```

---

## Audit

Use to check docs accuracy. Supports depth levels.

Quick (links and file existence only):
```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: audit --depth quick"
```

Standard (recently changed files):
```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: audit --depth standard"
```

Deep (full comparison — slow, thorough):
```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: audit --depth deep" --orchestrate
```

Section-specific:
```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: audit --depth standard --section 02"
```

---

## Verify

Use to run the verification checklist without making changes.

```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: verify"
```

---

## Update Project Index

Refresh the codebase reference index.

```
/sc:analyze "Read `docs/claude-code-docs-system/docs-system.md` — execute: update-project-index --mode update"
```

---

## Update Example CLAUDE.md

Generate or refresh the template CLAUDE.md for developer setup.

```
/sc:document "Read `docs/claude-code-docs-system/docs-system.md` — execute: update-example-claude" --type guide --style detailed
```

---

## For Non-Claude-Code Users

[Keep the existing LLM-agnostic Prompt B, updated with current rules — this is the only section that doesn't use the docs-system routing]

---

## How This System Works

The prompts above route through `docs/claude-code-docs-system/docs-system.md`, which acts as the control layer. It loads formatting rules from `docs-standards.md`, matches your command to the right instruction file in `instructions/`, and ensures verification and changelog updates happen automatically.

For the full system architecture, see: `docs/claude-code-docs-system/docs-system.md`
For formatting and structural rules, see: `docs/claude-code-docs-system/docs-standards.md`

SuperClaude Framework: https://github.com/SuperClaude-Org/SuperClaude_Framework/tree/master
```

**Estimated length**: ~200 lines

---

#### 2.6.2 example-CLAUDE.md — Complete Rewrite

**Purpose**: Template CLAUDE.md that any developer can copy to their `.claude/CLAUDE.md` for optimal Claude Code performance with this codebase.

**New sections** (beyond the current basic content):
- **Developer Documentation** section pointing to docs/About.md
- **Documentation Management** section pointing to docs-system.md and docs-management.md
- **Working With This Codebase** section with quick-reference doc pointers for common tasks

**Estimated length**: ~150 lines

---

## 3. Implementation Phases

### Phase 1: Foundation (no dependencies)

| # | File | Action | Estimated Lines |
|---|------|--------|-----------------|
| 1.1 | `docs-standards.md` | Write from scratch | ~140 |
| 1.2 | `docs-commands-list.md` | Write from scratch | ~40 |

### Phase 2: Core System (depends on Phase 1)

| # | File | Action | Estimated Lines |
|---|------|--------|-----------------|
| 2.1 | `docs-system.md` | Write from scratch | ~100 |

### Phase 3: Sub-Instructions (depends on Phase 2)

| # | File | Action | Estimated Lines |
|---|------|--------|-----------------|
| 3.1 | `instructions/cc-planning.md` | Write from scratch | ~40 |
| 3.2 | `instructions/cc-changelog.md` | Write from scratch | ~30 |
| 3.3 | `instructions/cc-verify-docs-links.md` | Write from scratch | ~25 |
| 3.4 | `instructions/cc-verify.md` | Write from scratch | ~50 |
| 3.5 | `instructions/cc-update-doc-links.md` | Write from scratch | ~40 |
| 3.6 | `instructions/cc-update-project-index.md` | Write from scratch | ~50 |

### Phase 4: Primary Instructions (depends on Phase 3)

| # | File | Action | Estimated Lines |
|---|------|--------|-----------------|
| 4.1 | `instructions/cc-auto-update.md` | Write from scratch | ~80 |
| 4.2 | `instructions/cc-revise.md` | Write from scratch | ~50 |
| 4.3 | `instructions/cc-add.md` | Write from scratch | ~70 |
| 4.4 | `instructions/cc-deprecate.md` | Write from scratch | ~50 |
| 4.5 | `instructions/cc-audit.md` | Write from scratch | ~80 |
| 4.6 | `instructions/cc-update-example-CLAUDE.md` | Write from scratch | ~60 |

### Phase 5: User-Facing (depends on Phase 4)

| # | File | Action | Estimated Lines |
|---|------|--------|-----------------|
| 5.1 | `docs/docs-management.md` | Complete rewrite | ~200 |
| 5.2 | `docs/claude-code-config/example-CLAUDE.md` | Complete rewrite | ~150 |

### Phase 6: Verification

| # | Task | Action |
|---|------|--------|
| 6.1 | Internal link check | Verify all cross-references between system files resolve |
| 6.2 | Instruction nesting check | Verify every sub-instruction reference in every instruction file matches an actual file |
| 6.3 | Command routing check | Verify every command in docs-commands-list.md has a corresponding instruction file |
| 6.4 | Prompt check | Verify every prompt in docs-management.md uses the correct syntax |
| 6.5 | Full system test | Run the verify command through the system to confirm it bootstraps correctly |

---

## 4. Totals

| Metric | Value |
|--------|-------|
| **Files to create/rewrite** | 17 |
| **Estimated total lines** | ~1,280 |
| **Phases** | 6 |
| **Primary instruction files** | 6 |
| **Sub-instruction files** | 6 |
| **System files** | 3 |
| **User-facing files** | 2 |

---

## 5. Open Decisions

### 5.1 Auto-Update Confirmation

Should `auto-update` pause after the planning step for user review before executing? The current design splits it into two prompts (analyze then document), which naturally creates a review point. This seems correct.

### 5.2 Update Plan Cleanup

Should old update plans in `update-plans/` be cleaned up automatically? Options:
- Never (accumulate as history)
- Delete after successful execution
- Keep last N plans

**Recommendation**: Keep all plans as an audit trail. They're small files.

### 5.3 PROJECT-INDEX.md Scope

The current PROJECT-INDEX.md is comprehensive (~250 lines). Should the auto-update command always run cc-update-project-index.md, or only when structural changes occur (new files in inc/, new helpers, etc.)?

**Recommendation**: Only when structural changes occur. Updating it on every doc edit is wasteful.

### 5.4 Prompt B (LLM-Agnostic) Maintenance

The existing LLM-agnostic prompt in docs-management.md — should it be updated to reference docs-standards.md for rules? Non-Claude users can't use the instruction system, but they could read the standards file manually.

**Recommendation**: Keep Prompt B self-contained (rules inline) since non-Claude users can't follow `docs-system.md` routing. Reference docs-standards.md as "additional reading" only.

---

## 6. Approval

This plan is ready for review. Upon approval, implementation will proceed in phase order.

**To proceed**: `/sc:implement "Follow the plan at docs/claude-code-docs-system/IMPLEMENTATION-PLAN.md"  --orchestrate`
