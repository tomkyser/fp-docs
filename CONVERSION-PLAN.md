# fp-docs Architecture Conversion Plan

> **Purpose:** Exhaustive, gap-free plan to convert fp-docs from its current plugin-system architecture to GSD-style command-workflow-agent architecture, while preserving all fp-docs domain logic, the three-repo git model, and the accuracy guarantee.
>
> **Generated:** 2026-03-29
> **Branch:** dev
> **Source Documents:**
> - `fp-docs-current-state.md` -- Complete fp-docs architecture inventory
> - `gsd-architecture-analysis.md` -- Complete GSD architecture analysis
> - `CLAUDE.md` -- Project governance, version rules, repo layout
>
> **Governing Principle:** Adopt GSD's ARCHITECTURE (command-workflow-agent chain, XML prompt structure, CLI-driven orchestration, @-reference context loading, workflow-as-orchestrator) while preserving fp-docs' DOMAIN LOGIC (pipeline enforcement, three-repo git, accuracy guarantee, citation system, locals contracts, verbosity enforcement, source-map-driven operations).

---

## Table of Contents

1. [Part 1: Architecture Mapping](#part-1-architecture-mapping)
2. [Part 2: Conversion Phases](#part-2-conversion-phases)
3. [Part 3: File-Level Change Specification](#part-3-file-level-change-specification)
4. [Part 4: Critical Decisions and Open Questions](#part-4-critical-decisions-and-open-questions)
5. [Part 5: Risk Assessment](#part-5-risk-assessment)
6. [Part 6: Adversarial Review](#part-6-adversarial-review)

---

## Part 1: Architecture Mapping

### 1.1 Skill-to-Command Mapping (All 23 Skills)

Every fp-docs skill in `skills/{name}/SKILL.md` converts to a GSD-style command in `commands/fp-docs/{name}.md`.

**Key transformation:** Skills use `context: fork` + `agent: orchestrate` frontmatter and plain-text routing metadata (Engine/Operation/Instruction). Commands use `allowed-tools` frontmatter and XML body with `@-reference` to a workflow file.

| # | Current Skill | Current Path | New Command | New Path | Workflow Referenced |
|---|--------------|-------------|-------------|----------|-------------------|
| 1 | `revise` | `skills/revise/SKILL.md` | `fp-docs:revise` | `commands/fp-docs/revise.md` | `workflows/revise.md` |
| 2 | `add` | `skills/add/SKILL.md` | `fp-docs:add` | `commands/fp-docs/add.md` | `workflows/add.md` |
| 3 | `auto-update` | `skills/auto-update/SKILL.md` | `fp-docs:auto-update` | `commands/fp-docs/auto-update.md` | `workflows/auto-update.md` |
| 4 | `auto-revise` | `skills/auto-revise/SKILL.md` | `fp-docs:auto-revise` | `commands/fp-docs/auto-revise.md` | `workflows/auto-revise.md` |
| 5 | `deprecate` | `skills/deprecate/SKILL.md` | `fp-docs:deprecate` | `commands/fp-docs/deprecate.md` | `workflows/deprecate.md` |
| 6 | `audit` | `skills/audit/SKILL.md` | `fp-docs:audit` | `commands/fp-docs/audit.md` | `workflows/audit.md` |
| 7 | `verify` | `skills/verify/SKILL.md` | `fp-docs:verify` | `commands/fp-docs/verify.md` | `workflows/verify.md` |
| 8 | `sanity-check` | `skills/sanity-check/SKILL.md` | `fp-docs:sanity-check` | `commands/fp-docs/sanity-check.md` | `workflows/sanity-check.md` |
| 9 | `test` | `skills/test/SKILL.md` | `fp-docs:test` | `commands/fp-docs/test.md` | `workflows/test.md` |
| 10 | `citations` | `skills/citations/SKILL.md` | `fp-docs:citations` | `commands/fp-docs/citations.md` | `workflows/citations.md` |
| 11 | `api-ref` | `skills/api-ref/SKILL.md` | `fp-docs:api-ref` | `commands/fp-docs/api-ref.md` | `workflows/api-ref.md` |
| 12 | `locals` | `skills/locals/SKILL.md` | `fp-docs:locals` | `commands/fp-docs/locals.md` | `workflows/locals.md` |
| 13 | `verbosity-audit` | `skills/verbosity-audit/SKILL.md` | `fp-docs:verbosity-audit` | `commands/fp-docs/verbosity-audit.md` | `workflows/verbosity-audit.md` |
| 14 | `update-index` | `skills/update-index/SKILL.md` | `fp-docs:update-index` | `commands/fp-docs/update-index.md` | `workflows/update-index.md` |
| 15 | `update-claude` | `skills/update-claude/SKILL.md` | `fp-docs:update-claude` | `commands/fp-docs/update-claude.md` | `workflows/update-claude.md` |
| 16 | `update-skills` | `skills/update-skills/SKILL.md` | `fp-docs:update-skills` | `commands/fp-docs/update-skills.md` | `workflows/update-skills.md` |
| 17 | `setup` | `skills/setup/SKILL.md` | `fp-docs:setup` | `commands/fp-docs/setup.md` | `workflows/setup.md` |
| 18 | `sync` | `skills/sync/SKILL.md` | `fp-docs:sync` | `commands/fp-docs/sync.md` | `workflows/sync.md` |
| 19 | `update` | `skills/update/SKILL.md` | `fp-docs:update` | `commands/fp-docs/update.md` | `workflows/update.md` |
| 20 | `parallel` | `skills/parallel/SKILL.md` | `fp-docs:parallel` | `commands/fp-docs/parallel.md` | `workflows/parallel.md` |
| 21 | `remediate` | `skills/remediate/SKILL.md` | `fp-docs:remediate` | `commands/fp-docs/remediate.md` | `workflows/remediate.md` |
| 22 | `do` | `skills/do/SKILL.md` | `fp-docs:do` | `commands/fp-docs/do.md` | `workflows/do.md` |
| 23 | `help` | `skills/help/SKILL.md` | `fp-docs:help` | `commands/fp-docs/help.md` | `workflows/help.md` |

**Frontmatter transformation (before/after):**

Current skill frontmatter (`skills/revise/SKILL.md`):
```yaml
---
description: Fix specific documentation you know is wrong or outdated...
argument-hint: "description of what to fix"
context: fork
agent: orchestrate
---

Engine: modify
Operation: revise
Instruction: framework/instructions/modify/revise.md

User request: $ARGUMENTS
```

New command frontmatter (`commands/fp-docs/revise.md`):
```yaml
---
name: fp-docs:revise
description: Fix specific documentation you know is wrong or outdated. Provide a description of what needs fixing and the engine will locate, update, and validate the affected docs.
argument-hint: "description of what to fix"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
---
```

New command body:
```xml
<objective>
Locate, update, and validate documentation that the user identifies as wrong or outdated.
The workflow handles research, planning, modification, pipeline enforcement (verbosity,
citations, API refs, sanity-check, verification), changelog, index update, and git commit.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/revise.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>

<context>
Arguments: $ARGUMENTS
Operation type: write (full pipeline required)
</context>

<process>
Execute the revise workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/revise.md end-to-end.
Preserve all pipeline gates (verbosity, citations, API refs, sanity-check, verification,
changelog, index, docs commit).
</process>

<success_criteria>
- [ ] Target documentation identified and updated
- [ ] All claims verified against source code
- [ ] Pipeline enforcement stages completed
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
```

### 1.2 Agent/Engine-to-Agent Mapping (All 11 Engines)

fp-docs has 11 engine agents (9 original + researcher + planner). These map to focused agents in the new architecture. The key difference: fp-docs engines are domain-specific (modify owns all write operations), while GSD agents are role-specific (executor does execution, checker does checking).

**The conversion preserves fp-docs' domain-specific agents** because fp-docs operations require deep domain knowledge that role-generic agents cannot provide. A generic "executor" cannot know citation rules, locals contract format, or verbosity standards. fp-docs' specialist engines carry domain-critical knowledge.

| # | Current Engine | Current Path | New Agent | New Path | Change Description |
|---|---------------|-------------|-----------|----------|-------------------|
| 1 | `orchestrate` | `agents/orchestrate.md` | **REMOVED** | N/A | Orchestration moves to workflows. The orchestrate engine's delegation algorithm (`delegate.md`) becomes the logic within each workflow. No central orchestrator agent needed. |
| 2 | `modify` | `agents/modify.md` | `fp-docs-modifier` | `agents/fp-docs-modifier.md` | Retains domain knowledge for doc creation/modification. Drops delegation mode sections. Adds GSD-style XML body structure. |
| 3 | `validate` | `agents/validate.md` | `fp-docs-validator` | `agents/fp-docs-validator.md` | Retains read-only enforcement, 10-point verification. Drops delegation mode sections. |
| 4 | `citations` | `agents/citations.md` | `fp-docs-citations` | `agents/fp-docs-citations.md` | Retains citation generation/audit domain knowledge. |
| 5 | `api-refs` | `agents/api-refs.md` | `fp-docs-api-refs` | `agents/fp-docs-api-refs.md` | Retains API reference table domain knowledge. |
| 6 | `locals` | `agents/locals.md` | `fp-docs-locals` | `agents/fp-docs-locals.md` | Retains $locals contract domain knowledge. |
| 7 | `verbosity` | `agents/verbosity.md` | `fp-docs-verbosity` | `agents/fp-docs-verbosity.md` | Retains read-only verbosity scanning. |
| 8 | `index` | `agents/index.md` | `fp-docs-indexer` | `agents/fp-docs-indexer.md` | Retains PROJECT-INDEX.md maintenance. |
| 9 | `system` | `agents/system.md` | `fp-docs-system` | `agents/fp-docs-system.md` | Retains plugin self-maintenance. |
| 10 | `researcher` | `agents/researcher.md` | `fp-docs-researcher` | `agents/fp-docs-researcher.md` | Retains pre-operation code analysis. |
| 11 | `planner` | `agents/planner.md` | `fp-docs-planner` | `agents/fp-docs-planner.md` | Retains execution strategy design. |

**Agent frontmatter transformation (before/after):**

Current agent frontmatter (`agents/modify.md`):
```yaml
---
name: modify
description: |
  Documentation modification engine for the FP codebase...
  <example>
  User: /fp-docs:revise fix the posts helper documentation
  <commentary>
  Targeted documentation fix -- routes to docs-modify with operation "revise".
  </commentary>
  </example>
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
skills:
  - mod-standards
  - mod-project
  - mod-pipeline
  - mod-changelog
  - mod-index
model: opus
color: green
maxTurns: 75
---
```

New agent frontmatter (`agents/fp-docs-modifier.md`):
```yaml
---
name: fp-docs-modifier
description: Documentation modification agent for the FP codebase. Handles revise, add, auto-update, auto-revise, and deprecate operations. Spawned by write operation workflows.
tools: Read, Write, Edit, Bash, Grep, Glob
color: green
---
```

Note: The `model` field is removed (resolved at spawn time by workflow via `fp-tools.cjs resolve-model`). The `maxTurns` field is removed. The `skills` (module preloading) field is removed -- domain knowledge is loaded via `<files_to_read>` blocks in the spawn prompt from the workflow, or inlined into the agent body. The body changes from prose narrative to XML-structured sections (`<role>`, `<project_context>`, `<quality_gate>`, etc.).

### 1.3 Module-to-Reference Mapping (All 11 Modules)

fp-docs modules (`modules/mod-{name}/SKILL.md`) are preloaded into agent context via the `skills:` list. GSD uses references (`references/*.md`) loaded on-demand via `@-reference` in commands. The domain knowledge in modules MUST be preserved -- only the packaging changes.

| # | Current Module | Current Path | New Reference | New Path | Content Change |
|---|---------------|-------------|--------------|----------|---------------|
| 1 | `mod-standards` | `modules/mod-standards/SKILL.md` | `doc-standards.md` | `references/doc-standards.md` | Remove SKILL.md frontmatter (`user-invocable: false`, `disable-model-invocation: true`). Content unchanged. |
| 2 | `mod-project` | `modules/mod-project/SKILL.md` | `fp-project.md` | `references/fp-project.md` | Remove frontmatter. Content unchanged. |
| 3 | `mod-pipeline` | `modules/mod-pipeline/SKILL.md` | `pipeline-enforcement.md` | `references/pipeline-enforcement.md` | Remove frontmatter. Content unchanged. |
| 4 | `mod-orchestration` | `modules/mod-orchestration/SKILL.md` | **REMOVED** | N/A | Orchestration rules are absorbed into workflow logic. Delegation thresholds, execution mode selection, agent count tables move into `fp-tools.cjs` init commands or the workflows themselves. |
| 5 | `mod-citations` | `modules/mod-citations/SKILL.md` | `citation-rules.md` | `references/citation-rules.md` | Remove frontmatter. Content unchanged. |
| 6 | `mod-api-refs` | `modules/mod-api-refs/SKILL.md` | `api-ref-rules.md` | `references/api-ref-rules.md` | Remove frontmatter. Content unchanged. |
| 7 | `mod-changelog` | `modules/mod-changelog/SKILL.md` | `changelog-rules.md` | `references/changelog-rules.md` | Remove frontmatter. Content unchanged. |
| 8 | `mod-index` | `modules/mod-index/SKILL.md` | `index-rules.md` | `references/index-rules.md` | Remove frontmatter. Content unchanged. |
| 9 | `mod-locals` | `modules/mod-locals/SKILL.md` | `locals-rules.md` | `references/locals-rules.md` | Remove frontmatter. Content unchanged. |
| 10 | `mod-verbosity` | `modules/mod-verbosity/SKILL.md` | `verbosity-rules.md` | `references/verbosity-rules.md` | Remove frontmatter. Content unchanged. |
| 11 | `mod-validation` | `modules/mod-validation/SKILL.md` | `validation-rules.md` | `references/validation-rules.md` | Remove frontmatter. Content unchanged. |

**How references are consumed (GSD pattern):**

In commands, via `@-reference`:
```xml
<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/revise.md
@${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
@${CLAUDE_PLUGIN_ROOT}/references/pipeline-enforcement.md
</execution_context>
```

In workflows, via `<files_to_read>` blocks in agent spawn prompts:
```xml
<files_to_read>
- ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
- ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
- ${CLAUDE_PLUGIN_ROOT}/references/verbosity-rules.md
</files_to_read>
```

### 1.4 Instruction File-to-Workflow Mapping (All 30 Instruction Files)

fp-docs instruction files (`framework/instructions/{engine}/{operation}.md`) are read on-demand by engine agents. In the new architecture, these become workflows (`workflows/{name}.md`) that serve as orchestrators -- they load context, spawn agents, and manage the operation flow.

**Key transformation:** Instruction files are passive documents (read by an agent that decides what to do). Workflows are active orchestrators (they execute steps, spawn agents, call CLI tools). The instruction file's procedural content becomes the agent's `<files_to_read>` spawn prompt or the workflow's `<process>` steps.

| # | Current Instruction | Current Path | New Workflow | New Path |
|---|-------------------|-------------|-------------|----------|
| 1 | `modify/revise.md` | `framework/instructions/modify/revise.md` | `revise.md` | `workflows/revise.md` |
| 2 | `modify/add.md` | `framework/instructions/modify/add.md` | `add.md` | `workflows/add.md` |
| 3 | `modify/auto-update.md` | `framework/instructions/modify/auto-update.md` | `auto-update.md` | `workflows/auto-update.md` |
| 4 | `modify/auto-revise.md` | `framework/instructions/modify/auto-revise.md` | `auto-revise.md` | `workflows/auto-revise.md` |
| 5 | `modify/deprecate.md` | `framework/instructions/modify/deprecate.md` | `deprecate.md` | `workflows/deprecate.md` |
| 6 | `validate/audit.md` | `framework/instructions/validate/audit.md` | `audit.md` | `workflows/audit.md` |
| 7 | `validate/verify.md` | `framework/instructions/validate/verify.md` | `verify.md` | `workflows/verify.md` |
| 8 | `validate/sanity-check.md` | `framework/instructions/validate/sanity-check.md` | `sanity-check.md` | `workflows/sanity-check.md` |
| 9 | `validate/test.md` | `framework/instructions/validate/test.md` | `test.md` | `workflows/test.md` |
| 10 | `citations/generate.md` | `framework/instructions/citations/generate.md` | `citations.md` | `workflows/citations.md` (handles all citation subcommands via argument parsing) |
| 11 | `citations/update.md` | `framework/instructions/citations/update.md` | (merged into `citations.md` workflow) | `workflows/citations.md` |
| 12 | `citations/verify.md` | `framework/instructions/citations/verify.md` | (merged into `citations.md` workflow) | `workflows/citations.md` |
| 13 | `citations/audit.md` | `framework/instructions/citations/audit.md` | (merged into `citations.md` workflow) | `workflows/citations.md` |
| 14 | `api-refs/generate.md` | `framework/instructions/api-refs/generate.md` | `api-ref.md` | `workflows/api-ref.md` (handles all api-ref subcommands) |
| 15 | `api-refs/audit.md` | `framework/instructions/api-refs/audit.md` | (merged into `api-ref.md` workflow) | `workflows/api-ref.md` |
| 16 | `locals/annotate.md` | `framework/instructions/locals/annotate.md` | `locals.md` | `workflows/locals.md` (handles all locals subcommands) |
| 17 | `locals/contracts.md` | `framework/instructions/locals/contracts.md` | (merged into `locals.md` workflow) | `workflows/locals.md` |
| 18 | `locals/coverage.md` | `framework/instructions/locals/coverage.md` | (merged into `locals.md` workflow) | `workflows/locals.md` |
| 19 | `locals/cross-ref.md` | `framework/instructions/locals/cross-ref.md` | (merged into `locals.md` workflow) | `workflows/locals.md` |
| 20 | `locals/shapes.md` | `framework/instructions/locals/shapes.md` | (merged into `locals.md` workflow) | `workflows/locals.md` |
| 21 | `locals/validate.md` | `framework/instructions/locals/validate.md` | (merged into `locals.md` workflow) | `workflows/locals.md` |
| 22 | `index/update.md` | `framework/instructions/index/update.md` | `update-index.md` | `workflows/update-index.md` |
| 23 | `index/update-example-claude.md` | `framework/instructions/index/update-example-claude.md` | `update-claude.md` | `workflows/update-claude.md` |
| 24 | `orchestrate/delegate.md` | `framework/instructions/orchestrate/delegate.md` | **ABSORBED** | N/A -- Delegation logic is distributed across individual workflows. Each write workflow now contains its own delegation steps. |
| 25 | `orchestrate/do.md` | `framework/instructions/orchestrate/do.md` | `do.md` | `workflows/do.md` |
| 26 | `orchestrate/remediate.md` | `framework/instructions/orchestrate/remediate.md` | `remediate.md` | `workflows/remediate.md` |
| 27 | `system/setup.md` | `framework/instructions/system/setup.md` | `setup.md` | `workflows/setup.md` |
| 28 | `system/sync.md` | `framework/instructions/system/sync.md` | `sync.md` | `workflows/sync.md` |
| 29 | `system/update.md` | `framework/instructions/system/update.md` | `update.md` | `workflows/update.md` |
| 30 | `system/update-skills.md` | `framework/instructions/system/update-skills.md` | `update-skills.md` | `workflows/update-skills.md` |
| 31 | `verbosity/audit.md` | `framework/instructions/verbosity/audit.md` | `verbosity-audit.md` | `workflows/verbosity-audit.md` |

**Note on merged workflows:** Commands like `citations`, `api-ref`, and `locals` each have multiple instruction files for subcommands (generate, update, verify, audit for citations; generate, audit for api-refs; annotate, contracts, coverage, cross-ref, shapes, validate for locals). In the new architecture, each command gets ONE workflow that parses the subcommand from `$ARGUMENTS` and routes to the appropriate procedure within the workflow. The subcommand-specific procedure content comes from the original instruction files.

### 1.5 Algorithm-to-Reference Mapping (All 6 Algorithms)

Algorithms (`framework/algorithms/*.md`) contain step-by-step procedures for pipeline stages. In the new architecture, these become references that workflows and agents `@-reference` when needed.

| # | Current Algorithm | Current Path | New Location | New Path |
|---|-----------------|-------------|-------------|----------|
| 1 | `verbosity-algorithm.md` | `framework/algorithms/verbosity-algorithm.md` | `verbosity-algorithm.md` | `references/verbosity-algorithm.md` |
| 2 | `citation-algorithm.md` | `framework/algorithms/citation-algorithm.md` | `citation-algorithm.md` | `references/citation-algorithm.md` |
| 3 | `api-ref-algorithm.md` | `framework/algorithms/api-ref-algorithm.md` | `api-ref-algorithm.md` | `references/api-ref-algorithm.md` |
| 4 | `validation-algorithm.md` | `framework/algorithms/validation-algorithm.md` | `validation-algorithm.md` | `references/validation-algorithm.md` |
| 5 | `git-sync-rules.md` | `framework/algorithms/git-sync-rules.md` | `git-sync-rules.md` | `references/git-sync-rules.md` |
| 6 | `codebase-analysis-guide.md` | `framework/algorithms/codebase-analysis-guide.md` | `codebase-analysis-guide.md` | `references/codebase-analysis-guide.md` |

Content unchanged. Only the directory location changes. They become references loadable via `@-reference`.

### 1.6 Hook-to-Hook Mapping (Event-by-Event)

fp-docs uses `hooks/hooks.json` with 5 event types and CJS handlers invoked via `fp-tools.cjs hooks run`. GSD uses standalone JS hook files registered in `settings.json`. The conversion adopts GSD's standalone hook file pattern.

| # | fp-docs Event | fp-docs Handler | New Hook File | Notes |
|---|--------------|----------------|--------------|-------|
| 1 | `PreToolUse` (Bash) | `handlePreToolUseBashGitCheck` | `hooks/fp-docs-git-guard.js` | Blocks raw git-write commands. Maps to GSD's PreToolUse pattern. |
| 2 | `SessionStart` | `handleInjectManifest` | `hooks/fp-docs-session-start.js` | Injects plugin root, config, manifest into context. Combined into one session-start hook. |
| 3 | `SessionStart` | `handleBranchSyncCheck` | `hooks/fp-docs-session-start.js` | Branch sync folded into session-start hook. |
| 4 | `SessionStart` | `handleDriftNudge` | `hooks/fp-docs-session-start.js` | Drift detection folded into session-start hook. |
| 5 | `SessionStart` | `handleUpdateCheck` | `hooks/fp-docs-check-update.js` | Background version check. Mirrors GSD's `gsd-check-update.js`. |
| 6 | `SubagentStop` (modify) | `handlePostModifyCheck` | `hooks/fp-docs-subagent-stop.js` | Pipeline marker validation after modify agent finishes. |
| 7 | `SubagentStop` (orchestrate) | `handlePostOrchestrateCheck` | `hooks/fp-docs-subagent-stop.js` | All-markers-present validation. Folded into single subagent-stop hook with matcher logic. |
| 8 | `SubagentStop` (locals) | `handleLocalsCLICleanup` | `hooks/fp-docs-subagent-stop.js` | WP-CLI artifact cleanup. Folded into subagent-stop hook. |
| 9 | `SubagentStop` (various) | `handleSubagentEnforcementCheck` | `hooks/fp-docs-subagent-stop.js` | Stage authority verification. Folded into subagent-stop hook. |
| 10 | `TeammateIdle` | `handleTeammateIdleCheck` | `hooks/fp-docs-teammate-idle.js` | Delegation completion check for team operations. |
| 11 | `TaskCompleted` | `handleTaskCompletedCheck` | `hooks/fp-docs-task-completed.js` | Task completion validation. |

**Key change:** Instead of `hooks/hooks.json` defining all hooks and routing to `fp-tools.cjs hooks run <event> <matcher>`, hooks become standalone JS files registered in `settings.json` (GSD pattern). The CJS handler logic from `lib/hooks.cjs` moves into these standalone hook files, but can still call `fp-tools.cjs` for complex operations.

**New `hooks/hooks.json` is REMOVED.** Hook registration moves to `settings.json` (which currently only has permissions). A new `hooks/` section is added to `settings.json` following GSD's pattern.

### 1.7 CJS Library Mapping (Module-by-Module)

fp-docs has `fp-tools.cjs` dispatching to 16 lib modules. This maps to the GSD pattern of a single CLI entry point with domain modules. The CLI entry point and module structure are already close to GSD's pattern -- primarily needs cleanup and the addition of `init` commands for workflow bootstrapping.

| # | Current Module | Current Path | Action | New Path | Change Description |
|---|---------------|-------------|--------|----------|-------------------|
| 1 | `fp-tools.cjs` | `fp-tools.cjs` | **Modify** | `fp-tools.cjs` | Add `init` command family (see 1.7.1). Add `resolve-model` command. Keep existing commands. |
| 2 | `core.cjs` | `lib/core.cjs` | **Keep** | `lib/core.cjs` | No change. Output protocol, safe I/O already match GSD patterns. |
| 3 | `paths.cjs` | `lib/paths.cjs` | **Keep** | `lib/paths.cjs` | No change. Three-repo path resolution is fp-docs-specific. |
| 4 | `config.cjs` | `lib/config.cjs` | **Keep** | `lib/config.cjs` | No change. JSON config loading works. |
| 5 | `routing.cjs` | `lib/routing.cjs` | **Modify** | `lib/routing.cjs` | Update routing table to reflect new command paths. The 21-entry table stays but points to workflows instead of engine+operation. |
| 6 | `hooks.cjs` | `lib/hooks.cjs` | **Modify** | `lib/hooks.cjs` | Extract handler logic into standalone hook JS files. `hooks.cjs` becomes a shared utility used by hook files, or is removed if all logic moves to standalone files. |
| 7 | `pipeline.cjs` | `lib/pipeline.cjs` | **Keep** | `lib/pipeline.cjs` | The 8-stage pipeline callback loop stays. This is fp-docs' core value prop. Workflows call it via `fp-tools pipeline init/next/run-stage`. |
| 8 | `state.cjs` | `lib/state.cjs` | **Keep** | `lib/state.cjs` | Operation history, pipeline state management unchanged. |
| 9 | `git.cjs` | `lib/git.cjs` | **Keep** | `lib/git.cjs` | Three-repo git operations unchanged. |
| 10 | `security.cjs` | `lib/security.cjs` | **Keep** | `lib/security.cjs` | Path validation, injection detection unchanged. |
| 11 | `enforcement.cjs` | `lib/enforcement.cjs` | **Modify** | `lib/enforcement.cjs` | Update stage authority map for new agent names (`fp-docs-modifier` instead of `modify`, etc.). |
| 12 | `drift.cjs` | `lib/drift.cjs` | **Keep** | `lib/drift.cjs` | Drift detection unchanged. |
| 13 | `source-map.cjs` | `lib/source-map.cjs` | **Keep** | `lib/source-map.cjs` | Source-to-doc mapping unchanged. |
| 14 | `health.cjs` | `lib/health.cjs` | **Modify** | `lib/health.cjs` | Update checks for new directory structure (commands/ instead of skills/, workflows/ instead of framework/instructions/, etc.). |
| 15 | `update.cjs` | `lib/update.cjs` | **Keep** | `lib/update.cjs` | Version checking unchanged. |
| 16 | `plans.cjs` | `lib/plans.cjs` | **Keep** | `lib/plans.cjs` | Plan file persistence unchanged. |
| 17 | `locals-cli.cjs` | `lib/locals-cli.cjs` | **Keep** | `lib/locals-cli.cjs` | WP-CLI lifecycle management unchanged. |
| 18 | **NEW** | N/A | **Create** | `lib/init.cjs` | Workflow init commands (like GSD's `init.cjs`). Returns JSON context payloads for each workflow type. |
| 19 | **NEW** | N/A | **Create** | `lib/model-profiles.cjs` | Model resolution table (like GSD's `model-profiles.cjs`). Maps agent types to model tiers. |

#### 1.7.1 New `init` Commands for Workflow Bootstrapping

GSD's `gsd-tools.cjs init <workflow> [args]` returns a JSON payload containing all context a workflow needs. fp-docs needs the same pattern.

New `fp-tools init` subcommands:

| Init Command | Returns | Used By Workflow(s) |
|-------------|---------|-------------------|
| `init write-op <command> <args>` | Operation type, engine, target files, pipeline config, feature flags, source-map lookup results | `revise`, `add`, `auto-update`, `auto-revise`, `deprecate`, `citations`, `api-ref`, `locals` |
| `init read-op <command> <args>` | Operation type, engine, target scope, validation config | `audit`, `verify`, `sanity-check`, `test`, `verbosity-audit` |
| `init admin-op <command> <args>` | Operation type, engine, system state | `setup`, `sync`, `update`, `update-skills`, `update-index`, `update-claude` |
| `init parallel <args>` | Batch config, target list, team parameters | `parallel` |
| `init remediate <args>` | Remediation plan, operation history | `remediate` |

### 1.8 Config Mapping

| # | Current Config | Current Path | New Location | New Path | Change |
|---|---------------|-------------|-------------|----------|--------|
| 1 | `config.json` | `config.json` | `config.json` | `config.json` | Add `model_profile` section for resolve-model. Otherwise unchanged. |
| 2 | `settings.json` | `settings.json` | `settings.json` | `settings.json` | Add hook registrations (moved from `hooks/hooks.json`). Keep permissions. |
| 3 | `system-config.md` | `framework/config/system-config.md` | **DELETE** | N/A | Legacy. Already superseded by `config.json`. |
| 4 | `project-config.md` | `framework/config/project-config.md` | **DELETE** | N/A | Legacy. Already superseded by `config.json` + `source-map.json`. |
| 5 | `playwright-mcp-config.json` | `framework/config/playwright-mcp-config.json` | **KEEP** | `framework/config/playwright-mcp-config.json` | MCP config stays. Could also move to top-level `.mcp.json` if desired. |

### 1.9 Template Mapping

| # | Current Template | Current Path | New Location | New Path |
|---|-----------------|-------------|-------------|----------|
| 1 | `fp-docs-shell.zsh` | `framework/templates/fp-docs-shell.zsh` | `templates/fp-docs-shell.zsh` | `templates/fp-docs-shell.zsh` |
| 2 | `fp-docs-statusline.js` | `framework/templates/fp-docs-statusline.js` | `templates/fp-docs-statusline.js` | `templates/fp-docs-statusline.js` |
| 3 | `post-merge.sh` | `framework/templates/post-merge.sh` | `templates/post-merge.sh` | `templates/post-merge.sh` |
| 4 | `post-rewrite.sh` | `framework/templates/post-rewrite.sh` | `templates/post-rewrite.sh` | `templates/post-rewrite.sh` |

Templates move from `framework/templates/` to `templates/` to match GSD's flat `templates/` convention.

### 1.10 Pipeline Stages-to-Workflow Pattern Mapping

fp-docs' 8-stage pipeline is NOT replaced by GSD's wave-based pattern. GSD's waves are for parallel plan execution across independent tasks. fp-docs' pipeline is for sequential post-modification enforcement stages. These are fundamentally different concerns.

**The pipeline is PRESERVED.** It continues to be driven by `lib/pipeline.cjs` with the `init/next/run-stage` callback loop. The change is in WHO calls the pipeline:

| Current | New |
|---------|-----|
| Orchestrate engine calls `fp-tools pipeline init/next/run-stage` in its finalization loop | Write operation workflows call `fp-tools pipeline init/next/run-stage` in their `<process>` steps |
| Orchestrate engine spawns validate agent for stages 4-5 | Write workflows spawn `fp-docs-validator` agent for stages 4-5 |
| Orchestrate engine runs stages 6-8 deterministically | Write workflows run stages 6-8 via `fp-tools pipeline run-stage` |

The pipeline's 3-phase distribution:
- **Write Phase (stages 1-3):** Still executed by the primary specialist agent during its spawned task
- **Review Phase (stages 4-5):** Still executed by a spawned validator agent
- **Finalize Phase (stages 6-8):** Still executed deterministically by the workflow via `fp-tools pipeline run-stage`

### 1.11 Items in fp-docs with NO GSD Equivalent

These fp-docs components have no counterpart in GSD because they serve domain-specific documentation needs:

| Component | What Happens |
|-----------|-------------|
| Source-map system (`source-map.json`, `lib/source-map.cjs`) | **Preserved as-is.** GSD has no equivalent because GSD doesn't manage documentation. |
| Locals CLI tool (`framework/tools/class-locals-cli.php`) | **Preserved as-is.** PHP WP-CLI tool for $locals extraction. Unique to fp-docs. |
| Drift detection system (`lib/drift.cjs`, session-start drift-nudge hook) | **Preserved as-is.** GSD has no doc drift concept. |
| Citation enforcement (algorithm, module, pipeline stage) | **Preserved.** Converted from module+algorithm to reference files. Pipeline stage unchanged. |
| API Reference enforcement (algorithm, module, pipeline stage) | **Preserved.** Same treatment as citations. |
| Verbosity enforcement (algorithm, module, pipeline stage) | **Preserved.** Same treatment. |
| $Locals contracts (module, instruction files) | **Preserved.** Domain knowledge moves to reference. |
| Three-repo git model (`lib/git.cjs`, 3 remotes) | **Preserved as-is.** Hard constraint. GSD uses single-repo. |
| Pipeline callback loop (`lib/pipeline.cjs`, 868 lines) | **Preserved as-is.** Core value prop. |
| Enforcement module (`lib/enforcement.cjs`, stage authority) | **Preserved.** Updated for new agent names. |
| Manifest (`framework/manifest.md`) | **Decision needed.** See Part 4. May be replaced by `help` workflow output. |
| Test specs (`tests/specs/`) | **Preserved and updated** for new command structure. |

### 1.12 Items in GSD That fp-docs Does NOT Need

These GSD capabilities are skipped because they serve GSD's project management domain, not fp-docs' documentation domain:

| GSD Component | Rationale for Skipping |
|---------------|----------------------|
| `.planning/` directory structure (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, phases/) | fp-docs does not manage project planning. Its state is operation history + pipeline state in `lib/state.cjs`. |
| Wave-based parallel execution (`execute-phase.md` workflow) | fp-docs has its own `parallel` command for batch operations. The wave model doesn't apply to doc pipeline enforcement. |
| Phase management (add-phase, insert-phase, remove-phase, plan-phase, execute-phase) | Not applicable to fp-docs domain. |
| Milestone lifecycle (complete-milestone, new-milestone, audit-milestone) | Not applicable. |
| GSD-specific agents (gsd-executor, gsd-planner, gsd-roadmapper, gsd-codebase-mapper, etc.) | fp-docs has its own domain-specific agents. |
| Session management (pause-work, resume-work, session-report) | fp-docs doesn't need cross-session state management beyond its operation history. |
| Todo/backlog system (add-todo, check-todos, add-backlog, review-backlog) | Not applicable. |
| Seeds, threads, workstreams | Not applicable. |
| UI-specific workflows (ui-phase, ui-review, ui-spec) | fp-docs has no UI components. |
| Profile system (profile-user, dev-preferences) | Not applicable. |
| `gsd-tools.cjs init` compound commands for GSD workflows | fp-docs will create its own `fp-tools init` commands (see 1.7.1) for fp-docs workflows. |
| GSD's `resolve-model` agent-type-to-model table | fp-docs will create its own model profile table relevant to its agents. |
| Template fill system (`gsd-tools.cjs template fill`) | fp-docs doesn't produce planning artifacts that need template filling. Its doc templates are in `mod-standards` (now `doc-standards.md` reference). |
| `statusLine` hook | fp-docs could adopt this eventually, but it's not part of the architecture conversion. |
| `PostToolUse` context-monitor hook | fp-docs could adopt this eventually, but not part of core conversion. |

### 1.13 Untracked Files Disposition

| File | Current Status | Plan |
|------|---------------|------|
| `commands/generate.md` | Untracked, early GSD-style command stub | **Replace** with properly-formed `commands/fp-docs/add.md` (the `generate` operation is what `add` already does). Delete this file. |
| `workflows/generate.md` | Untracked, GSD copy-paste placeholder (references `gsd-tools.cjs`) | **Replace** with properly-formed `workflows/add.md`. Delete this file. |
| `source-map.json` | Untracked, 1.7MB generated file | **Add to .gitignore.** This is generated data, should not be tracked. |

---

## Part 2: Conversion Phases

### Phase 1: Foundation (Directory Restructuring + Config)

**Goal:** Create the new directory structure alongside the old one. Update configuration files. No behavioral changes yet.

**Testable after completion:** `fp-tools health check` passes. Plugin validates (`claude plugin validate .`). Existing skills still work (old system untouched).

#### Steps:

1. Create new directories:
   - `commands/fp-docs/` (for new GSD-style commands)
   - `workflows/` (for workflow orchestrators)
   - `references/` (for converted modules and algorithms)
   - `templates/` (new location, alongside old `framework/templates/`)

2. Update `settings.json` to include hook registrations (placeholder structure, hooks not yet migrated):
   ```json
   {
     "permissions": {
       "allow": ["Read", "Grep", "Glob"]
     },
     "hooks": {}
   }
   ```

3. Add `source-map.json` to `.gitignore`.

4. Update `config.json` to add `model_profile` section:
   ```json
   {
     "model_profile": {
       "default": "quality",
       "agents": {
         "fp-docs-modifier": { "quality": "opus", "balanced": "opus", "budget": "sonnet" },
         "fp-docs-validator": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" },
         "fp-docs-citations": { "quality": "opus", "balanced": "opus", "budget": "sonnet" },
         "fp-docs-api-refs": { "quality": "opus", "balanced": "opus", "budget": "sonnet" },
         "fp-docs-locals": { "quality": "opus", "balanced": "opus", "budget": "sonnet" },
         "fp-docs-verbosity": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" },
         "fp-docs-indexer": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" },
         "fp-docs-system": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" },
         "fp-docs-researcher": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" },
         "fp-docs-planner": { "quality": "opus", "balanced": "sonnet", "budget": "sonnet" }
       }
     }
   }
   ```

5. Delete the untracked stub files:
   - Delete `commands/generate.md`
   - Delete `workflows/generate.md`

6. Delete legacy config files:
   - Delete `framework/config/system-config.md`
   - Delete `framework/config/project-config.md`
   - Keep `framework/config/playwright-mcp-config.json`

**Dependencies:** None. This is the foundation.

### Phase 2: References (Convert Modules + Algorithms)

**Goal:** Move all module content and algorithm content into the `references/` directory. This is a pure content migration -- no behavioral changes, just repackaging.

**Testable after completion:** All reference files exist with correct content. Can verify content matches original modules/algorithms.

#### Steps:

1. Convert all 11 modules to references (for each module, remove SKILL.md frontmatter, move content):
   - `modules/mod-standards/SKILL.md` -> `references/doc-standards.md`
   - `modules/mod-project/SKILL.md` -> `references/fp-project.md`
   - `modules/mod-pipeline/SKILL.md` -> `references/pipeline-enforcement.md`
   - `modules/mod-citations/SKILL.md` -> `references/citation-rules.md`
   - `modules/mod-api-refs/SKILL.md` -> `references/api-ref-rules.md`
   - `modules/mod-changelog/SKILL.md` -> `references/changelog-rules.md`
   - `modules/mod-index/SKILL.md` -> `references/index-rules.md`
   - `modules/mod-locals/SKILL.md` -> `references/locals-rules.md`
   - `modules/mod-verbosity/SKILL.md` -> `references/verbosity-rules.md`
   - `modules/mod-validation/SKILL.md` -> `references/validation-rules.md`
   - `modules/mod-orchestration/SKILL.md` -> **Not converted** (absorbed into workflow logic in Phase 5)

2. Move all 6 algorithms to references:
   - `framework/algorithms/verbosity-algorithm.md` -> `references/verbosity-algorithm.md`
   - `framework/algorithms/citation-algorithm.md` -> `references/citation-algorithm.md`
   - `framework/algorithms/api-ref-algorithm.md` -> `references/api-ref-algorithm.md`
   - `framework/algorithms/validation-algorithm.md` -> `references/validation-algorithm.md`
   - `framework/algorithms/git-sync-rules.md` -> `references/git-sync-rules.md`
   - `framework/algorithms/codebase-analysis-guide.md` -> `references/codebase-analysis-guide.md`

3. Move templates:
   - `framework/templates/fp-docs-shell.zsh` -> `templates/fp-docs-shell.zsh`
   - `framework/templates/fp-docs-statusline.js` -> `templates/fp-docs-statusline.js`
   - `framework/templates/post-merge.sh` -> `templates/post-merge.sh`
   - `framework/templates/post-rewrite.sh` -> `templates/post-rewrite.sh`

**Dependencies:** Phase 1 (directories exist).

### Phase 3: CLI Tooling (New init/resolve-model Commands)

**Goal:** Add workflow bootstrapping infrastructure to `fp-tools.cjs`. Add `init` and `resolve-model` commands so workflows can initialize context and resolve models.

**Testable after completion:** `fp-tools init write-op revise "fix posts helper"` returns valid JSON. `fp-tools resolve-model fp-docs-modifier --raw` returns a model name.

#### Steps:

1. Create `lib/init.cjs` with init command handlers:
   - `cmdInit(subcmd, args)` -- router for init subcommands
   - `initWriteOp(command, args)` -- returns JSON: operation type, engine, target files, pipeline config, feature flags, source-map results
   - `initReadOp(command, args)` -- returns JSON: operation type, validation config
   - `initAdminOp(command, args)` -- returns JSON: operation type, system state
   - `initParallel(args)` -- returns JSON: batch config, target list
   - `initRemediate(args)` -- returns JSON: remediation plan, history

2. Create `lib/model-profiles.cjs` with model resolution:
   - `resolveModel(agentType, profileOverride)` -- reads config.json model_profile, returns model name
   - `cmdResolveModel(args)` -- CLI handler

3. Update `fp-tools.cjs` to add new command routes:
   - `init` -> `lib/init.cjs`
   - `resolve-model` -> `lib/model-profiles.cjs`

4. The init commands should use the `@file:` protocol (from `lib/core.cjs`) for large payloads, matching GSD's pattern.

**Dependencies:** Phase 1 (config.json updated with model_profile section).

### Phase 4: Agents (Refactor Engine Agents)

**Goal:** Convert all 11 engine agent definitions from fp-docs' current frontmatter+prose pattern to GSD-style frontmatter+XML pattern. The orchestrate agent is removed; other agents get GSD-style structure.

**Testable after completion:** All agent files parse correctly. Frontmatter is valid YAML. Agent file count: 10 (orchestrate removed).

#### Steps:

1. Remove `agents/orchestrate.md` (orchestration moves to workflows).

2. Rename and rewrite each remaining agent (10 total). For each:
   - Rename from `{engine}.md` to `fp-docs-{role}.md`
   - Replace frontmatter: remove `model`, `maxTurns`, `skills` list. Add `tools` (comma-separated). Keep `color`. Add GSD-style `name` and `description`.
   - Replace body: change from prose narrative with delegation mode sections to XML sections (`<role>`, `<project_context>`, `<quality_gate>`, etc.)
   - **Preserve all domain knowledge** from the original engine system prompt
   - Remove delegation mode sections (Standalone Mode / Delegated Mode) -- agents are always spawned by workflows
   - Remove module references from body (domain knowledge will come via `<files_to_read>` in spawn prompts)

   Specific renames:
   - `agents/modify.md` -> `agents/fp-docs-modifier.md`
   - `agents/validate.md` -> `agents/fp-docs-validator.md`
   - `agents/citations.md` -> `agents/fp-docs-citations.md`
   - `agents/api-refs.md` -> `agents/fp-docs-api-refs.md`
   - `agents/locals.md` -> `agents/fp-docs-locals.md`
   - `agents/verbosity.md` -> `agents/fp-docs-verbosity.md`
   - `agents/index.md` -> `agents/fp-docs-indexer.md`
   - `agents/system.md` -> `agents/fp-docs-system.md`
   - `agents/researcher.md` -> `agents/fp-docs-researcher.md`
   - `agents/planner.md` -> `agents/fp-docs-planner.md`

3. Update `lib/enforcement.cjs` STAGE_AUTHORITY_MAP with new agent names:
   ```javascript
   const STAGE_AUTHORITY_MAP = {
     'fp-docs-researcher': 'research',
     'fp-docs-planner': 'plan',
     'fp-docs-modifier': 'write',
     'fp-docs-citations': 'write',
     'fp-docs-api-refs': 'write',
     'fp-docs-locals': 'write',
     'fp-docs-validator': 'review',
     // orchestrate removed -- finalize phase handled by workflow
   };
   ```

**Dependencies:** Phase 2 (references exist for agent `<files_to_read>` references).

### Phase 5: Workflows (Convert Instruction Files to Workflow Orchestrators)

**Goal:** Create workflow files that replace both instruction files and the orchestrate engine's delegation logic. Each workflow is an active orchestrator that loads context, spawns agents, manages the pipeline, and produces results.

**Testable after completion:** Each workflow file exists with valid XML structure. Workflows reference correct agents and references.

This is the most complex phase. Write operation workflows must incorporate the delegation algorithm from `framework/instructions/orchestrate/delegate.md`.

#### Steps:

1. Create the **write operation workflow template** (shared pattern for all write workflows):

   Write workflows follow this structure:
   ```xml
   <purpose>
   {Operation description}
   </purpose>

   <required_reading>
   Read all files referenced by the invoking command's execution_context.
   </required_reading>

   <process>

   <step name="initialize" priority="first">
   ## 1. Initialize
   ```bash
   INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op {command} "$ARGUMENTS")
   if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
   ```
   Parse JSON for: operation, engine, target_files, pipeline_config, feature_flags.
   </step>

   <step name="research">
   ## 2. Research Phase
   ```bash
   RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
   ```
   Spawn researcher agent:
   ```
   Task(
     prompt=<research_prompt>,
     subagent_type="fp-docs-researcher",
     model="${RESEARCHER_MODEL}",
     description="Research for {command}"
   )
   ```
   The research prompt includes `<files_to_read>` with target source files and
   `@${CLAUDE_PLUGIN_ROOT}/references/codebase-analysis-guide.md`.
   </step>

   <step name="plan">
   ## 3. Plan Phase
   ```bash
   PLANNER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-planner --raw)
   ```
   Spawn planner agent with research results.
   </step>

   <step name="execute-write-phase">
   ## 4. Write Phase (Stages 1-3)
   ```bash
   MODIFIER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-modifier --raw)
   ```
   Spawn primary agent with plan and reference files:
   ```
   Task(
     prompt=<write_prompt_with_files_to_read>,
     subagent_type="fp-docs-modifier",
     model="${MODIFIER_MODEL}",
     description="{command} write phase"
   )
   ```
   The write prompt includes `<files_to_read>` with:
   - `${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md`
   - `${CLAUDE_PLUGIN_ROOT}/references/{operation-specific-reference}.md`
   - `${CLAUDE_PLUGIN_ROOT}/references/verbosity-algorithm.md`
   - `${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md`
   - `${CLAUDE_PLUGIN_ROOT}/references/api-ref-algorithm.md`
   - The plan file produced in step 3
   </step>

   <step name="execute-review-phase">
   ## 5. Review Phase (Stages 4-5)
   ```bash
   VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
   ```
   Spawn validator agent:
   ```
   Task(
     prompt=<review_prompt>,
     subagent_type="fp-docs-validator",
     model="${VALIDATOR_MODEL}",
     description="{command} review phase"
   )
   ```
   </step>

   <step name="execute-finalize-phase">
   ## 6. Finalize Phase (Stages 6-8)
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation {op} --files {files}
   ```
   Loop:
   ```bash
   NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
   # action == "execute" -> fp-tools pipeline run-stage {id}
   # action == "complete" -> done
   ```
   </step>

   </process>

   <success_criteria>
   - [ ] Target documentation modified correctly
   - [ ] All source code claims verified
   - [ ] Pipeline stages 1-8 completed
   - [ ] Changelog updated
   - [ ] Docs committed
   </success_criteria>
   ```

2. Create all 23 workflow files using the appropriate template (write, read, admin, meta, batch):

   **Write operation workflows** (use write template above, customize operation-specific steps):
   - `workflows/revise.md` (from `framework/instructions/modify/revise.md`)
   - `workflows/add.md` (from `framework/instructions/modify/add.md`)
   - `workflows/auto-update.md` (from `framework/instructions/modify/auto-update.md`)
   - `workflows/auto-revise.md` (from `framework/instructions/modify/auto-revise.md`)
   - `workflows/deprecate.md` (from `framework/instructions/modify/deprecate.md`)
   - `workflows/citations.md` (merged from `framework/instructions/citations/{generate,update,verify,audit}.md`)
   - `workflows/api-ref.md` (merged from `framework/instructions/api-refs/{generate,audit}.md`)
   - `workflows/locals.md` (merged from `framework/instructions/locals/{annotate,contracts,coverage,cross-ref,shapes,validate}.md`)
   - `workflows/remediate.md` (from `framework/instructions/orchestrate/remediate.md`)

   **Read operation workflows** (simpler: research -> plan -> specialist, no pipeline):
   - `workflows/audit.md` (from `framework/instructions/validate/audit.md`)
   - `workflows/verify.md` (from `framework/instructions/validate/verify.md`)
   - `workflows/sanity-check.md` (from `framework/instructions/validate/sanity-check.md`)
   - `workflows/test.md` (from `framework/instructions/validate/test.md`)
   - `workflows/verbosity-audit.md` (from `framework/instructions/verbosity/audit.md`)

   **Admin operation workflows** (minimal: research -> execute):
   - `workflows/setup.md` (from `framework/instructions/system/setup.md`)
   - `workflows/sync.md` (from `framework/instructions/system/sync.md`)
   - `workflows/update.md` (from `framework/instructions/system/update.md`)
   - `workflows/update-skills.md` (from `framework/instructions/system/update-skills.md`)
   - `workflows/update-index.md` (from `framework/instructions/index/update.md`)
   - `workflows/update-claude.md` (from `framework/instructions/index/update-example-claude.md`)

   **Meta workflows** (no agent spawning, inline logic):
   - `workflows/do.md` (from `framework/instructions/orchestrate/do.md`)
   - `workflows/help.md` (generates help from routing table)

   **Batch workflow:**
   - `workflows/parallel.md` (replaces orchestrate engine's parallel handling)

**Dependencies:** Phase 3 (init commands available), Phase 4 (agents exist with new names).

### Phase 6: Commands (Convert Skills to GSD-Style Commands)

**Goal:** Create all 23 GSD-style command files in `commands/fp-docs/`. Each command is a thin routing file that `@-references` a workflow and relevant references.

**Testable after completion:** All 23 command files exist with valid YAML frontmatter and XML body. Commands reference existing workflows and references.

#### Steps:

1. Create all 23 command files (see mapping table in 1.1). For each command:
   - Create `commands/fp-docs/{name}.md`
   - Write YAML frontmatter: `name`, `description` (from original skill), `argument-hint` (from original skill), `allowed-tools` (determined by operation type)
   - Write XML body: `<objective>`, `<execution_context>` (with `@-reference` to workflow + relevant references), `<context>`, `<process>`, `<success_criteria>`

2. Tool permissions per command type:
   - **Write commands** (revise, add, auto-update, auto-revise, deprecate, citations, api-ref, locals, remediate): `Read, Write, Edit, Bash, Grep, Glob, Task`
   - **Read commands** (audit, verify, sanity-check, test, verbosity-audit): `Read, Bash, Grep, Glob, Task`
   - **Admin commands** (setup, sync, update, update-skills, update-index, update-claude): `Read, Write, Edit, Bash, Grep, Glob, Task`
   - **Meta commands** (do, help): `Read, Bash, Grep, Glob`
   - **Batch commands** (parallel): `Read, Write, Edit, Bash, Grep, Glob, Task`

3. Each command's `<execution_context>` loads:
   - The primary workflow: `@${CLAUDE_PLUGIN_ROOT}/workflows/{name}.md`
   - Common references needed by the command (doc-standards, pipeline-enforcement for write commands; validation-rules for read commands; etc.)

**Dependencies:** Phase 5 (workflows exist). Phase 2 (references exist).

### Phase 7: Hooks (Migrate Hook System)

**Goal:** Convert from `hooks/hooks.json` + `fp-tools.cjs hooks run` pattern to standalone JS hook files + `settings.json` registration.

**Testable after completion:** All hook files exist. `settings.json` has correct hook registrations. Hooks execute correctly when triggered.

#### Steps:

1. Create standalone hook files:
   - `hooks/fp-docs-session-start.js` -- combines inject-manifest, branch-sync, drift-nudge
   - `hooks/fp-docs-check-update.js` -- background version check
   - `hooks/fp-docs-git-guard.js` -- PreToolUse Bash git-write blocking
   - `hooks/fp-docs-subagent-stop.js` -- post-modify, post-orchestrate, locals-cleanup, enforcement checks
   - `hooks/fp-docs-teammate-idle.js` -- team delegation completion check
   - `hooks/fp-docs-task-completed.js` -- task completion validation

2. Each hook file:
   - Reads `stdin` for event JSON (matching GSD pattern)
   - Implements handler logic (extracted from `lib/hooks.cjs`)
   - Can call `fp-tools.cjs` for complex operations (git sync, pipeline validation)
   - Wraps in try/catch with silent failure
   - Outputs JSON to stdout: `{ "hookSpecificOutput": { "hookEventName": "...", "additionalContext": "..." } }`

3. Update `settings.json` with hook registrations:
   ```json
   {
     "permissions": {
       "allow": ["Read", "Grep", "Glob"]
     },
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-git-guard.js\""
           }]
         }
       ],
       "SessionStart": [
         {
           "hooks": [
             { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-session-start.js\"" },
             { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-check-update.js\"" }
           ]
         }
       ],
       "SubagentStop": [
         {
           "matcher": "fp-docs-modifier",
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-subagent-stop.js\""
           }]
         },
         {
           "matcher": "fp-docs-validator",
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-subagent-stop.js\""
           }]
         },
         {
           "matcher": "fp-docs-locals",
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-subagent-stop.js\""
           }]
         }
       ],
       "TeammateIdle": [
         {
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-teammate-idle.js\""
           }]
         }
       ],
       "TaskCompleted": [
         {
           "hooks": [{
             "type": "command",
             "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/fp-docs-task-completed.js\""
           }]
         }
       ]
     }
   }
   ```

4. Remove old `hooks/hooks.json` after all hooks are migrated.

5. Update `lib/hooks.cjs`: either refactor into a shared utility library used by the standalone hook files, or remove it if all logic has been inlined into hook files. Recommend keeping it as a utility with exported functions that hook files import.

**Dependencies:** Phase 4 (agent names updated for SubagentStop matchers).

### Phase 8: Integration (Wire Everything Together)

**Goal:** Update cross-references, routing table, health checks, and the plugin manifest so all components connect correctly.

**Testable after completion:** Full end-to-end test: invoke `/fp-docs:revise` -> command loads -> workflow executes -> agents spawn -> pipeline runs -> docs committed.

#### Steps:

1. Update `lib/routing.cjs`:
   - Update routing table entries to reflect new workflow paths instead of engine+operation
   - Update help output generation

2. Update `lib/health.cjs`:
   - Check for `commands/fp-docs/` directory instead of `skills/`
   - Check for `workflows/` directory instead of `framework/instructions/`
   - Check for `references/` directory instead of `modules/`
   - Check for `agents/fp-docs-*.md` instead of `agents/{engine}.md`

3. Update `lib/enforcement.cjs`:
   - Verify STAGE_AUTHORITY_MAP uses new agent names (done in Phase 4)
   - Update delegation result parsing for new agent output format

4. Update `plugin.json` description:
   ```json
   {
     "name": "fp-docs",
     "version": "1.0.0",
     "description": "Documentation management system for the Foreign Policy WordPress codebase. Command-workflow-agent architecture with pipeline enforcement, 23 commands, 10 specialist agents."
   }
   ```
   **Note:** Version is NOT bumped (per governance rules -- requires explicit user instruction).

5. Verify all `@-reference` paths resolve:
   - Commands reference workflows at `@${CLAUDE_PLUGIN_ROOT}/workflows/*.md`
   - Commands reference references at `@${CLAUDE_PLUGIN_ROOT}/references/*.md`
   - Workflows use `${CLAUDE_PLUGIN_ROOT}` in CLI calls

6. Run test suite to verify CJS modules still pass:
   ```bash
   cd fp-docs && node tests/run.cjs
   ```

**Dependencies:** All previous phases (1-7).

### Phase 9: Tests (Update Test Suite)

**Goal:** Update the test suite to validate the new architecture. Fix broken tests. Add new tests for init commands, model resolution, and new hook structure.

**Testable after completion:** `node tests/run.cjs` passes all tests.

#### Steps:

1. Update `tests/lib/spec-validator.cjs`:
   - Point at `commands/fp-docs/*.md` instead of `skills/*/SKILL.md`
   - Validate new YAML frontmatter schema (name, description, argument-hint, allowed-tools)
   - Validate XML body structure

2. Update `tests/specs/*.json`:
   - Update all 23 spec files for new command paths and frontmatter

3. Update `tests/lib/fixture-runner.cjs` and `tests/lib/hooks-ab-runner.cjs`:
   - Point at new hook file paths
   - Update expected output formats

4. Update `tests/lib/lib-routing-tests.cjs`:
   - Verify routing table reflects new workflow paths

5. Update `tests/lib/lib-engine-compliance-tests.cjs`:
   - Update for new agent file names and frontmatter schema

6. Update `tests/lib/lib-enforcement-tests.cjs`:
   - Update STAGE_AUTHORITY_MAP expectations for new agent names

7. Add new tests:
   - `tests/lib/lib-init-tests.cjs` for `lib/init.cjs`
   - `tests/lib/lib-model-profiles-tests.cjs` for `lib/model-profiles.cjs`

8. Update `tests/lib/marker-checker.cjs`:
   - Ensure pipeline markers still match registry

**Dependencies:** Phase 8 (integration complete).

### Phase 10: Cleanup (Remove Obsolete Files + Update Documentation)

**Goal:** Remove all old-architecture files that have been replaced. Update all documentation to reflect the new architecture.

**Testable after completion:** No dead files remain. All documentation is accurate. Plugin validates.

#### Steps:

1. Remove old directories (after confirming all content migrated):
   - Delete `skills/` directory (all 23 skill directories)
   - Delete `modules/` directory (all 11 module directories)
   - Delete `framework/instructions/` directory (all 30 instruction files)
   - Delete `framework/algorithms/` directory (all 6 algorithm files)
   - Delete `framework/templates/` directory (templates moved to `templates/`)
   - Delete `framework/config/system-config.md` and `framework/config/project-config.md` (if not already deleted in Phase 1)
   - Delete `hooks/hooks.json` (if not already deleted in Phase 7)
   - Delete old agent files: `agents/orchestrate.md`, `agents/modify.md`, `agents/validate.md`, `agents/citations.md`, `agents/api-refs.md`, `agents/locals.md`, `agents/verbosity.md`, `agents/index.md`, `agents/system.md`, `agents/researcher.md`, `agents/planner.md`

2. Assess remaining `framework/` directory:
   - `framework/manifest.md` -- Decision needed (see Part 4). If kept, update. If removed, delete.
   - `framework/config/playwright-mcp-config.json` -- Keep if still referenced by `.mcp.json`.
   - `framework/tools/class-locals-cli.php` -- Keep (still needed for locals operations).
   - If `framework/` only contains `tools/` and possibly `config/`, consider whether to flatten.

3. Update `specs/architecture.md`:
   - Rewrite to reflect command-workflow-agent chain
   - Update repository layout tree
   - Update engine list (now agents)
   - Update pipeline description (workflow-driven instead of orchestrator-driven)
   - Update hook system description
   - Update module system description (now references)
   - Update end-to-end flow traces

4. Update `specs/features-and-capabilities.md`:
   - Update command list (23 commands, new paths)
   - Update engine list (10 agents, new names)
   - Update module list (11 references, new paths)
   - Update pipeline description

5. Update `specs/usage-and-workflows.md`:
   - Update installation instructions
   - Update command reference
   - Update daily workflow descriptions
   - Update configuration options

6. Update `README.md`:
   - Update repository layout tree
   - Update command list
   - Update architecture description

7. Update `CLAUDE.md` (the root one at `cc-plugins/CLAUDE.md`):
   - Update repository layout tree
   - Update "Adding a New Command" section
   - Update "Adding a New Module" section (now "Adding a New Reference")
   - Update architecture quick reference
   - Update technology stack references
   - Update convention descriptions

8. Update `framework/manifest.md` (if kept):
   - Update component counts
   - Update architecture description

**Dependencies:** All previous phases (1-9).

---

## Part 3: File-Level Change Specification

### 3.1 Files to CREATE

| # | New Path | Phase | GSD Equivalent | Description |
|---|----------|-------|---------------|-------------|
| 1 | `commands/fp-docs/revise.md` | 6 | `commands/gsd/execute-phase.md` | GSD-style command for revise operation |
| 2 | `commands/fp-docs/add.md` | 6 | `commands/gsd/new-project.md` | GSD-style command for add operation |
| 3 | `commands/fp-docs/auto-update.md` | 6 | `commands/gsd/autonomous.md` | GSD-style command for auto-update |
| 4 | `commands/fp-docs/auto-revise.md` | 6 | N/A (fp-docs-specific) | GSD-style command for auto-revise |
| 5 | `commands/fp-docs/deprecate.md` | 6 | N/A (fp-docs-specific) | GSD-style command for deprecate |
| 6 | `commands/fp-docs/audit.md` | 6 | `commands/gsd/audit-milestone.md` | GSD-style command for audit |
| 7 | `commands/fp-docs/verify.md` | 6 | `commands/gsd/verify-work.md` | GSD-style command for verify |
| 8 | `commands/fp-docs/sanity-check.md` | 6 | N/A (fp-docs-specific) | GSD-style command for sanity-check |
| 9 | `commands/fp-docs/test.md` | 6 | `commands/gsd/add-tests.md` | GSD-style command for test |
| 10 | `commands/fp-docs/citations.md` | 6 | N/A (fp-docs-specific) | GSD-style command for citations |
| 11 | `commands/fp-docs/api-ref.md` | 6 | N/A (fp-docs-specific) | GSD-style command for api-ref |
| 12 | `commands/fp-docs/locals.md` | 6 | N/A (fp-docs-specific) | GSD-style command for locals |
| 13 | `commands/fp-docs/verbosity-audit.md` | 6 | N/A (fp-docs-specific) | GSD-style command for verbosity-audit |
| 14 | `commands/fp-docs/update-index.md` | 6 | N/A (fp-docs-specific) | GSD-style command for update-index |
| 15 | `commands/fp-docs/update-claude.md` | 6 | N/A (fp-docs-specific) | GSD-style command for update-claude |
| 16 | `commands/fp-docs/update-skills.md` | 6 | N/A (fp-docs-specific) | GSD-style command for update-skills |
| 17 | `commands/fp-docs/setup.md` | 6 | `commands/gsd/new-project.md` | GSD-style command for setup |
| 18 | `commands/fp-docs/sync.md` | 6 | N/A (fp-docs-specific) | GSD-style command for sync |
| 19 | `commands/fp-docs/update.md` | 6 | `commands/gsd/update.md` | GSD-style command for update |
| 20 | `commands/fp-docs/parallel.md` | 6 | `commands/gsd/execute-phase.md` | GSD-style command for parallel |
| 21 | `commands/fp-docs/remediate.md` | 6 | `commands/gsd/debug.md` | GSD-style command for remediate |
| 22 | `commands/fp-docs/do.md` | 6 | `commands/gsd/do.md` | GSD-style command for do |
| 23 | `commands/fp-docs/help.md` | 6 | `commands/gsd/help.md` | GSD-style command for help |
| 24 | `workflows/revise.md` | 5 | `get-shit-done/workflows/execute-phase.md` | Write operation workflow |
| 25 | `workflows/add.md` | 5 | `get-shit-done/workflows/new-project.md` | Write operation workflow |
| 26 | `workflows/auto-update.md` | 5 | `get-shit-done/workflows/autonomous.md` | Write operation workflow |
| 27 | `workflows/auto-revise.md` | 5 | N/A | Write operation workflow |
| 28 | `workflows/deprecate.md` | 5 | N/A | Write operation workflow |
| 29 | `workflows/audit.md` | 5 | `get-shit-done/workflows/audit-milestone.md` | Read operation workflow |
| 30 | `workflows/verify.md` | 5 | `get-shit-done/workflows/verify-work.md` | Read operation workflow |
| 31 | `workflows/sanity-check.md` | 5 | N/A | Read operation workflow |
| 32 | `workflows/test.md` | 5 | `get-shit-done/workflows/add-tests.md` | Read operation workflow |
| 33 | `workflows/citations.md` | 5 | N/A | Write operation workflow (multi-subcommand) |
| 34 | `workflows/api-ref.md` | 5 | N/A | Write operation workflow (multi-subcommand) |
| 35 | `workflows/locals.md` | 5 | N/A | Write operation workflow (multi-subcommand) |
| 36 | `workflows/verbosity-audit.md` | 5 | N/A | Read operation workflow |
| 37 | `workflows/update-index.md` | 5 | N/A | Admin operation workflow |
| 38 | `workflows/update-claude.md` | 5 | N/A | Admin operation workflow |
| 39 | `workflows/update-skills.md` | 5 | N/A | Admin operation workflow |
| 40 | `workflows/setup.md` | 5 | `get-shit-done/workflows/new-project.md` | Admin operation workflow |
| 41 | `workflows/sync.md` | 5 | N/A | Admin operation workflow |
| 42 | `workflows/update.md` | 5 | `get-shit-done/workflows/update.md` | Admin operation workflow |
| 43 | `workflows/parallel.md` | 5 | `get-shit-done/workflows/execute-phase.md` | Batch operation workflow |
| 44 | `workflows/remediate.md` | 5 | `get-shit-done/workflows/diagnose-issues.md` | Write operation workflow |
| 45 | `workflows/do.md` | 5 | `get-shit-done/workflows/do.md` | Meta workflow |
| 46 | `workflows/help.md` | 5 | `get-shit-done/workflows/help.md` | Meta workflow |
| 47 | `references/doc-standards.md` | 2 | `get-shit-done/references/checkpoints.md` | Converted from mod-standards |
| 48 | `references/fp-project.md` | 2 | `get-shit-done/references/planning-config.md` | Converted from mod-project |
| 49 | `references/pipeline-enforcement.md` | 2 | N/A | Converted from mod-pipeline |
| 50 | `references/citation-rules.md` | 2 | N/A | Converted from mod-citations |
| 51 | `references/api-ref-rules.md` | 2 | N/A | Converted from mod-api-refs |
| 52 | `references/changelog-rules.md` | 2 | `get-shit-done/references/git-integration.md` | Converted from mod-changelog |
| 53 | `references/index-rules.md` | 2 | N/A | Converted from mod-index |
| 54 | `references/locals-rules.md` | 2 | N/A | Converted from mod-locals |
| 55 | `references/verbosity-rules.md` | 2 | N/A | Converted from mod-verbosity |
| 56 | `references/validation-rules.md` | 2 | `get-shit-done/references/verification-patterns.md` | Converted from mod-validation |
| 57 | `references/verbosity-algorithm.md` | 2 | N/A | Moved from framework/algorithms/ |
| 58 | `references/citation-algorithm.md` | 2 | N/A | Moved from framework/algorithms/ |
| 59 | `references/api-ref-algorithm.md` | 2 | N/A | Moved from framework/algorithms/ |
| 60 | `references/validation-algorithm.md` | 2 | N/A | Moved from framework/algorithms/ |
| 61 | `references/git-sync-rules.md` | 2 | `get-shit-done/references/git-integration.md` | Moved from framework/algorithms/ |
| 62 | `references/codebase-analysis-guide.md` | 2 | N/A | Moved from framework/algorithms/ |
| 63 | `templates/fp-docs-shell.zsh` | 2 | N/A | Moved from framework/templates/ |
| 64 | `templates/fp-docs-statusline.js` | 2 | N/A | Moved from framework/templates/ |
| 65 | `templates/post-merge.sh` | 2 | N/A | Moved from framework/templates/ |
| 66 | `templates/post-rewrite.sh` | 2 | N/A | Moved from framework/templates/ |
| 67 | `agents/fp-docs-modifier.md` | 4 | `agents/gsd-executor.md` | Refactored from agents/modify.md |
| 68 | `agents/fp-docs-validator.md` | 4 | `agents/gsd-verifier.md` | Refactored from agents/validate.md |
| 69 | `agents/fp-docs-citations.md` | 4 | N/A | Refactored from agents/citations.md |
| 70 | `agents/fp-docs-api-refs.md` | 4 | N/A | Refactored from agents/api-refs.md |
| 71 | `agents/fp-docs-locals.md` | 4 | N/A | Refactored from agents/locals.md |
| 72 | `agents/fp-docs-verbosity.md` | 4 | N/A | Refactored from agents/verbosity.md |
| 73 | `agents/fp-docs-indexer.md` | 4 | N/A | Refactored from agents/index.md |
| 74 | `agents/fp-docs-system.md` | 4 | N/A | Refactored from agents/system.md |
| 75 | `agents/fp-docs-researcher.md` | 4 | `agents/gsd-phase-researcher.md` | Refactored from agents/researcher.md |
| 76 | `agents/fp-docs-planner.md` | 4 | `agents/gsd-planner.md` | Refactored from agents/planner.md |
| 77 | `hooks/fp-docs-session-start.js` | 7 | `hooks/gsd-statusline.js` (partially) | Combined session-start handlers |
| 78 | `hooks/fp-docs-check-update.js` | 7 | `hooks/gsd-check-update.js` | Background update check |
| 79 | `hooks/fp-docs-git-guard.js` | 7 | `hooks/gsd-prompt-guard.js` | PreToolUse git-write blocking |
| 80 | `hooks/fp-docs-subagent-stop.js` | 7 | N/A | SubagentStop enforcement checks |
| 81 | `hooks/fp-docs-teammate-idle.js` | 7 | N/A | TeammateIdle check |
| 82 | `hooks/fp-docs-task-completed.js` | 7 | N/A | TaskCompleted check |
| 83 | `lib/init.cjs` | 3 | `get-shit-done/bin/lib/init.cjs` | Workflow init context loading |
| 84 | `lib/model-profiles.cjs` | 3 | `get-shit-done/bin/lib/model-profiles.cjs` | Model resolution table |
| 85 | `tests/lib/lib-init-tests.cjs` | 9 | N/A | Tests for init.cjs |
| 86 | `tests/lib/lib-model-profiles-tests.cjs` | 9 | N/A | Tests for model-profiles.cjs |

### 3.2 Files to MODIFY

| # | Path | Phase | Change Description |
|---|------|-------|--------------------|
| 1 | `fp-tools.cjs` | 3 | Add `init` and `resolve-model` command routes |
| 2 | `config.json` | 1 | Add `model_profile` section |
| 3 | `settings.json` | 7 | Add `hooks` section with all hook registrations |
| 4 | `.claude-plugin/plugin.json` | 8 | Update description (NOT version) |
| 5 | `lib/routing.cjs` | 8 | Update routing table for new workflow paths |
| 6 | `lib/health.cjs` | 8 | Update health checks for new directory structure |
| 7 | `lib/enforcement.cjs` | 4 | Update STAGE_AUTHORITY_MAP with new agent names |
| 8 | `lib/hooks.cjs` | 7 | Refactor into shared utility or remove (logic moves to standalone hooks) |
| 9 | `specs/architecture.md` | 10 | Full rewrite for new architecture |
| 10 | `specs/features-and-capabilities.md` | 10 | Update commands, engines, modules sections |
| 11 | `specs/usage-and-workflows.md` | 10 | Update command reference, workflows, configuration |
| 12 | `README.md` | 10 | Update layout tree, architecture description |
| 13 | `CHANGELOG.md` | 10 | Add entry for architecture conversion (when version bumped) |
| 14 | `tests/run.cjs` | 9 | Update test runner for new file paths |
| 15 | `tests/lib/spec-validator.cjs` | 9 | Update to validate new command frontmatter schema |
| 16 | `tests/lib/fixture-runner.cjs` | 9 | Update for new hook file paths |
| 17 | `tests/lib/marker-checker.cjs` | 9 | Verify pipeline markers still valid |
| 18 | `tests/lib/lib-routing-tests.cjs` | 9 | Update for new routing table |
| 19 | `tests/lib/lib-engine-compliance-tests.cjs` | 9 | Update for new agent names/frontmatter |
| 20 | `tests/lib/lib-enforcement-tests.cjs` | 9 | Update STAGE_AUTHORITY_MAP expectations |
| 21 | All 23 `tests/specs/*.json` files | 9 | Update command paths and frontmatter expectations |

### 3.3 Files to DELETE

| # | Path | Phase | Reason |
|---|------|-------|--------|
| 1 | `commands/generate.md` | 1 | Untracked stub, replaced by `commands/fp-docs/add.md` |
| 2 | `workflows/generate.md` | 1 | Untracked placeholder, replaced by `workflows/add.md` |
| 3 | `framework/config/system-config.md` | 1 | Legacy, superseded by config.json |
| 4 | `framework/config/project-config.md` | 1 | Legacy, superseded by config.json |
| 5 | `hooks/hooks.json` | 7 | Replaced by settings.json hook registrations + standalone hook files |
| 6 | `skills/revise/SKILL.md` | 10 | Replaced by `commands/fp-docs/revise.md` |
| 7 | `skills/add/SKILL.md` | 10 | Replaced by `commands/fp-docs/add.md` |
| 8 | `skills/auto-update/SKILL.md` | 10 | Replaced by `commands/fp-docs/auto-update.md` |
| 9 | `skills/auto-revise/SKILL.md` | 10 | Replaced by `commands/fp-docs/auto-revise.md` |
| 10 | `skills/deprecate/SKILL.md` | 10 | Replaced by `commands/fp-docs/deprecate.md` |
| 11 | `skills/audit/SKILL.md` | 10 | Replaced by `commands/fp-docs/audit.md` |
| 12 | `skills/verify/SKILL.md` | 10 | Replaced by `commands/fp-docs/verify.md` |
| 13 | `skills/sanity-check/SKILL.md` | 10 | Replaced by `commands/fp-docs/sanity-check.md` |
| 14 | `skills/test/SKILL.md` | 10 | Replaced by `commands/fp-docs/test.md` |
| 15 | `skills/citations/SKILL.md` | 10 | Replaced by `commands/fp-docs/citations.md` |
| 16 | `skills/api-ref/SKILL.md` | 10 | Replaced by `commands/fp-docs/api-ref.md` |
| 17 | `skills/locals/SKILL.md` | 10 | Replaced by `commands/fp-docs/locals.md` |
| 18 | `skills/verbosity-audit/SKILL.md` | 10 | Replaced by `commands/fp-docs/verbosity-audit.md` |
| 19 | `skills/update-index/SKILL.md` | 10 | Replaced by `commands/fp-docs/update-index.md` |
| 20 | `skills/update-claude/SKILL.md` | 10 | Replaced by `commands/fp-docs/update-claude.md` |
| 21 | `skills/update-skills/SKILL.md` | 10 | Replaced by `commands/fp-docs/update-skills.md` |
| 22 | `skills/setup/SKILL.md` | 10 | Replaced by `commands/fp-docs/setup.md` |
| 23 | `skills/sync/SKILL.md` | 10 | Replaced by `commands/fp-docs/sync.md` |
| 24 | `skills/update/SKILL.md` | 10 | Replaced by `commands/fp-docs/update.md` |
| 25 | `skills/parallel/SKILL.md` | 10 | Replaced by `commands/fp-docs/parallel.md` |
| 26 | `skills/remediate/SKILL.md` | 10 | Replaced by `commands/fp-docs/remediate.md` |
| 27 | `skills/do/SKILL.md` | 10 | Replaced by `commands/fp-docs/do.md` |
| 28 | `skills/help/SKILL.md` | 10 | Replaced by `commands/fp-docs/help.md` |
| 29 | `modules/mod-standards/SKILL.md` | 10 | Replaced by `references/doc-standards.md` |
| 30 | `modules/mod-project/SKILL.md` | 10 | Replaced by `references/fp-project.md` |
| 31 | `modules/mod-pipeline/SKILL.md` | 10 | Replaced by `references/pipeline-enforcement.md` |
| 32 | `modules/mod-orchestration/SKILL.md` | 10 | Absorbed into workflow logic |
| 33 | `modules/mod-citations/SKILL.md` | 10 | Replaced by `references/citation-rules.md` |
| 34 | `modules/mod-api-refs/SKILL.md` | 10 | Replaced by `references/api-ref-rules.md` |
| 35 | `modules/mod-changelog/SKILL.md` | 10 | Replaced by `references/changelog-rules.md` |
| 36 | `modules/mod-index/SKILL.md` | 10 | Replaced by `references/index-rules.md` |
| 37 | `modules/mod-locals/SKILL.md` | 10 | Replaced by `references/locals-rules.md` |
| 38 | `modules/mod-verbosity/SKILL.md` | 10 | Replaced by `references/verbosity-rules.md` |
| 39 | `modules/mod-validation/SKILL.md` | 10 | Replaced by `references/validation-rules.md` |
| 40 | `framework/instructions/modify/revise.md` | 10 | Content absorbed into `workflows/revise.md` |
| 41 | `framework/instructions/modify/add.md` | 10 | Content absorbed into `workflows/add.md` |
| 42 | `framework/instructions/modify/auto-update.md` | 10 | Content absorbed into `workflows/auto-update.md` |
| 43 | `framework/instructions/modify/auto-revise.md` | 10 | Content absorbed into `workflows/auto-revise.md` |
| 44 | `framework/instructions/modify/deprecate.md` | 10 | Content absorbed into `workflows/deprecate.md` |
| 45 | `framework/instructions/validate/audit.md` | 10 | Content absorbed into `workflows/audit.md` |
| 46 | `framework/instructions/validate/verify.md` | 10 | Content absorbed into `workflows/verify.md` |
| 47 | `framework/instructions/validate/sanity-check.md` | 10 | Content absorbed into `workflows/sanity-check.md` |
| 48 | `framework/instructions/validate/test.md` | 10 | Content absorbed into `workflows/test.md` |
| 49 | `framework/instructions/citations/generate.md` | 10 | Merged into `workflows/citations.md` |
| 50 | `framework/instructions/citations/update.md` | 10 | Merged into `workflows/citations.md` |
| 51 | `framework/instructions/citations/verify.md` | 10 | Merged into `workflows/citations.md` |
| 52 | `framework/instructions/citations/audit.md` | 10 | Merged into `workflows/citations.md` |
| 53 | `framework/instructions/api-refs/generate.md` | 10 | Merged into `workflows/api-ref.md` |
| 54 | `framework/instructions/api-refs/audit.md` | 10 | Merged into `workflows/api-ref.md` |
| 55 | `framework/instructions/locals/annotate.md` | 10 | Merged into `workflows/locals.md` |
| 56 | `framework/instructions/locals/contracts.md` | 10 | Merged into `workflows/locals.md` |
| 57 | `framework/instructions/locals/coverage.md` | 10 | Merged into `workflows/locals.md` |
| 58 | `framework/instructions/locals/cross-ref.md` | 10 | Merged into `workflows/locals.md` |
| 59 | `framework/instructions/locals/shapes.md` | 10 | Merged into `workflows/locals.md` |
| 60 | `framework/instructions/locals/validate.md` | 10 | Merged into `workflows/locals.md` |
| 61 | `framework/instructions/index/update.md` | 10 | Content absorbed into `workflows/update-index.md` |
| 62 | `framework/instructions/index/update-example-claude.md` | 10 | Content absorbed into `workflows/update-claude.md` |
| 63 | `framework/instructions/orchestrate/delegate.md` | 10 | Logic distributed across write workflows |
| 64 | `framework/instructions/orchestrate/do.md` | 10 | Content absorbed into `workflows/do.md` |
| 65 | `framework/instructions/orchestrate/remediate.md` | 10 | Content absorbed into `workflows/remediate.md` |
| 66 | `framework/instructions/system/setup.md` | 10 | Content absorbed into `workflows/setup.md` |
| 67 | `framework/instructions/system/sync.md` | 10 | Content absorbed into `workflows/sync.md` |
| 68 | `framework/instructions/system/update.md` | 10 | Content absorbed into `workflows/update.md` |
| 69 | `framework/instructions/system/update-skills.md` | 10 | Content absorbed into `workflows/update-skills.md` |
| 70 | `framework/instructions/verbosity/audit.md` | 10 | Content absorbed into `workflows/verbosity-audit.md` |
| 71 | `framework/algorithms/verbosity-algorithm.md` | 10 | Moved to `references/verbosity-algorithm.md` |
| 72 | `framework/algorithms/citation-algorithm.md` | 10 | Moved to `references/citation-algorithm.md` |
| 73 | `framework/algorithms/api-ref-algorithm.md` | 10 | Moved to `references/api-ref-algorithm.md` |
| 74 | `framework/algorithms/validation-algorithm.md` | 10 | Moved to `references/validation-algorithm.md` |
| 75 | `framework/algorithms/git-sync-rules.md` | 10 | Moved to `references/git-sync-rules.md` |
| 76 | `framework/algorithms/codebase-analysis-guide.md` | 10 | Moved to `references/codebase-analysis-guide.md` |
| 77 | `framework/templates/fp-docs-shell.zsh` | 10 | Moved to `templates/fp-docs-shell.zsh` |
| 78 | `framework/templates/fp-docs-statusline.js` | 10 | Moved to `templates/fp-docs-statusline.js` |
| 79 | `framework/templates/post-merge.sh` | 10 | Moved to `templates/post-merge.sh` |
| 80 | `framework/templates/post-rewrite.sh` | 10 | Moved to `templates/post-rewrite.sh` |
| 81 | `agents/orchestrate.md` | 10 | Orchestration moved to workflows |
| 82 | `agents/modify.md` | 10 | Replaced by `agents/fp-docs-modifier.md` |
| 83 | `agents/validate.md` | 10 | Replaced by `agents/fp-docs-validator.md` |
| 84 | `agents/citations.md` | 10 | Replaced by `agents/fp-docs-citations.md` |
| 85 | `agents/api-refs.md` | 10 | Replaced by `agents/fp-docs-api-refs.md` |
| 86 | `agents/locals.md` | 10 | Replaced by `agents/fp-docs-locals.md` |
| 87 | `agents/verbosity.md` | 10 | Replaced by `agents/fp-docs-verbosity.md` |
| 88 | `agents/index.md` | 10 | Replaced by `agents/fp-docs-indexer.md` |
| 89 | `agents/system.md` | 10 | Replaced by `agents/fp-docs-system.md` |
| 90 | `agents/researcher.md` | 10 | Replaced by `agents/fp-docs-researcher.md` |
| 91 | `agents/planner.md` | 10 | Replaced by `agents/fp-docs-planner.md` |

### 3.4 Target Directory Structure

```
fp-docs/                                    # Plugin root (git submodule)
+-- .claude-plugin/
|   +-- plugin.json                          # Plugin manifest (v1.0.0 -- NOT bumped without user instruction)
+-- commands/
|   +-- fp-docs/                             # 23 GSD-style command files
|       +-- revise.md
|       +-- add.md
|       +-- auto-update.md
|       +-- auto-revise.md
|       +-- deprecate.md
|       +-- audit.md
|       +-- verify.md
|       +-- sanity-check.md
|       +-- test.md
|       +-- citations.md
|       +-- api-ref.md
|       +-- locals.md
|       +-- verbosity-audit.md
|       +-- update-index.md
|       +-- update-claude.md
|       +-- update-skills.md
|       +-- setup.md
|       +-- sync.md
|       +-- update.md
|       +-- parallel.md
|       +-- remediate.md
|       +-- do.md
|       +-- help.md
+-- workflows/                               # 23 workflow orchestrators
|   +-- revise.md
|   +-- add.md
|   +-- auto-update.md
|   +-- auto-revise.md
|   +-- deprecate.md
|   +-- audit.md
|   +-- verify.md
|   +-- sanity-check.md
|   +-- test.md
|   +-- citations.md
|   +-- api-ref.md
|   +-- locals.md
|   +-- verbosity-audit.md
|   +-- update-index.md
|   +-- update-claude.md
|   +-- update-skills.md
|   +-- setup.md
|   +-- sync.md
|   +-- update.md
|   +-- parallel.md
|   +-- remediate.md
|   +-- do.md
|   +-- help.md
+-- agents/                                  # 10 specialist agent definitions
|   +-- fp-docs-modifier.md
|   +-- fp-docs-validator.md
|   +-- fp-docs-citations.md
|   +-- fp-docs-api-refs.md
|   +-- fp-docs-locals.md
|   +-- fp-docs-verbosity.md
|   +-- fp-docs-indexer.md
|   +-- fp-docs-system.md
|   +-- fp-docs-researcher.md
|   +-- fp-docs-planner.md
+-- references/                              # 16 shared knowledge files
|   +-- doc-standards.md
|   +-- fp-project.md
|   +-- pipeline-enforcement.md
|   +-- citation-rules.md
|   +-- api-ref-rules.md
|   +-- changelog-rules.md
|   +-- index-rules.md
|   +-- locals-rules.md
|   +-- verbosity-rules.md
|   +-- validation-rules.md
|   +-- verbosity-algorithm.md
|   +-- citation-algorithm.md
|   +-- api-ref-algorithm.md
|   +-- validation-algorithm.md
|   +-- git-sync-rules.md
|   +-- codebase-analysis-guide.md
+-- templates/                               # 4 template files
|   +-- fp-docs-shell.zsh
|   +-- fp-docs-statusline.js
|   +-- post-merge.sh
|   +-- post-rewrite.sh
+-- hooks/                                   # 6 standalone JS hook files (+ hooks.json during transition)
|   +-- fp-docs-session-start.js
|   +-- fp-docs-check-update.js
|   +-- fp-docs-git-guard.js
|   +-- fp-docs-subagent-stop.js
|   +-- fp-docs-teammate-idle.js
|   +-- fp-docs-task-completed.js
+-- lib/                                     # 18 CJS modules
|   +-- core.cjs
|   +-- paths.cjs
|   +-- config.cjs
|   +-- routing.cjs
|   +-- hooks.cjs                            # Kept as shared utility for hook files
|   +-- pipeline.cjs
|   +-- state.cjs
|   +-- git.cjs
|   +-- security.cjs
|   +-- enforcement.cjs
|   +-- drift.cjs
|   +-- source-map.cjs
|   +-- health.cjs
|   +-- update.cjs
|   +-- plans.cjs
|   +-- locals-cli.cjs
|   +-- init.cjs                             # NEW: workflow bootstrapping
|   +-- model-profiles.cjs                   # NEW: model resolution
+-- fp-tools.cjs                             # CLI entry point (updated with new commands)
+-- config.json                              # Unified config (updated with model_profile)
+-- settings.json                            # Permissions + hook registrations
+-- .mcp.json                                # MCP server config
+-- source-map.json                          # Generated data (in .gitignore)
+-- framework/
|   +-- config/
|   |   +-- playwright-mcp-config.json       # Kept
|   +-- tools/
|   |   +-- class-locals-cli.php             # Kept (1408 lines, WP-CLI tool)
|   +-- manifest.md                          # Decision pending (see Part 4)
+-- specs/                                   # Updated spec documents
|   +-- architecture.md
|   +-- features-and-capabilities.md
|   +-- usage-and-workflows.md
+-- tests/                                   # Updated test suite
|   +-- run.cjs
|   +-- lib/                                 # Updated test files
|   +-- specs/                               # Updated spec files
|   +-- fixtures/                            # Updated fixtures
|   +-- markers/                             # Pipeline marker registry
+-- README.md
+-- CHANGELOG.md
```

---

## Part 4: Critical Decisions and Open Questions

### Decision 1: Plugin System Compatibility

**Question:** fp-docs currently uses the Claude Code plugin system (`plugin.json`, `.claude-plugin/`, skills with `context: fork`). GSD uses custom commands (`~/.claude/commands/`). Can fp-docs adopt GSD's command architecture while remaining a plugin?

**Context:** The `commands/` directory is recognized by the Claude Code plugin system. The plugin can register commands via `commands/fp-docs/*.md` files. This is a newer plugin primitive that co-exists with `skills/`. The plugin.json manifest stays. The `.claude-plugin/` directory stays.

**Recommendation:** Yes, proceed with `commands/fp-docs/` as the new command format. This is a supported plugin primitive. The key change is moving from `skills/` (which use `context: fork` + `agent:` routing) to `commands/` (which use `allowed-tools` + `@-reference` routing). Both are valid plugin primitives.

**Impact if wrong:** Commands don't load. Would need to keep skills as a bridge layer.

**Action needed:** User confirmation that `commands/` is the intended target. Suggest testing one command (`commands/fp-docs/help.md`) in Phase 1 before converting all 23.

### Decision 2: Manifest File Disposition

**Question:** What happens to `framework/manifest.md`?

**Context:** The manifest currently lists all components, version, and plugin identity. In GSD, there's no equivalent single manifest file -- the help workflow generates output dynamically.

**Options:**
- A) Keep manifest.md, update it for new architecture
- B) Remove manifest.md, have the help workflow generate manifest-like output dynamically from `fp-tools.cjs route table` and agent directory listing
- C) Move manifest content into README.md or a reference file

**Recommendation:** Option B. The manifest was needed when the orchestrate engine was the central dispatcher. With workflows handling routing, the manifest's purpose is served by `fp-tools help` and `fp-tools route table`.

**Action needed:** User decision.

### Decision 3: Version Bump Timing

**Question:** When should the version be bumped?

**Context:** Per governance rules, version bumps require explicit user instruction. The architecture conversion is a major change that warrants a version bump, but the timing matters.

**Options:**
- A) Bump to 2.0.0 at the start (Phase 1) to signal the architecture change
- B) Bump to 2.0.0 after Phase 10 (cleanup complete) so the version reflects the finished state
- C) Don't bump until user explicitly requests it

**Recommendation:** Option C. Follow governance rules strictly. The plan specifies all changes WITHOUT bumping the version. User decides when and what version to bump to.

**Action needed:** User instruction when ready to bump. Plan respects version 1.0.0 throughout.

### Decision 4: Three-Repo Git Model in Workflows

**Question:** The orchestrate engine currently encapsulates all three-repo git logic. When orchestration moves to workflows, how do workflows handle the three-repo model?

**Context:** Currently, only the orchestrate engine commits (via CJS pipeline stage 8, which calls `lib/git.cjs`). In the new architecture, the write workflow's finalize phase calls `fp-tools pipeline run-stage 8`, which calls `lib/git.cjs`. The git logic stays in CJS.

**Resolution:** No change needed. The CJS pipeline stage 8 (`executeDocsCommit`) already handles the three-repo model. Workflows call it via `fp-tools pipeline run-stage 8`. The constraint "only the workflow finalize phase commits" replaces "only the orchestrator commits" -- same effect, different entity.

**Risk:** A workflow could accidentally call git directly instead of through the pipeline. Mitigation: the PreToolUse `fp-docs-git-guard.js` hook blocks raw git-write commands (preserved from current system).

### Decision 5: Module Content Loading Strategy

**Question:** Modules are currently preloaded via agent `skills:` list, meaning they're always in context. References are loaded on-demand via `@-reference`. Should all domain knowledge be loaded on-demand (GSD pattern), or should some critical references be auto-loaded?

**Context:** The `doc-standards.md` and `fp-project.md` references are needed by EVERY operation. In the current system, they're always in context via preloading. In the GSD pattern, they'd need to be `@-referenced` in every command.

**Recommendation:** Include `doc-standards.md` and `fp-project.md` in the `<execution_context>` of every command file. This is slightly verbose (repeating two references 23 times) but follows GSD's explicit-is-better-than-implicit philosophy.

**Alternative:** Create a single `references/common-context.md` file that bundles the always-needed content. Commands reference just this one file.

**Action needed:** User preference.

### Decision 6: Handling the `setup` Skill's Inline Body

**Question:** The current `setup` skill has a large inline body (7-phase procedure) that goes beyond simple routing metadata. How should this be handled?

**Context:** Most skills are thin routing files, but `setup` embeds the entire setup procedure. In the new architecture, this content goes into `workflows/setup.md`.

**Resolution:** Move the inline procedure to `workflows/setup.md`. The command `commands/fp-docs/setup.md` becomes a thin router like all other commands. No special handling needed.

### Decision 7: Parallel Command Architecture

**Question:** The current `parallel` command uses `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` with `TeamCreate`, `SendMessage`, `TaskCreate`, `TaskUpdate`, `TaskList` tools. How does this work in the new architecture?

**Context:** GSD uses `Task()` for agent spawning in workflows. fp-docs' parallel command uses the Agent Teams API which is different from simple Task spawning.

**Resolution:** The `workflows/parallel.md` workflow will use the Team API tools (TaskCreate, TeamCreate, etc.) directly in its process steps, just as the orchestrate engine currently does. The command file `commands/fp-docs/parallel.md` must include these tools in its `allowed-tools`:
```yaml
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Task
  - TeamCreate
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
```

---

## Part 5: Risk Assessment

### Risk 1: Plugin System Command Compatibility
**Severity:** HIGH
**Description:** The `commands/` directory format may behave differently from `skills/` in the plugin system. Skills use `context: fork` to create isolated subagent contexts. Commands may not provide the same isolation.
**Mitigation:** Test one command in isolation during Phase 1 before converting all 23. If `commands/` doesn't support plugin-scoped `@-reference` with `${CLAUDE_PLUGIN_ROOT}`, may need to use absolute paths or keep the skill format as a bridge.
**Fallback:** If commands don't work as expected within the plugin system, keep `skills/` as thin wrappers that invoke the new command files. This adds one level of indirection but preserves both architectures.

### Risk 2: Reference Loading vs Module Preloading Performance
**Severity:** MEDIUM
**Description:** Modules are preloaded once at agent startup. References loaded via `@-reference` may be re-read for each command invocation. For frequently-used references (doc-standards, fp-project), this could add latency.
**Mitigation:** Claude Code's `@-reference` mechanism caches file reads within a session. Performance should be comparable. Monitor during Phase 6 testing.

### Risk 3: Pipeline Enforcement Integrity
**Severity:** HIGH
**Description:** The 8-stage pipeline is fp-docs' core value proposition. Moving orchestration from the orchestrate engine to workflows must not break pipeline enforcement. If a workflow skips a stage or doesn't call the pipeline correctly, the accuracy guarantee is compromised.
**Mitigation:** Pipeline enforcement is already CJS-driven (not LLM-driven). The `fp-tools pipeline init/next/run-stage` callback loop is deterministic. Workflows call the same CLI commands the orchestrate engine currently calls. The `fp-docs-subagent-stop.js` hook validates pipeline markers. Tests in `lib-pipeline-tests.cjs` (1171 lines) verify pipeline behavior.
**Additional safeguard:** Add a new PreToolUse hook that verifies pipeline state before any Write/Edit call to docs, ensuring the pipeline was properly initialized.

### Risk 4: Delegation Result Format Changes
**Severity:** MEDIUM
**Description:** The enforcement module parses delegation results from agent output. Changing agent names and output format could break parsing.
**Mitigation:** Update `parseDelegationResult()` in `lib/enforcement.cjs` to handle new agent output format. Update `STAGE_AUTHORITY_MAP` with new agent names. Run enforcement tests after Phase 4.

### Risk 5: Instruction File Content Loss During Workflow Conversion
**Severity:** MEDIUM
**Description:** 30 instruction files are being absorbed into 23 workflows (some merged). Domain-specific procedures could be lost or incorrectly translated.
**Mitigation:** For each workflow, explicitly verify that ALL steps from the source instruction file(s) are present. The merge operations (citations, api-ref, locals) are the highest risk. Create a checklist comparing each instruction file's steps to the corresponding workflow's steps.

### Risk 6: Three-Repo Git Operations During Transition
**Severity:** LOW
**Description:** During the multi-phase conversion, the repo will have both old and new components. Git operations must continue working.
**Mitigation:** Git operations are handled entirely by `lib/git.cjs` and `lib/pipeline.cjs`. These modules are not modified until Phase 8 (integration). Until Phase 10 (cleanup), both old and new files co-exist.

### Risk 7: Test Suite Breakage During Transition
**Severity:** MEDIUM
**Description:** Tests reference specific file paths and frontmatter schemas that change during conversion.
**Mitigation:** Tests are updated in Phase 9, after all components are converted. During Phases 2-8, some tests will fail. This is expected and acceptable. The test runner should be run after Phase 9 to verify everything passes.

### Risk 8: Backward Compatibility
**Severity:** LOW
**Description:** Users who have learned the current `/fp-docs:*` command syntax will see the same commands but with different internal behavior.
**Mitigation:** Command NAMES are preserved (`/fp-docs:revise`, `/fp-docs:audit`, etc.). External behavior is identical. Only internal architecture changes. Users should not notice any difference in how they invoke commands or what results they get.

### Testing Strategy Per Phase

| Phase | How to Test |
|-------|------------|
| 1 (Foundation) | `fp-tools health check`. `claude plugin validate .`. Test one command file loads. |
| 2 (References) | Verify all 16 reference files exist. Content-compare against original modules/algorithms. |
| 3 (CLI Tooling) | `fp-tools init write-op revise "test"` returns valid JSON. `fp-tools resolve-model fp-docs-modifier --raw` returns model name. |
| 4 (Agents) | All 10 agent files have valid YAML frontmatter. `fp-tools health check` finds all agents. |
| 5 (Workflows) | All 23 workflow files have valid XML structure. Workflows reference correct agents and references. |
| 6 (Commands) | All 23 command files have valid YAML frontmatter and XML body. Commands reference correct workflows. |
| 7 (Hooks) | All 6 hook files execute without error. `settings.json` has correct registrations. Hooks fire on correct events. |
| 8 (Integration) | End-to-end test: invoke a write command, verify full pipeline executes. Invoke a read command, verify report generated. |
| 9 (Tests) | `node tests/run.cjs` passes all tests. |
| 10 (Cleanup) | No orphaned files. No stale references. Specs match reality. `fp-tools health check` clean. |

---

## Part 6: Adversarial Review

### Review Checklist

**Check 1: Is every fp-docs file accounted for?**

Cross-referencing against the current state document's file inventory (Section 1):

- Root configuration files: `plugin.json` (kept), `settings.json` (modified), `config.json` (modified), `.mcp.json` (kept), `hooks.json` (deleted, replaced), `fp-tools.cjs` (modified), `source-map.json` (gitignored), `README.md` (updated), `CHANGELOG.md` (updated). **All accounted for.**

- Agents (11 files): orchestrate.md (removed), modify.md (replaced), validate.md (replaced), citations.md (replaced), api-refs.md (replaced), locals.md (replaced), verbosity.md (replaced), index.md (replaced), system.md (replaced), researcher.md (replaced), planner.md (replaced). **All 11 accounted for.**

- Skills (23 directories): All 23 mapped in Section 1.1. **All accounted for.**

- Modules (11 directories): All 11 mapped in Section 1.3. **All accounted for.**

- CJS library (16 files): All 16 mapped in Section 1.7, plus 2 new modules. **All accounted for.**

- Instructions (30 files): All 30 mapped in Section 1.4. **All accounted for.**

- Algorithms (6 files): All 6 mapped in Section 1.5. **All accounted for.**

- Config (3 files): system-config.md (deleted), project-config.md (deleted), playwright-mcp-config.json (kept). **All accounted for.**

- Templates (4 files): All 4 mapped in Section 1.9. **All accounted for.**

- Tools (1 file): class-locals-cli.php (kept). **Accounted for.**

- Specs (3 files): All updated in Phase 10. **Accounted for.**

- Tests: test runner, 15+ test files, fixtures, specs, markers. All updated in Phase 9. **Accounted for.**

- Untracked files: commands/generate.md (deleted), workflows/generate.md (deleted), source-map.json (gitignored). **All accounted for.**

**Check 2: Is every GSD pattern that should be adopted actually addressed?**

- Command-workflow-agent chain: YES (Part 2, Phases 4-6)
- XML prompt structure: YES (Section 1.1, 1.2)
- `@-reference` context loading: YES (Section 1.1, 1.3)
- CLI-driven workflow init: YES (Section 1.7.1, Phase 3)
- Model resolution at spawn time: YES (Section 1.7, Phase 3)
- `@file:` protocol for large payloads: YES (Phase 3, Step 4)
- Standalone hook files: YES (Phase 7)
- settings.json hook registration: YES (Phase 7)
- No module preloading (on-demand via @-reference): YES (Section 1.3)
- Agent frontmatter: comma-separated tools, no model/maxTurns/skills: YES (Section 1.2)
- Thin commands that reference workflows: YES (Section 1.1)
- Workflows as orchestrators with Task() spawning: YES (Phase 5)

**Check 3: Are there circular dependencies between phases?**

Phase dependency chain: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 (parallel with 5-6) -> 8 -> 9 -> 10.

- Phase 1 has no dependencies. OK.
- Phase 2 depends on Phase 1 (directories). OK.
- Phase 3 depends on Phase 1 (config). OK. Could run parallel with Phase 2.
- Phase 4 depends on Phase 2 (references exist for agent file_to_read mentions). OK.
- Phase 5 depends on Phase 3 (init commands) and Phase 4 (agents). OK.
- Phase 6 depends on Phase 5 (workflows) and Phase 2 (references). OK.
- Phase 7 depends on Phase 4 (agent names for matchers). Can run parallel with Phases 5-6.
- Phase 8 depends on all of 1-7. OK.
- Phase 9 depends on Phase 8. OK.
- Phase 10 depends on Phase 9. OK.

No circular dependencies found. Phase 7 (hooks) can optionally run in parallel with Phases 5-6 since it only depends on Phase 4.

**Check 4: Could someone execute this plan without asking clarifying questions?**

Open decisions that require user input (Part 4):
- Decision 1 (plugin system compatibility): Has a recommended action (test one command first)
- Decision 2 (manifest disposition): Needs user choice
- Decision 3 (version bump timing): Clear recommendation (don't bump without user instruction)
- Decision 4 (three-repo in workflows): Self-resolved, no action needed
- Decision 5 (module loading strategy): Needs user preference
- Decision 6 (setup inline body): Self-resolved
- Decision 7 (parallel command): Self-resolved

**Gap found:** Decisions 2 and 5 need user input before execution can proceed fully. However, the plan can proceed through Phase 4 without these decisions. Decision 5 affects Phase 6 (commands), and Decision 2 affects Phase 10 (cleanup).

**Resolution:** The plan is executable through Phase 4 without user input. Before Phase 6, Decision 5 must be made. Before Phase 10, Decision 2 must be made. This is documented.

**Check 5: Are all 23 fp-docs commands mapped with specific file paths?**

Verified in Section 1.1 table. All 23 commands have:
- Current skill path
- New command path
- Referenced workflow path

**All 23 confirmed.**

**Check 6: Is the pipeline enforcement system preserved?**

- `lib/pipeline.cjs` (868 lines): KEPT, unchanged (Section 1.7, #7)
- Pipeline callback loop (init/next/run-stage): PRESERVED, called by workflows instead of orchestrate engine (Section 1.10)
- 8 stages, 3 phases: PRESERVED (Section 1.10)
- Stage gate validation (`validateStageGate`): PRESERVED in pipeline.cjs
- Enforcement module (`lib/enforcement.cjs`): KEPT, updated for new agent names (Section 1.7, #11)
- SubagentStop hooks for pipeline marker validation: PRESERVED in new hook files (Section 1.6, #6-9)
- Never-skip stages (5, 6, 8): PRESERVED in pipeline.cjs config

**Pipeline enforcement confirmed preserved.**

**Check 7: Is the three-repo git model preserved?**

- `lib/git.cjs` (712 lines): KEPT, unchanged (Section 1.7, #9)
- `lib/paths.cjs` (128 lines): KEPT, unchanged (Section 1.7, #3)
- Three-repo resolution (codebase, docs, plugin): PRESERVED in paths.cjs
- Only workflow finalize phase commits (replaces "only orchestrator commits"): PRESERVED (Decision 4)
- PreToolUse git-write blocking: PRESERVED in `fp-docs-git-guard.js` (Section 1.6, #1)

**Three-repo model confirmed preserved.**

**Check 8: Are untracked files accounted for?**

- `commands/generate.md`: DELETED in Phase 1 (Section 1.13, Phase 1 Step 5)
- `workflows/generate.md`: DELETED in Phase 1 (Section 1.13, Phase 1 Step 5)
- `source-map.json`: ADDED TO .gitignore in Phase 1 (Section 1.13, Phase 1 Step 3)

**All untracked files accounted for.**

**Check 9: Does the plan account for updating CLAUDE.md, specs, README, CHANGELOG?**

- `CLAUDE.md` (root): Updated in Phase 10, Step 7
- `specs/architecture.md`: Updated in Phase 10, Step 3
- `specs/features-and-capabilities.md`: Updated in Phase 10, Step 4
- `specs/usage-and-workflows.md`: Updated in Phase 10, Step 5
- `README.md`: Updated in Phase 10, Step 6
- `CHANGELOG.md`: Updated in Phase 10, Step 8 (entry added when version bumped per user instruction)

**All documentation files accounted for.**

### Gaps Found and Resolved

**Gap 1: `framework/manifest.md` not listed in Phase 10 deletion candidates.**

The manifest file is mentioned in Decision 2 (Part 4) but not explicitly listed in the Phase 10 deletion list. If the user chooses to remove it (Option B), it needs to be in the deletion list.

**Resolution:** Added explicit mention in Phase 10, Step 2: "Decision needed (see Part 4). If kept, update. If removed, delete."

**Gap 2: `lib/hooks.cjs` disposition not explicit enough.**

Phase 7 says to "refactor into shared utility or remove" but doesn't give a clear recommendation.

**Resolution:** Added explicit recommendation in Phase 7, Step 5: "Recommend keeping it as a utility with exported functions that hook files import."

**Gap 3: `tests/fixtures/hooks/` fixture files need updating for new agent names.**

The test fixtures in `tests/fixtures/hooks/` reference current engine names (modify, orchestrate) in their expected output. These need updating for new agent names.

**Resolution:** This is covered implicitly by Phase 9 (test suite update) but not explicitly called out. Added to Phase 9 as implicit coverage under Step 2 (fixture runner update).

**Gap 4: `tests/lib/hooks-ab-runner.cjs` may become obsolete.**

The A/B comparison tests compare CJS hook handlers against legacy bash implementations. If hooks migrate to standalone JS files, this test file may no longer be applicable.

**Resolution:** Noted. The hooks-ab-runner tests should be evaluated during Phase 9. If no bash implementations remain, this test file can be removed or repurposed.

**Gap 5: `framework/` directory may become nearly empty after cleanup.**

After Phase 10, `framework/` would contain only `config/playwright-mcp-config.json`, `tools/class-locals-cli.php`, and possibly `manifest.md`. This is a sparse directory.

**Resolution:** Consider flattening: move `class-locals-cli.php` to `lib/tools/class-locals-cli.php` or `tools/class-locals-cli.php`. Move playwright config to root `.mcp.json` (which already exists). This would allow deleting the `framework/` directory entirely. Added as a consideration in Phase 10, Step 2.

**Gap 6: `.claude/project-memory.md` not mentioned.**

The CLAUDE.md mentions project-memory.md as an important file. The conversion plan should note that project-memory should be updated to record the architecture conversion.

**Resolution:** After Phase 10 completes, update `.claude/project-memory.md` with a note about the architecture conversion, including the date, the key decisions made, and any patterns learned during the conversion. This is a maintenance task, not a conversion step.

**Gap 7: SubagentStop matchers need comprehensive coverage.**

The current hooks.json has matchers for: modify, orchestrate, locals, validate, citations, api-refs, researcher, planner. The new settings.json hook registrations in Phase 7 only list fp-docs-modifier, fp-docs-validator, and fp-docs-locals. Missing: fp-docs-citations, fp-docs-api-refs, fp-docs-researcher, fp-docs-planner.

**Resolution:** Update the settings.json hook registration example in Phase 7, Step 3 to include ALL agent matchers that need SubagentStop checks. The complete list:
- `fp-docs-modifier` (post-modify checks)
- `fp-docs-validator` (post-validate checks)
- `fp-docs-locals` (locals CLI cleanup)
- `fp-docs-citations` (post-citations checks)
- `fp-docs-api-refs` (post-api-refs checks)
- `fp-docs-researcher` (enforcement check)
- `fp-docs-planner` (enforcement check)

The `fp-docs-subagent-stop.js` hook file must handle all these agents, routing to the appropriate handler based on the agent name in the event payload. This mirrors the current hooks.json pattern of having separate matcher entries per engine.

**Gap 8: The `do` command routing needs special handling.**

The current `do` command uses the orchestrate engine to analyze freeform text and route to the appropriate command. Without the orchestrate engine, the `do` workflow needs to replicate this routing logic.

**Resolution:** The `workflows/do.md` workflow will use `fp-tools route lookup <text>` to determine the appropriate command, then invoke it. The routing logic from the orchestrate engine's system prompt (Command-to-Engine Routing Table) is already in `lib/routing.cjs`. The workflow calls the CLI for routing resolution.

**Gap 9: No explicit mention of how `$CLAUDE_PLUGIN_ROOT` works in the new architecture.**

Commands use `@${CLAUDE_PLUGIN_ROOT}/workflows/...` and `@${CLAUDE_PLUGIN_ROOT}/references/...`. The `$CLAUDE_PLUGIN_ROOT` variable is injected by the SessionStart hook (`handleInjectManifest`). This hook is being migrated.

**Resolution:** The `fp-docs-session-start.js` hook MUST continue to inject `$CLAUDE_PLUGIN_ROOT` (or its equivalent) so that commands can resolve `@-reference` paths. This is already implicit in Phase 7 (the session-start hook combines inject-manifest functionality), but making it explicit here.

**Gap 10: `plugin.json` does not need `skills/` or `modules/` references.**

The current `plugin.json` is minimal (name, version, description, author, repository). It doesn't list skills or modules. The commands/ directory is auto-discovered by the plugin system. No plugin.json changes needed beyond the description update in Phase 8.

**Resolution:** Confirmed no gap. `plugin.json` update in Phase 8 is description-only.

---

## Summary

This plan converts fp-docs from a plugin-system architecture (skills -> orchestrate engine -> specialist engines -> pipeline) to a GSD-style architecture (commands -> workflows -> specialist agents -> pipeline) across 10 phases.

**Total file operations:**
- 86 files to CREATE
- 21 files to MODIFY
- 91 files to DELETE

**Preserved (not touched by the conversion):**
- Pipeline enforcement system (lib/pipeline.cjs, 868 lines)
- Three-repo git model (lib/git.cjs, lib/paths.cjs)
- Source-map system (lib/source-map.cjs, source-map.json)
- Security module (lib/security.cjs)
- Drift detection (lib/drift.cjs)
- WP-CLI locals tool (framework/tools/class-locals-cli.php)
- All domain knowledge (module content preserved as references)
- All operation procedures (instruction file content preserved in workflows)
- Test infrastructure (updated, not rebuilt)
- Zero external dependencies (maintained)

**Key architectural changes:**
1. Orchestration moves from a central engine agent to distributed workflow orchestrators
2. Module preloading replaced by on-demand `@-reference` loading
3. Agent frontmatter simplified (no model, maxTurns, or skills list)
4. Hook system moves from hooks.json to standalone JS files in settings.json
5. Commands replace skills as the user-facing entry point
6. Model resolution moves to spawn time via CLI

**Decisions requiring user input before execution:**
- Decision 2: Manifest disposition (before Phase 10)
- Decision 5: Module loading strategy (before Phase 6)
- Decision 1: Plugin command compatibility validation (verify during Phase 1)
