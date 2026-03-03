# Verbosity Engine — Design Specification

> Anti-brevity enforcement system for the FP documentation management system. Prevents Claude Code from truncating, summarizing, abbreviating, or omitting content during documentation generation.

**Created**: 2026-03-01
**Status**: IMPLEMENTED — 2026-03-01
**Branch**: `task--theme-dev-docs`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Component Specifications](#4-component-specifications)
5. [Integration Points](#5-integration-points)
6. [Implementation Plan](#6-implementation-plan)
7. [File Manifest](#7-file-manifest)
8. [Command Registration Chain](#8-command-registration-chain)

---

## 1. Problem Statement

Across the docs-system's generated documentation, Claude Code exhibits systematic content compression behaviors:

- **Incomplete API Reference tables** — listing a subset of functions, then stopping or using language like "and N more"
- **Prose summarization** — replacing detailed explanations with single-sentence summaries ("handles various post formats" instead of enumerating all formats)
- **Silent omission** — functions, hooks, parameters, or entire sections skipped without acknowledgment
- **Abbreviated descriptions** — one-liner descriptions where multi-sentence detail was warranted
- **Pattern elision** — items deemed "similar to above" get skipped entirely

These behaviors violate the system's existing completeness rules (Integrity Rule #1, #8, #11; Standards §5 Depth Requirements; Standards §8.6 Completeness Rule) but the rules alone are insufficient because the compression happens at Claude's **chain-of-thought (CoT) level** — an implicit behavioral tendency that overrides explicit instructions when:

- Output would be long
- Context window pressure builds
- Items appear repetitive
- The model's "helpful and concise" training kicks in

The problem is **not** that the instructions permit brevity — they don't. The problem is that there are no **active enforcement mechanisms** that detect and prevent compression in real time, no **context management strategy** for when scope exceeds a single context window, and no **agent-level propagation** ensuring spawned agents inherit the same anti-compression frame.

---

## 2. Root Cause Analysis

### 2.1 Why Instructions Alone Don't Work

Instructions are passive — they tell Claude what to do but don't enforce it mechanically. Claude's CoT can:

1. **Acknowledge the rule** ("I need to document all functions") and then **violate it** ("I'll cover the key ones to stay focused") in the same reasoning trace
2. **Self-justify compression** as being "helpful" — Claude's training rewards concise, focused responses
3. **Lose track of scope** — in a large file with 30+ functions, Claude's attention drifts and it "forgets" items toward the end
4. **Respond to context pressure** — as the context window fills, Claude increasingly compresses output to "fit"

### 2.2 Why Existing Validation Catches Some But Not All

The existing sanity-check and verify steps run **after** generation. They catch:
- Factual errors (function described incorrectly)
- Missing citations (citation block absent)
- Broken links

They DON'T systematically catch:
- Missing rows in API Reference tables (sanity-check doesn't count source functions vs documented functions)
- Summarized prose (no mechanism to detect "handles various X" should enumerate X)
- Omitted parameters ("See citation" used prematurely, or params silently dropped)

### 2.3 Why Agent Spawning Amplifies the Problem

When the main thread delegates to agents:
- The agent prompt typically describes the task but doesn't carry anti-compression behavioral framing
- Agents have their own CoT that independently gravitates toward brevity
- The main thread can't inspect the agent's CoT to detect compression in flight
- Results from agents are accepted as-is unless explicitly audited

### 2.4 The Context Window Problem

Documentation operations can involve:
- 30+ source files to read
- 50+ functions per file to document
- Existing doc content to preserve
- Standards/rules to follow
- Citation generation

This routinely approaches or exceeds a single context window. Claude's response to context pressure is **compression** — the exact behavior we need to prevent. The alternative (which this engine enforces) is **delegation** — splitting work across agents, each with a manageable scope.

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION SYSTEM                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LOAD PHASE                                                │  │
│  │                                                           │  │
│  │  docs-system.md ──► docs-standards.md                     │  │
│  │                 ──► docs-system-config.md (includes §5)   │  │
│  │                 ──► docs-verbosity-engine.md  ◄── NEW     │  │
│  │                 ──► docs-commands-list.md                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ROUTE → PLAN → ...                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ VERBOSITY-SCOPE  ◄── NEW PHASE                            │  │
│  │                                                           │  │
│  │  Read source files → count public functions, hooks,       │  │
│  │  params, sections → record SCOPE MANIFEST with targets    │  │
│  │                                                           │  │
│  │  Evaluate scope vs context budget → if over threshold:    │  │
│  │    CHUNK-AND-DELEGATE strategy                            │  │
│  │    (split into agent-sized work units)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EXECUTE (existing phase — generation happens here)        │  │
│  │                                                           │  │
│  │  Main thread OR delegated agents produce doc content      │  │
│  │  Each agent reads docs-verbosity-engine.md on spawn       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ VERBOSITY-ENFORCE  ◄── NEW PHASE                          │  │
│  │                                                           │  │
│  │  cc-verbosity-enforce.md runs:                            │  │
│  │  1. Count output items vs SCOPE MANIFEST targets          │  │
│  │  2. Scan for banned summarization phrases                 │  │
│  │  3. Flag gaps → if any: BLOCK PROCEED, require remediation│  │
│  │  4. If context exhausted: checkpoint + continuation plan  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CITATIONS → SANITY-CHECK → VERIFY → LOG → INDEX           │  │
│  │ (existing phases, unchanged)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ STANDALONE AUDIT  ◄── NEW COMMAND                         │  │
│  │                                                           │  │
│  │  cc-verbosity-audit.md (invoked independently)            │  │
│  │  Scans existing docs → produces gap report                │  │
│  │  Output: .claude/verbosity-reports/                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Updated Execution Lifecycle

```
LOAD → ROUTE → PLAN → VERBOSITY-SCOPE → EXECUTE → VERBOSITY-ENFORCE → CITATIONS → SANITY-CHECK → VERIFY → LOG → INDEX
```

| Phase | What Happens | When |
|-------|-------------|------|
| **VERBOSITY-SCOPE** | Read source files, count documentable items, record scope manifest, evaluate delegation need | Before any operation that creates or modifies docs |
| **VERBOSITY-ENFORCE** | Count output items vs scope targets, scan for summarization language, flag gaps, block if incomplete | After any operation that creates or modifies docs |

### 3.3 New File Inventory

| File | Location | Type | Purpose |
|------|----------|------|---------|
| `docs-verbosity-engine.md` | `docs/claude-code-docs-system/` | Core system file | Behavioral rules, CoT directives, agent propagation, context management |
| `docs-system-config.md` §5 | `docs/claude-code-docs-system/` | Config addition | Thresholds, banned phrases, delegation sizing, audit settings |
| `cc-verbosity-scope.md` | `docs/claude-code-docs-system/instructions/` | Sub-instruction | Pre-EXECUTE scope counting and delegation planning |
| `cc-verbosity-enforce.md` | `docs/claude-code-docs-system/instructions/` | Sub-instruction | Post-EXECUTE completeness audit and gap detection |
| `cc-verbosity-audit.md` | `docs/claude-code-docs-system/instructions/` | Primary instruction | Standalone audit command producing gap reports |
| Skill: `docs-verbosity-audit` | `.claude/skills/` | Skill | User-facing `/docs-verbosity-audit` invocation |

---

## 4. Component Specifications

### 4.1 Core Engine: `docs-verbosity-engine.md`

**Purpose**: The behavioral anchor loaded during LOAD phase. Sets the anti-compression frame before any command logic runs. Written to be read by both the main thread AND any spawned agents.

**Location**: `docs/claude-code-docs-system/docs-verbosity-engine.md`

**Loaded by**: `docs-system.md` bootstrap sequence (new item #2 in the loading order — after `docs-standards.md`, before `docs-system-config.md`)

**Content structure**:

#### §1: Anti-Compression Directive

The opening section — the most important text in the file. Written as a behavioral override that targets CoT-level reasoning. Must be:
- Direct and unambiguous
- Framed as non-negotiable constraints
- Explicit about what behaviors are banned
- Clear about what to do instead of compressing

Key directives:
1. **EXHAUSTIVE DOCUMENTATION IS MANDATORY** — Every public function, every parameter, every hook, every return type in the source code MUST appear in the documentation output. No exceptions.
2. **NEVER SUMMARIZE ENUMERABLES** — If source code contains a list, array, switch statement, or set of discrete items, you MUST enumerate every single one. Phrases like "various", "and more", "etc.", "among others", "similar to above", "and so on", "remaining items", or any pattern matching `\d+ (more|additional|other)` are BANNED.
3. **NEVER TRUNCATE FOR BREVITY** — If an API Reference table needs 45 rows, write 45 rows. If a section needs 12 paragraphs, write 12 paragraphs. Length is not a concern — completeness is the ONLY concern.
4. **NEVER SELF-JUSTIFY COMPRESSION** — Do not reason in your chain of thought that "the key functions are covered" or "I'll focus on the important ones." All items are important. There are no "key" items — there are ALL items.
5. **CONTEXT PRESSURE IS NOT AN EXCUSE** — If your context window is filling up, the correct response is to STOP GENERATING AND DELEGATE to an agent, or to CHECKPOINT for continuation. The correct response is NEVER to compress, abbreviate, or summarize to fit.

#### §2: Context Window Management Strategy

When documentation scope exceeds what can be handled in a single context window:

**Tier 1: Chunk-and-Delegate (preferred)**
- Pre-calculate total scope during VERBOSITY-SCOPE phase
- Divide work into chunks based on `docs-system-config.md` §5 delegation thresholds
- Spawn agents for each chunk with instructions to read this file
- Each agent works on its chunk at full verbosity
- Main thread reassembles results

**Tier 2: Checkpoint-and-Continue (fallback)**
- When delegation is insufficient or context pressure builds during a single doc
- Create a checkpoint file at `.claude/verbosity-checkpoints/{doc-name}-{timestamp}.md`
- Checkpoint records: what has been completed, what remains, the scope manifest
- Report to user that continuation is needed
- On re-invocation, read checkpoint and resume from where work stopped

**Decision criteria**:
- If VERBOSITY-SCOPE estimates >50 functions to document OR >8 doc files: Tier 1 (delegate)
- If mid-generation context pressure detected (estimated >75% context usage): Tier 2 (checkpoint)
- If both conditions met: Tier 1 first, Tier 2 within individual agent if needed

#### §3: Agent Propagation Protocol

Every agent spawned by a documentation command MUST be instructed to read `docs-verbosity-engine.md` as part of its task prompt. The spawn instruction must include:

```
REQUIRED READING: Before beginning work, read the file at
docs/claude-code-docs-system/docs-verbosity-engine.md
This file contains non-negotiable verbosity enforcement rules.
You MUST follow every directive in that file. Failure to document
every item in your assigned scope is a critical violation.

Your assigned scope is: [SCOPE MANIFEST EXCERPT]
Expected output: [N] functions, [M] parameters, [P] sections.
Your output MUST contain all [N] functions. Count before submitting.
```

The scope manifest excerpt gives the agent a concrete, countable target. This prevents the "I think I've covered everything" reasoning failure — the agent knows exactly how many items it must produce.

#### §4: Banned Phrases and Patterns

Maintained in `docs-system-config.md` §5 but documented here for behavioral framing.

**Banned phrases** (case-insensitive, trigger immediate correction):
- "and more"
- "etc."
- "et cetera"
- "similar to above"
- "various" (when used to avoid enumeration)
- "among others"
- "and so on"
- "remaining"
- "and additional"
- "the rest"
- "likewise"  (when used to skip repetitive documentation)
- "as above" (when used to skip repetitive documentation)
- "other similar" (when used to avoid enumeration)
- "numerous" (when used to avoid counting)
- "several" (when used to avoid enumeration of known items)
- "a number of" (when used to avoid enumeration of known items)

**Banned patterns** (regex, trigger immediate correction):
- `\d+\s+(more|additional|other|remaining|further|extra)\b`
- `see (above|previous|earlier) for (similar|more|details)`
- `(handles?|supports?|includes?|provides?)\s+(various|multiple|many|several|different)\b` — when the specific items are knowable from source code
- `…` or `...` used to indicate omission of list items

**The correction**: When a banned phrase or pattern is detected (in self-review or by VERBOSITY-ENFORCE), the section MUST be rewritten with the specific enumerated items replacing the vague language. If the items are not knowable from available source, use `[NEEDS INVESTIGATION]` per Integrity Rule #6.

#### §5: Scope Manifest Format

The scope manifest is a structured count of documentable items, produced during VERBOSITY-SCOPE and consumed by VERBOSITY-ENFORCE.

```markdown
## Scope Manifest: {doc_file_path}

**Source file(s)**: {source_file_path(s)}
**Generated**: {timestamp}

| Category | Count | Items |
|----------|-------|-------|
| Public functions | 23 | get_foo, set_bar, render_baz, ... (all 23 listed) |
| Parameters (total) | 47 | (sum across all functions) |
| Hooks registered | 3 | fp_after_post, fp_before_render, fp_api_response |
| Constants defined | 2 | FP_MAX_RELATED, FP_CACHE_TTL |
| Enumerables detected | 4 | post_types array (L45), formats switch (L89), ... |

**Target row count for API Reference table**: 23
**Target parameter documentation count**: 47
```

The manifest is held in working memory (not written to disk during normal operations — only the audit command persists manifests). It is the countable contract that VERBOSITY-ENFORCE checks against.

#### §6: Self-Audit Protocol

After generating any documentation section, you MUST perform a self-audit before proceeding:

1. **Count check**: How many functions/items did I just document? Does it match the scope manifest target?
2. **Phrase scan**: Re-read your output for any banned phrases from §4. If found, fix immediately.
3. **Completeness scan**: For API Reference tables, count the rows. For prose sections, verify all enumerable items from source are explicitly named.
4. **If discrepancy found**: Do NOT proceed to the next section. Fix the current section first.

This protocol runs **within** the generation phase, not as a separate post-step. It is part of the writing process, not the validation process.

---

### 4.2 Configuration: `docs-system-config.md` §5

**Added to**: `docs/claude-code-docs-system/docs-system-config.md`

```yaml
## §5: Verbosity Engine

verbosity:
  # Master switch — when true, VERBOSITY-SCOPE and VERBOSITY-ENFORCE
  # phases are active in the execution lifecycle
  enabled: true

  # Maximum allowed gap between source item count and documented item count.
  # 0 = zero tolerance (every source item MUST be documented).
  # 0.05 = 5% tolerance (e.g., 1 of 20 items can be missing before flagging).
  gap_tolerance: 0

  # Chunk-and-delegate thresholds for context management
  chunk_delegation:
    # Max docs a single agent should process in one pass
    max_docs_per_agent: 8
    # Max functions a single agent should document in one pass
    max_functions_per_agent: 50
    # When total scope exceeds these, auto-delegate to agents
    delegation_trigger_docs: 8
    delegation_trigger_functions: 50

  # Checkpoint configuration for context exhaustion fallback
  checkpoint:
    # Estimated context usage percentage that triggers checkpointing
    trigger_at_context_pct: 75
    # Directory for checkpoint files
    save_to: .claude/verbosity-checkpoints/
    # Auto-clean checkpoints older than N days
    retention_days: 7

  # Banned summarization language (detected by VERBOSITY-ENFORCE)
  summarization_detection:
    banned_phrases:
      - "and more"
      - "etc."
      - "et cetera"
      - "similar to above"
      - "various"
      - "among others"
      - "and so on"
      - "remaining"
      - "and additional"
      - "the rest"
      - "likewise"
      - "as above"
      - "other similar"
      - "numerous"
      - "several"
      - "a number of"
    banned_patterns:
      - "\\d+\\s+(more|additional|other|remaining|further|extra)\\b"
      - "see (above|previous|earlier) for (similar|more|details)"
      - "(handles?|supports?|includes?|provides?)\\s+(various|multiple|many|several|different)\\b"
      - "\\.{3}|…"  # ellipsis used as list omission

  # Verbosity audit report configuration
  audit:
    report_dir: .claude/verbosity-reports/
    severity_thresholds:
      low: 0.05     # <5% gap between expected and actual
      medium: 0.10   # 5-10% gap
      high: 0.10     # >10% gap
    # Include summarization phrase detection in audit
    detect_summarization: true
    # Include enumerable expansion check in audit
    detect_unexpanded_enumerables: true
```

---

### 4.3 Scope Sub-Instruction: `cc-verbosity-scope.md`

**Purpose**: Pre-EXECUTE phase that counts documentable items and creates a scope manifest. Also determines whether chunk-and-delegate is needed.

**Location**: `docs/claude-code-docs-system/instructions/cc-verbosity-scope.md`

**Called by**: Every instruction that creates or modifies documentation (cc-revise, cc-add, cc-auto-update, cc-auto-revise, cc-api-ref). Called automatically as part of lifecycle — individual instructions reference it at the appropriate step.

**Steps**:

1. **Read source files** identified by the parent command. For each source file:
   a. Count public functions/methods (exclude private helpers, closures, anonymous functions)
   b. Count total parameters across all public functions
   c. Count hooks registered (`add_action`, `add_filter`)
   d. Count constants defined
   e. Identify enumerables: arrays, switch/case blocks, if/elseif chains, or any discrete set of items that should be fully listed in documentation

2. **Build the scope manifest** per the format in `docs-verbosity-engine.md` §5. Include the full list of function names — not just a count. This is the countable contract.

3. **Evaluate delegation need** against `docs-system-config.md` §5 thresholds:
   - If total functions > `chunk_delegation.delegation_trigger_functions` OR total docs > `chunk_delegation.delegation_trigger_docs`:
     - Divide scope into chunks where each chunk has ≤ `max_functions_per_agent` functions and ≤ `max_docs_per_agent` docs
     - Record the chunk plan (which functions/files go to which agent)
     - Pass each chunk's scope manifest excerpt to its agent via the propagation protocol in `docs-verbosity-engine.md` §3
   - If under thresholds: main thread handles the full scope. Scope manifest is held in working memory.

4. **Report scope summary** to the user:
   ```
   Verbosity scope: {N} functions, {M} params, {P} hooks across {D} doc(s)
   Strategy: {direct | delegated to K agents}
   ```

**Skip conditions**: If `verbosity.enabled` is `false` in config, skip this phase entirely.

---

### 4.4 Enforce Sub-Instruction: `cc-verbosity-enforce.md`

**Purpose**: Post-EXECUTE phase that audits generated output against the scope manifest and blocks progression if gaps are found.

**Location**: `docs/claude-code-docs-system/instructions/cc-verbosity-enforce.md`

**Called by**: Automatically after EXECUTE phase in the lifecycle, before CITATIONS phase. Also callable standalone for mid-flight checks during long operations.

**Steps**:

1. **Retrieve scope manifest** from VERBOSITY-SCOPE phase (or from checkpoint if resuming).

2. **Count output items** in the generated/modified documentation:
   a. Count rows in API Reference table(s)
   b. Count documented parameters (across all function descriptions and API ref table entries)
   c. Count documented hooks
   d. Count documented constants
   e. For each enumerable identified in scope: verify all items are explicitly listed

3. **Compare counts** against scope manifest:

   | Category | Manifest Target | Output Count | Gap | Status |
   |----------|----------------|--------------|-----|--------|
   | Functions | 23 | 23 | 0 | ✅ PASS |
   | Parameters | 47 | 41 | 6 | ❌ FAIL |
   | Hooks | 3 | 3 | 0 | ✅ PASS |
   | Enumerables | 4 expanded | 3 expanded | 1 | ❌ FAIL |

4. **Scan for banned phrases** from `docs-system-config.md` §5:
   - Read the generated documentation content
   - Check each banned phrase and pattern
   - Record all matches with line numbers and surrounding context

5. **Determine enforcement result**:
   - **PASS**: All counts match (within `gap_tolerance`), no banned phrases detected → proceed to CITATIONS
   - **FAIL**: Gaps found OR banned phrases detected → BLOCK. Do not proceed. Instead:
     a. Report the specific gaps and violations to the user
     b. List the exact missing items (function names, param names, unexpanded enumerables)
     c. Remediate: re-generate the incomplete sections
     d. Re-run VERBOSITY-ENFORCE on the remediated output
     e. Only proceed when PASS is achieved

6. **Context exhaustion handling**: If remediation cannot be completed due to context pressure:
   a. Write checkpoint to `{checkpoint.save_to}/{doc-name}-{timestamp}.md`
   b. Checkpoint includes: scope manifest, what's done, what's remaining, gap report
   c. Inform user: "Verbosity enforcement detected incomplete documentation but context is limited. Checkpoint saved. Re-invoke to continue."

**Skip conditions**: If `verbosity.enabled` is `false` in config, skip this phase entirely.

---

### 4.5 Audit Command: `cc-verbosity-audit.md`

**Purpose**: Standalone command that scans existing documentation against source code and produces a comprehensive verbosity gap report. Report-only — does not modify documentation.

**Location**: `docs/claude-code-docs-system/instructions/cc-verbosity-audit.md`

**Invoked by**: `/docs-verbosity-audit` skill or direct prompt

**Arguments**:
- `[scope]` — optional: specific doc path, section number, or `--all` for full codebase
- `--section NN` — limit to docs in section NN
- `--layer {helpers|post-types|taxonomies|rest|javascript|integrations}` — limit to specific API ref layer
- `--save` — persist report to `.claude/verbosity-reports/` (default: display only)
- `--fix-ready` — format report as input for `/docs-revise` (adds suggested fix descriptions)

**Steps**:

1. **Determine scope**:
   - If `--all`: use `docs-system.md` §4 mapping table to enumerate all source → doc pairs
   - If `--section NN`: enumerate docs in `docs/{NN}-*/`
   - If `--layer X`: enumerate docs in the API ref layer matching X
   - If specific path: audit only that doc
   - Read `PROJECT-INDEX.md` if needed for source file enumeration

2. **For each doc in scope**, run the scope analysis:
   a. Identify the source file(s) mapped to this doc (via §4 mapping table)
   b. Read source file(s), count all documentable items (same logic as `cc-verbosity-scope.md`)
   c. Read the existing doc file
   d. Count documented items in the doc (API ref rows, documented params, prose enumerations)
   e. Compare counts

3. **Scan for summarization language** in each doc:
   - Apply banned phrases and patterns from `docs-system-config.md` §5
   - For each match, record: file path, line number, the matched phrase, surrounding context
   - Determine if the phrase genuinely represents an avoidable summarization (context check: "various" in a heading is different from "handles various post types" when post types are enumerable)

4. **Detect unexpanded enumerables**:
   - In source code: find arrays, switch statements, if/elseif chains, constants that define sets
   - In documentation: check if the doc explicitly names each item in the set
   - Flag cases where the doc uses generic language instead of explicit enumeration

5. **Calculate severity** per doc:
   - Count total expected items vs total actual items
   - Gap percentage = (expected - actual) / expected
   - Severity: LOW (<5%), MEDIUM (5-10%), HIGH (>10%) per config thresholds
   - Any banned phrase match is automatically MEDIUM or higher

6. **Generate report** in structured markdown format:

```markdown
# Verbosity Audit Report

**Generated**: {date}
**Scope**: {description of scope}
**Result**: {N} docs audited, {M} with gaps, {P} clean

---

## Summary

| Severity | Count | Docs |
|----------|-------|------|
| HIGH | 3 | posts.md, environment.md, piano.md |
| MEDIUM | 5 | authors.md, sailthru.md, ... |
| LOW | 2 | meilisearch.md, chartbeat.md |
| CLEAN | 12 | (no issues) |

---

## HIGH Severity

### docs/06-helpers/posts.md

**Source**: `helpers/posts.php`

| Metric | Expected | Actual | Gap |
|--------|----------|--------|-----|
| Functions in API Ref | 23 | 18 | 5 MISSING |
| Params documented | 47 | 41 | 6 MISSING |
| Hooks documented | 3 | 3 | 0 |
| Enumerables expanded | 4 | 2 | 2 UNEXPANDED |

#### Missing Functions
1. `get_related_posts()` — present in source L145, absent from API Reference
2. `format_byline()` — present in source L203, absent from API Reference
3. `get_post_thumbnail_url()` — present in source L267, absent from API Reference
4. `normalize_post_data()` — present in source L312, absent from API Reference
5. `get_reading_time()` — present in source L358, absent from API Reference

#### Missing Parameters
1. `$tag` param on `get_posts_by_tax()` — 3rd param (string), omitted from API Ref table
2. `$format` param on `get_post_content()` — 2nd param (string), omitted from API Ref table
(... all 6 listed ...)

#### Unexpanded Enumerables
1. **L45**: "Handles various post formats" → Source shows: `standard`, `video`, `audio`, `gallery`, `link`, `quote` (6 items)
2. **L89**: "Supports multiple taxonomies" → Source shows: `category`, `post_tag`, `channel`, `region`, `topic` (5 items)

#### Summarization Language Detected
1. **L45**: "Handles **various** post formats" — banned phrase "various" avoiding enumeration
2. **L112**: "**and more**" at end of list — banned phrase "and more"

**Severity**: HIGH (21.7% function gap)

---

## MEDIUM Severity
(... same structure per doc ...)

## LOW Severity
(... same structure per doc ...)
```

7. **If `--save` flag**: Write report to `{audit.report_dir}/verbosity-audit-{date}.md`

8. **If `--fix-ready` flag**: Append a section to the report:

```markdown
## Fix-Ready Descriptions (for /docs-revise)

1. **docs/06-helpers/posts.md**: Add 5 missing functions to API Reference table (get_related_posts, format_byline, get_post_thumbnail_url, normalize_post_data, get_reading_time). Add 6 missing parameters. Expand 2 enumerables. Remove 2 summarization phrases.

2. **docs/06-helpers/authors.md**: ...
```

These descriptions can be copy-pasted into `/docs-revise` invocations.

---

### 4.6 Skill: `docs-verbosity-audit`

**Skill file**: `.claude/skills/docs-verbosity-audit.md` (and source copy in `docs/claude-code-config/.claude/skills/`)

**Invocation**: `/docs-verbosity-audit [scope] [flags]`

**Prompt template** (in `docs-prompts.md`):

```
Read `docs/claude-code-docs-system/docs-system.md` to bootstrap. Then execute `cc-verbosity-audit.md` with scope: {scope} and flags: {flags}.
```

---

## 5. Integration Points

### 5.1 Bootstrap Sequence Update (`docs-system.md` §2)

Current bootstrap reads (in order):
1. `docs-standards.md`
2. `docs-system-config.md`
3. `docs-commands-list.md`

Updated bootstrap reads (in order):
1. `docs-standards.md`
2. **`docs-verbosity-engine.md`** ← NEW (loaded early to set behavioral frame)
3. `docs-system-config.md` (now includes §5 verbosity config)
4. `docs-commands-list.md`

Rationale: The engine is loaded before config so that the behavioral directives are established first. The config then provides the specific thresholds referenced by the engine.

### 5.2 Lifecycle Update (`docs-system.md` §3)

Current lifecycle:
```
LOAD → ROUTE → PLAN → EXECUTE → CITATIONS → SANITY-CHECK → VERIFY → LOG → INDEX
```

Updated lifecycle:
```
LOAD → ROUTE → PLAN → VERBOSITY-SCOPE → EXECUTE → VERBOSITY-ENFORCE → CITATIONS → SANITY-CHECK → VERIFY → LOG → INDEX
```

New lifecycle table rows:

| Phase | What Happens | When |
|-------|-------------|------|
| **VERBOSITY-SCOPE** | Run `cc-verbosity-scope.md`: count source items, build scope manifest, evaluate delegation need | Before any operation that creates or modifies docs (unless `verbosity.enabled` is `false`) |
| **VERBOSITY-ENFORCE** | Run `cc-verbosity-enforce.md`: count output vs scope manifest, scan for banned phrases, block if gaps found | After any operation that creates or modifies docs (unless `verbosity.enabled` is `false`) |

### 5.3 Integrity Rules Update (`docs-system.md` §5)

Add new rules:

12. (existing: Flag genuine code defects)
13. **NEVER summarize enumerables** — if source code contains a countable set of items (array elements, switch cases, supported types, etc.), documentation MUST list every item explicitly. See `docs-verbosity-engine.md` §4 for banned phrases.
14. **NEVER truncate for context savings** — if documentation scope exceeds context capacity, delegate to agents or checkpoint for continuation. NEVER compress output to fit.
15. **Scope manifests are contracts** — the item counts established during VERBOSITY-SCOPE are binding targets. VERBOSITY-ENFORCE blocks progression if targets are not met.

### 5.4 Instruction File Updates

The following instruction files need a step added to invoke VERBOSITY-SCOPE before their main execution and VERBOSITY-ENFORCE after:

| Instruction File | Integration Point |
|-----------------|-------------------|
| `cc-revise.md` | After Step 2 (read source), add: "Run `cc-verbosity-scope.md`". After main generation step, add: "Run `cc-verbosity-enforce.md`" |
| `cc-add.md` | After Step 3 (read source), add scope step. After Step 5 (generate doc), add enforce step |
| `cc-auto-update.md` | After Phase 1 diff analysis, add scope step per affected doc. After each doc is updated in Phase 2, add enforce step |
| `cc-auto-revise.md` | Per-item: after reading source, add scope. After generating revision, add enforce |
| `cc-api-ref.md` | After Step 2 (read source), add scope (function count is the primary target). After Step 4 (generate table), add enforce |
| `cc-citations-generate.md` | No change — citations don't generate prose or tables, they excerpt source code |

### 5.5 Commands List Update (`docs-commands-list.md`)

Add new entry:

```markdown
### verbosity-audit

**Instruction file**: `instructions/cc-verbosity-audit.md`
**Skill**: `/docs-verbosity-audit`
**Flags**: `--all`, `--section NN`, `--layer X`, `--save`, `--fix-ready`
**Description**: Scan existing documentation for verbosity gaps — missing items, summarization language, unexpanded enumerables. Report-only (no auto-fix).
```

### 5.6 Verify Checklist Update (`cc-verify.md`)

Add Check 10 (current last check is 9):

**Check 10: Verbosity Compliance**
- Spot-check 3 randomly selected doc files from the operation scope
- For each: count API Reference rows vs public functions in source
- Flag if any gap exceeds `verbosity.gap_tolerance`
- Scan for any banned phrases from `docs-system-config.md` §5
- Report: `Check 10 (Verbosity): PASS | FAIL — {details}`

---

## 6. Implementation Plan

### Phase 1: Core Engine + Configuration
**Scope**: Create `docs-verbosity-engine.md` and add §5 to `docs-system-config.md`
**Deliverables**:
- `docs/claude-code-docs-system/docs-verbosity-engine.md` — full content per §4.1 spec
- `docs/claude-code-docs-system/docs-system-config.md` — §5 added per §4.2 spec

### Phase 2: Sub-Instructions
**Scope**: Create the scope and enforce instruction files
**Deliverables**:
- `docs/claude-code-docs-system/instructions/cc-verbosity-scope.md`
- `docs/claude-code-docs-system/instructions/cc-verbosity-enforce.md`

### Phase 3: Audit Command + Skill
**Scope**: Create the standalone audit command and its skill
**Deliverables**:
- `docs/claude-code-docs-system/instructions/cc-verbosity-audit.md`
- `.claude/skills/docs-verbosity-audit.md` (active copy)
- `docs/claude-code-config/.claude/skills/docs-verbosity-audit.md` (source copy)

### Phase 4: System Integration
**Scope**: Update existing system files to integrate the engine
**Deliverables**:
- `docs-system.md` — updated §2 (bootstrap), §3 (lifecycle), §5 (integrity rules)
- `docs-commands-list.md` — new verbosity-audit entry
- `cc-verify.md` — Check 10 added

### Phase 5: Instruction File Updates
**Scope**: Add VERBOSITY-SCOPE and VERBOSITY-ENFORCE calls to existing instruction files
**Deliverables**:
- `cc-revise.md` — steps added
- `cc-add.md` — steps added
- `cc-auto-update.md` — steps added
- `cc-auto-revise.md` — steps added
- `cc-api-ref.md` — steps added

### Phase 6: Command Registration Chain
**Scope**: Update all downstream registration points for the new command
**Deliverables**:
- `docs-prompts.md` — new prompt template for verbosity-audit
- `docs-management.md` — new command entry and examples
- `example-CLAUDE.md` — skill table updated
- `.claude/CLAUDE.md` — skill table updated

### Phase 7: Validation
**Scope**: Test the system end-to-end
**Method**:
- Run `/docs-verbosity-audit --all --save` to baseline current gaps
- Run `/docs-revise` on a doc with known gaps to verify SCOPE → EXECUTE → ENFORCE lifecycle
- Verify agent delegation by running `/docs-api-ref --layer helpers` (large enough to trigger delegation)
- Confirm banned phrase detection catches known summarization language

---

## 7. File Manifest

### New Files (6)

| # | File | Type |
|---|------|------|
| 1 | `docs/claude-code-docs-system/docs-verbosity-engine.md` | Core system file |
| 2 | `docs/claude-code-docs-system/instructions/cc-verbosity-scope.md` | Sub-instruction |
| 3 | `docs/claude-code-docs-system/instructions/cc-verbosity-enforce.md` | Sub-instruction |
| 4 | `docs/claude-code-docs-system/instructions/cc-verbosity-audit.md` | Primary instruction |
| 5 | `.claude/skills/docs-verbosity-audit.md` | Active skill |
| 6 | `docs/claude-code-config/.claude/skills/docs-verbosity-audit.md` | Source skill |

### Modified Files (11+)

| # | File | Change |
|---|------|--------|
| 1 | `docs/claude-code-docs-system/docs-system.md` | §2 bootstrap, §3 lifecycle, §5 integrity rules |
| 2 | `docs/claude-code-docs-system/docs-system-config.md` | §5 verbosity engine config |
| 3 | `docs/claude-code-docs-system/docs-commands-list.md` | verbosity-audit command entry |
| 4 | `docs/claude-code-docs-system/instructions/cc-verify.md` | Check 10 |
| 5 | `docs/claude-code-docs-system/instructions/cc-revise.md` | Scope + enforce steps |
| 6 | `docs/claude-code-docs-system/instructions/cc-add.md` | Scope + enforce steps |
| 7 | `docs/claude-code-docs-system/instructions/cc-auto-update.md` | Scope + enforce steps |
| 8 | `docs/claude-code-docs-system/instructions/cc-auto-revise.md` | Scope + enforce steps |
| 9 | `docs/claude-code-docs-system/instructions/cc-api-ref.md` | Scope + enforce steps |
| 10 | `docs/docs-prompts.md` | New prompt template |
| 11 | `docs/docs-management.md` | New command documentation |

### Directories Created (2, on demand)

| Directory | Purpose |
|-----------|---------|
| `.claude/verbosity-checkpoints/` | Checkpoint files for continuation |
| `.claude/verbosity-reports/` | Audit reports |

---

## 8. Command Registration Chain

For the new `/docs-verbosity-audit` command, all registration points:

1. ✅ Instruction file: `cc-verbosity-audit.md`
2. ✅ `docs-commands-list.md`: new entry
3. ✅ `docs-prompts.md`: new prompt template
4. ✅ `docs-management.md`: new command entry
5. ✅ Skill files: source + active copies
6. ✅ `example-CLAUDE.md`: skill table row
7. ✅ `.claude/CLAUDE.md`: skill table row

For the sub-instructions (`cc-verbosity-scope.md`, `cc-verbosity-enforce.md`):
- These are NOT user-facing commands — no skill, no prompt template, no management entry
- They ARE referenced from `docs-commands-list.md` as sub-instructions (like `cc-planning.md`)
- They ARE called by instruction files that have their own user-facing commands

---

## Design Rationale: Why This Works

### Against CoT-Level Compression
The engine file uses **directive language** that targets reasoning patterns:
- "NEVER self-justify compression" directly addresses the CoT tendency to rationalize brevity
- "Context pressure is NOT an excuse" preempts the most common reasoning for truncation
- Concrete countable targets (scope manifests) replace subjective "I've covered enough" judgments

### Against Agent-Level Compression
Full file reference (not a preamble summary) means agents get the complete behavioral frame, not a lossy compression of it. The scope manifest excerpt in the spawn prompt gives agents **countable accountability** — they know exactly how many items they must produce.

### Against Context Exhaustion
The two-tier strategy (delegate → checkpoint) means context pressure NEVER leads to content compression. The pressure valve is always "split the work" not "shrink the output."

### Against Post-Hoc Detection Gaps
VERBOSITY-ENFORCE runs BEFORE citations and sanity-check, meaning gaps are caught early when they're cheapest to fix. The self-audit protocol in the engine file catches issues even earlier — during generation itself.

### Configurable Without Being Soft
Zero-tolerance is the default (`gap_tolerance: 0`), but thresholds exist for pragmatic edge cases (e.g., a doc covering a 200-function utility file where 1 private helper was miscounted as public). The configuration doesn't weaken the system — it makes it adaptable without abandoning its principles.
