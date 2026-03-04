Plan to implement                                                                                               │
│                                                                                                                 │
│ Plan: Multi-Agent Orchestration Architecture for fp-docs                                                        │
│                                                                                                                 │
│ Context                                                                                                         │
│                                                                                                                 │
│ Problem: Every user command routes to exactly one engine agent via agent: <scalar> in skill frontmatter. No     │
│ engine has the Agent, TeamCreate, SendMessage, or Task tools. A single modify agent runs the primary operation  │
│ PLUS all 8 pipeline stages inline — monolithic execution with no delegation. Multi-agent config thresholds      │
│ exist in system-config but are dead code. The /fp-docs:parallel skill describes team orchestration but the      │
│ system engine lacks the tools to implement it. Hook scripts for TeammateIdle and TaskCompleted are stubs (exit  │
│ 0).                                                                                                             │
│                                                                                                                 │
│ Goal: Transform the plugin so multi-agent orchestration is the default execution model. Every command routes    │
│ through a universal orchestrator that delegates to specialist engine subagents. Single-agent execution should   │
│ be the exception, not the rule.                                                                                 │
│                                                                                                                 │
│ Outcome: A universal orchestrate engine receives all commands, spawns specialist engines for domain work,       │
│ delegates pipeline validation to the validate engine as an independent quality reviewer, handles finalization   │
│ (changelog, index, git) itself, and creates teams for batch/parallel operations.                                │
│                                                                                                                 │
│ ---                                                                                                             │
│ Design: Universal Orchestrator with Pipeline Phase Delegation                                                   │
│                                                                                                                 │
│ Core Architectural Change                                                                                       │
│                                                                                                                 │
│ BEFORE (current):                                                                                               │
│   Skill → agent: modify → modify does EVERYTHING (primary + 8 pipeline stages)                                  │
│                                                                                                                 │
│ AFTER (new):                                                                                                    │
│   Skill → agent: orchestrate → orchestrator delegates:                                                          │
│     1. Primary engine (modify/citations/api-refs/locals) → core operation + enforcement stages 1-3              │
│     2. Validate engine → quality review stages 4-5                                                              │
│     3. Orchestrator itself → finalization stages 6-8                                                            │
│                                                                                                                 │
│ Why Universal Orchestrator (Not Self-Orchestration)                                                             │
│                                                                                                                 │
│ The user's requirement is "multi-agent by default, rare that a single agent is ever used solo." This eliminates │
│  Option B (engine self-orchestration), which only triggers multi-agent above scope thresholds. A universal      │
│ orchestrator ensures EVERY command uses multiple agents — the orchestrator always spawns at least one           │
│ specialist.                                                                                                     │
│                                                                                                                 │
│ Pipeline Phase Grouping                                                                                         │
│                                                                                                                 │
│ Instead of decomposing the pipeline into 8 individual subagent calls, group by capability:                      │
│                                                                                                                 │
│ ┌────────────┬───────────────────────────────────┬─────────────────────┬────────────────────────────────────┐   │
│ │   Phase    │              Stages               │        Agent        │             Rationale              │   │
│ ├────────────┼───────────────────────────────────┼─────────────────────┼────────────────────────────────────┤   │
│ │ Write      │ Primary op + Stages 1-3           │ Primary engine      │ Needs write access + domain        │   │
│ │ Phase      │ (verbosity, citations, API refs)  │ (modify, etc.)      │ context from just-written docs     │   │
│ ├────────────┼───────────────────────────────────┼─────────────────────┼────────────────────────────────────┤   │
│ │ Review     │ Stages 4-5 (sanity-check, verify) │ Validate engine     │ Independent quality review — fresh │   │
│ │ Phase      │                                   │                     │  eyes on the work                  │   │
│ ├────────────┼───────────────────────────────────┼─────────────────────┼────────────────────────────────────┤   │
│ │ Finalize   │ Stages 6-8 (changelog, index,     │ Orchestrator        │ Administrative — no domain         │   │
│ │ Phase      │ git)                              │                     │ expertise needed                   │   │
│ └────────────┴───────────────────────────────────┴─────────────────────┴────────────────────────────────────┘   │
│                                                                                                                 │
│ This grouping respects the sequential dependencies (stages 1-3 fix issues before stages 4-5 validate) while     │
│ achieving genuine multi-agent orchestration (minimum 3 agents per write command).                               │
│                                                                                                                 │
│ Agent Count Per Command Type                                                                                    │
│                                                                                                                 │
│ ┌───────────────────┬─────────────────────────────────────────────┬────────┬─────────────────────────────────┐  │
│ │   Command Type    │                  Examples                   │ Agents │            Breakdown            │  │
│ ├───────────────────┼─────────────────────────────────────────────┼────────┼─────────────────────────────────┤  │
│ │ Write operations  │ revise, add, auto-update, deprecate         │ 3+     │ orchestrate + primary engine +  │  │
│ │                   │                                             │        │ validate                        │  │
│ ├───────────────────┼─────────────────────────────────────────────┼────────┼─────────────────────────────────┤  │
│ │ Read-only         │ audit, verify, sanity-check, test,          │ 2      │ orchestrate + specialist engine │  │
│ │ operations        │ verbosity-audit                             │        │                                 │  │
│ ├───────────────────┼─────────────────────────────────────────────┼────────┼─────────────────────────────────┤  │
│ │ Batch operations  │ parallel, auto-update (large scope)         │ N+2    │ orchestrate + N teammates +     │  │
│ │                   │                                             │        │ validate                        │  │
│ ├───────────────────┼─────────────────────────────────────────────┼────────┼─────────────────────────────────┤  │
│ │ Specialist write  │ citations generate, api-ref generate,       │ 3      │ orchestrate + specialist +      │  │
│ │ ops               │ locals annotate                             │        │ validate                        │  │
│ └───────────────────┴─────────────────────────────────────────────┴────────┴─────────────────────────────────┘  │
│                                                                                                                 │
│ Delegation Protocol                                                                                             │
│                                                                                                                 │
│ Engines gain a "Delegated Mode" section in their system prompt. When the orchestrator's prompt includes Mode:   │
│ DELEGATED, the engine:                                                                                          │
│ - Executes ONLY its assigned work (primary operation, or pipeline stages 1-3)                                   │
│ - Does NOT update changelog, index, or commit to git                                                            │
│ - Returns a structured result listing files modified and any issues found                                       │
│                                                                                                                 │
│ When the orchestrator's prompt includes Mode: PIPELINE-VALIDATION, the validate engine:                         │
│ - Runs sanity-check (stage 4) and 10-point verify (stage 5) on specified files                                  │
│ - Returns a structured validation report                                                                        │
│                                                                                                                 │
│ Batch/Team Protocol                                                                                             │
│                                                                                                                 │
│ For scopes exceeding thresholds (configurable in system-config):                                                │
│ - orchestration.parallel_threshold_files: 3 → fan-out via Agent tool                                            │
│ - orchestration.team_threshold_files: 8 → create Team with batched teammates                                    │
│ - Each teammate runs primary operation + stages 1-3 in DELEGATED mode (no git)                                  │
│ - Orchestrator runs ONE validation pass after all teammates complete                                            │
│ - Orchestrator performs ONE git commit covering all changes                                                     │
│                                                                                                                 │
│ ---                                                                                                             │
│ Implementation Phases                                                                                           │
│                                                                                                                 │
│ Phase 1: Create the Orchestrate Engine (3 new files)                                                            │
│                                                                                                                 │
│ 1.1 Create agents/orchestrate.md                                                                                │
│ - New engine agent definition                                                                                   │
│ - Tools: Agent, TeamCreate, SendMessage, TaskCreate, TaskUpdate, TaskList, Read, Write, Edit, Grep, Glob, Bash  │
│ - Skills (modules): mod-standards, mod-project, mod-pipeline, mod-changelog                                     │
│ - Model: opus | maxTurns: 100 | Color: white                                                                    │
│ - System prompt sections:                                                                                       │
│   - Identity: universal orchestration engine for all 19 commands                                                │
│   - Plugin root: same pattern as existing engines                                                               │
│   - Step 1 — Parse: extract Engine:, Operation:, flags from skill body                                          │
│   - Step 2 — Scope Analysis: count target files/functions, read system-config thresholds, select strategy       │
│ (single/fanout/team)                                                                                            │
│   - Step 3 — Execute Write Phase: spawn primary engine with Mode: DELEGATED prompt containing operation +       │
│ instruction file path + target                                                                                  │
│   - Step 4 — Execute Review Phase: spawn validate engine with Mode: PIPELINE-VALIDATION prompt containing file  │
│ list from Step 3                                                                                                │
│   - Step 5 — Handle validation issues: if sanity-check returns LOW, spawn primary engine again to fix, then     │
│ re-validate (max 1 retry)                                                                                       │
│   - Step 6 — Finalize: update changelog (stage 6), conditionally delegate to index engine (stage 7), run        │
│ docs-commit.sh (stage 8)                                                                                        │
│   - Step 7 — Report: aggregate all subagent results into unified report                                         │
│   - Parallel execution protocol: when/how to use teams                                                          │
│   - Git rules: only the orchestrator touches git; specialists never commit                                      │
│   - Error recovery: if a specialist fails, log it, attempt fallback, report to user                             │
│   - Read-only command fast path: for audit/verify/test/verbosity-audit/read-only subcommands — spawn            │
│ specialist, return report, skip pipeline                                                                        │
│   - Pipeline skip conditions: honor system-config flags and --no-* user flags                                   │
│   - Command→Engine routing table (embedded in prompt for quick lookup)                                          │
│                                                                                                                 │
│ 1.2 Create framework/instructions/orchestrate/delegate.md                                                       │
│ - Master delegation algorithm (the orchestrator reads this for every invocation)                                │
│ - Detailed steps: parse routing info → scope analysis → strategy selection → delegation prompt construction →   │
│ pipeline phase execution → aggregation → completion marker                                                      │
│ - Delegation prompt templates for each phase (write, review, finalize)                                          │
│ - Team creation protocol for batch operations                                                                   │
│                                                                                                                 │
│ 1.3 Create modules/mod-orchestration/SKILL.md                                                                   │
│ - Shared module (non-user-invocable, disable-model-invocation: true)                                            │
│ - Contains: delegation thresholds (reified from system-config), batching strategy, aggregation report format,   │
│ team naming convention, error recovery protocol, delegation prompt templates                                    │
│ - Preloaded by the orchestrate engine                                                                           │
│                                                                                                                 │
│ Phase 2: Update All 19 Skill Files (19 modified files)                                                          │
│                                                                                                                 │
│ Every skill changes:                                                                                            │
│ 1. agent: {engine} → agent: orchestrate                                                                         │
│ 2. Skill body gains Engine: {original-engine} line for routing                                                  │
│ 3. Instruction file reference stays (the orchestrator passes it to the specialist)                              │
│ 4. Remove allowed-tools: from skills that have it (audit, verify, sanity-check, verbosity-audit) — the          │
│ orchestrator needs its full tool set; read-only enforcement is already in the specialist engines'               │
│ disallowedTools                                                                                                 │
│                                                                                                                 │
│ Example change — skills/revise/SKILL.md:                                                                        │
│ # BEFORE:                                                                                                       │
│ ---                                                                                                             │
│ agent: modify                                                                                                   │
│ context: fork                                                                                                   │
│ ---                                                                                                             │
│ Operation: revise                                                                                               │
│ Read the instruction file at `framework/instructions/modify/revise.md`...                                       │
│                                                                                                                 │
│ # AFTER:                                                                                                        │
│ ---                                                                                                             │
│ agent: orchestrate                                                                                              │
│ context: fork                                                                                                   │
│ ---                                                                                                             │
│ Engine: modify                                                                                                  │
│ Operation: revise                                                                                               │
│ Instruction: framework/instructions/modify/revise.md                                                            │
│ User request: $ARGUMENTS                                                                                        │
│                                                                                                                 │
│ Full skill change list (all 19):                                                                                │
│                                                                                                                 │
│ ┌─────────────────┬────────────┬─────────────┬───────────────┬─────────────────────────┐                        │
│ │      Skill      │ Old agent: │ New agent:  │ Engine: added │ allowed-tools: removed? │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ revise          │ modify     │ orchestrate │ modify        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ add             │ modify     │ orchestrate │ modify        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ auto-update     │ modify     │ orchestrate │ modify        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ auto-revise     │ modify     │ orchestrate │ modify        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ deprecate       │ modify     │ orchestrate │ modify        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ audit           │ validate   │ orchestrate │ validate      │ YES                     │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ verify          │ validate   │ orchestrate │ validate      │ YES                     │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ sanity-check    │ validate   │ orchestrate │ validate      │ YES                     │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ test            │ validate   │ orchestrate │ validate      │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ citations       │ citations  │ orchestrate │ citations     │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ api-ref         │ api-refs   │ orchestrate │ api-refs      │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ locals          │ locals     │ orchestrate │ locals        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ verbosity-audit │ verbosity  │ orchestrate │ verbosity     │ YES                     │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ update-index    │ index      │ orchestrate │ index         │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ update-claude   │ index      │ orchestrate │ index         │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ update-skills   │ system     │ orchestrate │ system        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ setup           │ system     │ orchestrate │ system        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ sync            │ system     │ orchestrate │ system        │ —                       │                        │
│ ├─────────────────┼────────────┼─────────────┼───────────────┼─────────────────────────┤                        │
│ │ parallel        │ system     │ orchestrate │ orchestrate   │ —                       │                        │
│ └─────────────────┴────────────┴─────────────┴───────────────┴─────────────────────────┘                        │
│                                                                                                                 │
│ Note: parallel sets Engine: orchestrate because the orchestrator handles batch operations itself                │
│ (self-referencing — it uses its team protocol directly rather than delegating to another engine).               │
│                                                                                                                 │
│ Phase 3: Add Delegation Mode to All 8 Engines (8 modified files)                                                │
│                                                                                                                 │
│ Each engine's system prompt (agents/*.md) gets a new "Delegation Mode" section inserted before "How You Work".  │
│ This section explains that the engine may be invoked in two modes:                                              │
│                                                                                                                 │
│ For write engines (modify, citations, api-refs, locals, index, system):                                         │
│ ## Delegation Mode                                                                                              │
│                                                                                                                 │
│ You may be invoked in two modes:                                                                                │
│                                                                                                                 │
│ ### Standalone Mode (default)                                                                                   │
│ If your prompt begins with "Operation:" or contains an instruction file reference                               │
│ without a "Mode:" header, execute the full operation including all pipeline stages.                             │
│ This is your current behavior — nothing changes.                                                                │
│                                                                                                                 │
│ ### Delegated Mode                                                                                              │
│ If your prompt contains "Mode: DELEGATED", you are being invoked by the                                         │
│ orchestration engine as a specialist subagent.                                                                  │
│                                                                                                                 │
│ Rules for delegated mode:                                                                                       │
│ - Execute ONLY the primary operation AND enforcement pipeline stages (1-3:                                      │
│   verbosity, citations, API refs) as applicable per the pipeline trigger matrix                                 │
│ - Do NOT run validation stages (4-5: sanity-check, verify)                                                      │
│ - Do NOT update the changelog                                                                                   │
│ - Do NOT update the index                                                                                       │
│ - Do NOT commit to git or run docs-commit.sh                                                                    │
│ - Return a structured result:                                                                                   │
│   ## Delegation Result                                                                                          │
│   ### Files Modified                                                                                            │
│   - {path}: {description}                                                                                       │
│   ### Enforcement Stages                                                                                        │
│   - Verbosity: {PASS|FAIL|SKIPPED}                                                                              │
│   - Citations: {PASS|FAIL|SKIPPED}                                                                              │
│   - API Refs: {PASS|FAIL|SKIPPED|N/A}                                                                           │
│   ### Issues                                                                                                    │
│   - {any concerns or [NEEDS INVESTIGATION] items}                                                               │
│                                                                                                                 │
│ For read-only engines (validate, verbosity):                                                                    │
│ ## Delegation Mode                                                                                              │
│                                                                                                                 │
│ You may be invoked in two modes:                                                                                │
│                                                                                                                 │
│ ### Standalone Mode (default)                                                                                   │
│ If your prompt begins with "Operation:" or contains an instruction file                                         │
│ reference without a "Mode:" header, execute the full operation as normal.                                       │
│                                                                                                                 │
│ ### Pipeline Validation Mode                                                                                    │
│ If your prompt contains "Mode: PIPELINE-VALIDATION", you are being invoked                                      │
│ by the orchestration engine to validate files modified by another specialist.                                   │
│                                                                                                                 │
│ Rules for pipeline validation mode:                                                                             │
│ - Run sanity-check (stage 4) on all specified target files                                                      │
│ - Run 10-point verification (stage 5) on all specified target files                                             │
│ - Return a structured validation report with the standard format                                                │
│ - If sanity-check confidence is LOW, flag the specific issues clearly                                           │
│   so the orchestrator can request remediation                                                                   │
│                                                                                                                 │
│ No changes to tool lists or module preloads. Delegation mode is purely additive to the system prompt. Existing  │
│ standalone behavior is 100% preserved.                                                                          │
│                                                                                                                 │
│ Phase 4: Hooks and Scripts (1 modified + 2 implemented + 1 new)                                                 │
│                                                                                                                 │
│ 4.1 Modify hooks/hooks.json                                                                                     │
│ - Add SubagentStop entry for "matcher": "orchestrate" → post-orchestrate-check.sh                               │
│                                                                                                                 │
│ 4.2 Create scripts/post-orchestrate-check.sh (new file)                                                         │
│ - Validates orchestrator pipeline completion                                                                    │
│ - Checks for pipeline completion marker in transcript                                                           │
│ - Checks changelog was updated (for write operations)                                                           │
│ - Checks all planned subagents completed                                                                        │
│ - Exits 0 (pass) or 2 (warn)                                                                                    │
│                                                                                                                 │
│ 4.3 Implement scripts/teammate-idle-check.sh (replace stub)                                                     │
│ - Parse teammate transcript from stdin                                                                          │
│ - Check for delegation result structure ("## Delegation Result")                                                │
│ - Check enforcement stage markers                                                                               │
│ - Report warnings for missing markers                                                                           │
│                                                                                                                 │
│ 4.4 Implement scripts/task-completed-check.sh (replace stub)                                                    │
│ - Parse task completion data from stdin                                                                         │
│ - Verify task produced file modifications                                                                       │
│ - Verify no HALLUCINATION markers in results                                                                    │
│ - Report warnings for incomplete tasks                                                                          │
│                                                                                                                 │
│ Phase 5: Configuration (2 modified files)                                                                       │
│                                                                                                                 │
│ 5.1 Modify framework/config/system-config.md                                                                    │
│ - Add new §6 "Orchestration" section:                                                                           │
│                                                                                                                 │
│ ┌────────────────────────────────────────┬───────┬─────────────────────────────────────────────────┐            │
│ │                Variable                │ Value │                   Description                   │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.enabled                  │ true  │ Master switch for multi-agent orchestration     │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.parallel_threshold_files │ 3     │ Fan-out via parallel Agent spawns               │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.team_threshold_files     │ 8     │ Create Team with batched teammates              │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.max_teammates            │ 5     │ Max concurrent teammates                        │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.max_files_per_teammate   │ 5     │ Max files assigned per teammate                 │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.pipeline_delegation      │ true  │ Whether pipeline stages delegate to specialists │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.validation_retry_limit   │ 1     │ Max retries if validation finds issues          │            │
│ ├────────────────────────────────────────┼───────┼─────────────────────────────────────────────────┤            │
│ │ orchestration.single_commit            │ true  │ Aggregate all changes into one git commit       │            │
│ └────────────────────────────────────────┴───────┴─────────────────────────────────────────────────┘            │
│                                                                                                                 │
│ - Consolidate existing chunk_delegation.* and sanity_check.multi_agent_* thresholds into §6                     │
│                                                                                                                 │
│ 5.2 Modify modules/mod-pipeline/SKILL.md                                                                        │
│ - Add "Delegation Protocol" section documenting:                                                                │
│   - Pipeline phase grouping (write → review → finalize)                                                         │
│   - Stage-to-phase mapping                                                                                      │
│   - Teammate pipeline behavior: each teammate runs stages 1-3 but defers stages 4-8                             │
│   - Orchestrator pipeline behavior: runs stages 4-8 after all primary work completes                            │
│   - Completion marker variant for delegated mode: Delegation complete: [verbosity: PASS] [citations: PASS]      │
│ [api-refs: N/A]                                                                                                 │
│                                                                                                                 │
│ Phase 6: Manifest and Plugin Identity (2 modified files)                                                        │
│                                                                                                                 │
│ 6.1 Modify framework/manifest.md                                                                                │
│ - Add orchestrate engine to engine table (now 9 engines)                                                        │
│ - Add mod-orchestration to module table (now 11 modules)                                                        │
│ - Update command routing table (all commands → orchestrate engine)                                              │
│ - Add new instruction files to instruction table                                                                │
│ - Add new hook script to hooks table                                                                            │
│ - Update version to 2.7.0                                                                                       │
│                                                                                                                 │
│ 6.2 Modify .claude-plugin/plugin.json                                                                           │
│ - Bump version from 2.6.2 to 2.7.0                                                                              │
│                                                                                                                 │
│ Phase 7: Specs and Documentation (4 modified files)                                                             │
│                                                                                                                 │
│ 7.1 Modify fp-docs/specs/architecture.md                                                                        │
│ - Add new section: "Multi-Agent Orchestration Architecture"                                                     │
│ - Update engine inventory table (8 → 9 engines, new orchestrate)                                                │
│ - Update §3 Engine-Skill Routing to show orchestrate as universal entry point                                   │
│ - Update §14 /fp-docs:parallel to reflect orchestrator-native batch handling                                    │
│ - Update file layout tree                                                                                       │
│ - Version references                                                                                            │
│                                                                                                                 │
│ 7.2 Modify fp-docs/specs/features-and-capabilities.md                                                           │
│ - Update engine count and add orchestrate to engine table                                                       │
│ - Add multi-agent orchestration as a top-level feature                                                          │
│ - Document pipeline phase delegation                                                                            │
│ - Version references                                                                                            │
│                                                                                                                 │
│ 7.3 Modify fp-docs/specs/usage-and-workflows.md                                                                 │
│ - Update command behavior descriptions (all commands now orchestrated)                                          │
│ - Add batch operation workflow section                                                                          │
│ - Update configuration options                                                                                  │
│ - Version references                                                                                            │
│                                                                                                                 │
│ 7.4 Modify CLAUDE.md (project root)                                                                             │
│ - Update repository layout tree (add orchestrate agent, mod-orchestration module)                               │
│ - Update agent count (8 → 9)                                                                                    │
│ - Update version references (2.6.2 → 2.7.0)                                                                     │
│ - Note about multi-agent orchestration architecture                                                             │
│                                                                                                                 │
│ Phase 8: Version Bump (all version-bearing files)                                                               │
│                                                                                                                 │
│ Per CLAUDE.md version management protocol, update version from 2.6.2 to 2.7.0 in:                               │
│ - plugins/fp-docs/.claude-plugin/plugin.json (source of truth)                                                  │
│ - plugins/fp-docs/framework/manifest.md                                                                         │
│ - CLAUDE.md                                                                                                     │
│ - fp-docs/README.md                                                                                             │
│ - fp-docs/specs/architecture.md                                                                                 │
│ - fp-docs/specs/features-and-capabilities.md                                                                    │
│ - fp-docs/specs/usage-and-workflows.md                                                                          │
│                                                                                                                 │
│ ---                                                                                                             │
│ File Change Summary                                                                                             │
│                                                                                                                 │
│ ┌──────────────┬───────────────────────────────┬───────────────────────────────────┬───────┐                    │
│ │   Category   │            Creates            │             Modifies              │ Total │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Agents       │ 1 (orchestrate.md)            │ 8 (delegation mode)               │ 9     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Skills       │ 0                             │ 19 (all rerouted)                 │ 19    │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Modules      │ 1 (mod-orchestration)         │ 1 (mod-pipeline)                  │ 2     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Instructions │ 1 (orchestrate/delegate.md)   │ 0                                 │ 1     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Scripts      │ 1 (post-orchestrate-check.sh) │ 2 (teammate-idle, task-completed) │ 3     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Hooks        │ 0                             │ 1 (hooks.json)                    │ 1     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Config       │ 0                             │ 1 (system-config.md)              │ 1     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Manifest     │ 0                             │ 1 (manifest.md) + 1 (plugin.json) │ 2     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Specs        │ 0                             │ 3 (all spec files)                │ 3     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ CLAUDE.md    │ 0                             │ 1                                 │ 1     │                    │
│ ├──────────────┼───────────────────────────────┼───────────────────────────────────┼───────┤                    │
│ │ Total        │ 4                             │ 38                                │ 42    │                    │
│ └──────────────┴───────────────────────────────┴───────────────────────────────────┴───────┘                    │
│                                                                                                                 │
│ ---                                                                                                             │
│ Execution Flow Examples                                                                                         │
│                                                                                                                 │
│ /fp-docs:revise "fix the posts helper" (single-file write)                                                      │
│                                                                                                                 │
│ Skill → orchestrate engine                                                                                      │
│   │                                                                                                             │
│   ├─ Parse: Engine=modify, Op=revise, Target=posts helper                                                       │
│   ├─ Scope: 1 file → single specialist strategy                                                                 │
│   │                                                                                                             │
│   ├─ WRITE PHASE: Spawn modify (Mode: DELEGATED)                                                                │
│   │   └─ modify: reads source, writes docs, runs stages 1-3                                                     │
│   │   └─ Returns: {files: ["docs/06-helpers/posts.md"], stages: [verbosity:PASS, citations:PASS,                │
│ api-refs:PASS]}                                                                                                 │
│   │                                                                                                             │
│   ├─ REVIEW PHASE: Spawn validate (Mode: PIPELINE-VALIDATION)                                                   │
│   │   └─ validate: sanity-check + 10-point verify on posts.md                                                   │
│   │   └─ Returns: {sanity: HIGH, verify: PASS}                                                                  │
│   │                                                                                                             │
│   ├─ FINALIZE PHASE (orchestrator directly):                                                                    │
│   │   ├─ Stage 6: Append changelog entry                                                                        │
│   │   ├─ Stage 7: Skip (no structural changes)                                                                  │
│   │   └─ Stage 8: git commit + push via docs-commit.sh                                                          │
│   │                                                                                                             │
│   └─ Report: Unified modification report (3 agents used)                                                        │
│                                                                                                                 │
│ /fp-docs:audit --depth deep docs/06-helpers/ (read-only)                                                        │
│                                                                                                                 │
│ Skill → orchestrate engine                                                                                      │
│   │                                                                                                             │
│   ├─ Parse: Engine=validate, Op=audit, read-only command                                                        │
│   │                                                                                                             │
│   ├─ Spawn validate (Mode: standard — no delegation needed for read-only)                                       │
│   │   └─ validate: runs deep audit, returns report                                                              │
│   │                                                                                                             │
│   └─ Report: Pass through validation report (2 agents used)                                                     │
│                                                                                                                 │
│ /fp-docs:auto-update (multi-file batch, 12 changed files)                                                       │
│                                                                                                                 │
│ Skill → orchestrate engine                                                                                      │
│   │                                                                                                             │
│   ├─ Parse: Engine=modify, Op=auto-update                                                                       │
│   ├─ Scope: 12 files → team strategy (>8 threshold)                                                             │
│   │                                                                                                             │
│   ├─ TeamCreate("fp-docs-auto-update")                                                                          │
│   │   ├─ TaskCreate: batch-1 (files 1-5)                                                                        │
│   │   ├─ TaskCreate: batch-2 (files 6-10)                                                                       │
│   │   └─ TaskCreate: batch-3 (files 11-12)                                                                      │
│   │                                                                                                             │
│   ├─ Spawn 3 modify teammates (Mode: DELEGATED, each gets a batch)                                              │
│   │   ├─ Worker-1: primary op + stages 1-3 on files 1-5                                                         │
│   │   ├─ Worker-2: primary op + stages 1-3 on files 6-10                                                        │
│   │   └─ Worker-3: primary op + stages 1-3 on files 11-12                                                       │
│   │                                                                                                             │
│   ├─ Wait for all workers (TaskList monitoring)                                                                 │
│   │                                                                                                             │
│   ├─ REVIEW PHASE: Spawn validate (all 12 files)                                                                │
│   │                                                                                                             │
│   ├─ FINALIZE: Single changelog entry, single git commit                                                        │
│   │                                                                                                             │
│   └─ Report: Aggregated results (6 agents used)                                                                 │
│                                                                                                                 │
│ ---                                                                                                             │
│ Key Design Decisions                                                                                            │
│                                                                                                                 │
│ 1. Universal orchestrator, not self-orchestration: Every command goes through the orchestrator. This satisfies  │
│ "multi-agent by default" unambiguously.                                                                         │
│ 2. Pipeline grouped into 3 phases, not 8 subagents: The primary engine handles stages 1-3 (enforcement) because │
│  it has write access and fresh context from the operation it just performed. The validate engine handles stages │
│  4-5 as an independent reviewer. The orchestrator handles stages 6-8. This balances multi-agent orchestration   │
│ with sequential dependency safety.                                                                              │
│ 3. Existing engines gain delegation mode via prompt update, not tool changes: No engine's tool list or module   │
│ preload changes. Delegation mode is purely additive prompt content. Standalone mode (for backward compatibility │
│  or direct invocation) is preserved.                                                                            │
│ 4. Git serialization in the orchestrator: Only the orchestrator touches git. Specialists never commit. In batch │
│  mode, one commit covers all changes. This prevents merge conflicts and ensures atomic commits.                 │
│ 5. Read-only command fast path: For audit/verify/test/verbosity-audit, the orchestrator spawns the specialist   │
│ and returns the report. No pipeline, no overhead beyond the routing layer.                                      │
│ 6. allowed-tools removal: 4 skills (audit, verify, sanity-check, verbosity-audit) currently restrict the        │
│ subagent's tools. Since the subagent is now the orchestrator (which needs Agent, TeamCreate, etc.), these       │
│ restrictions are removed. Read-only enforcement is already handled by the specialist engines' disallowedTools   │
│ in their agent definitions.                                                                                     │
│ 7. parallel becomes self-referencing: The /fp-docs:parallel skill sets Engine: orchestrate because the          │
│ orchestrator's team protocol IS the parallel implementation. No separate batch engine needed.                   │
│                                                                                                                 │
│ ---                                                                                                             │
│ Verification Plan                                                                                               │
│                                                                                                                 │
│ Unit-Level Verification                                                                                         │
│                                                                                                                 │
│ - Validate plugin.json is parseable: cd plugins/fp-docs && claude plugin validate .                             │
│ - Validate hooks.json is parseable JSON with correct script paths                                               │
│ - Verify all 19 skill files have valid YAML frontmatter with agent: orchestrate                                 │
│ - Verify no skill files retain allowed-tools: (except test if it doesn't have one)                              │
│ - Verify all 9 agent files (including new orchestrate) have valid YAML frontmatter                              │
│ - Verify all script files in scripts/ are executable (chmod +x)                                                 │
│                                                                                                                 │
│ Integration-Level Verification                                                                                  │
│                                                                                                                 │
│ - Run /fp-docs:setup — should route through orchestrator → system engine → report                               │
│ - Run /fp-docs:verify docs/06-helpers/posts.md — should route through orchestrator → validate engine → report   │
│ (2 agents)                                                                                                      │
│ - Run /fp-docs:revise "update posts helper" — should route through orchestrator → modify → validate → changelog │
│  → commit (3 agents)                                                                                            │
│ - Run /fp-docs:citations generate docs/06-helpers/posts.md — should route through orchestrator → citations →    │
│ validate → changelog → commit                                                                                   │
│                                                                                                                 │
│ Architecture-Level Verification                                                                                 │
│                                                                                                                 │
│ - Confirm SubagentStop hook fires for orchestrate agent with pipeline completion marker                         │
│ - Confirm standalone mode still works: if an engine is invoked directly (without "Mode: DELEGATED"), it runs    │
│ the full pipeline as before                                                                                     │
│ - Verify version is consistent across all 7 files per version management protocol                               │
│ - Verify specs reflect the new architecture accurately
