<purpose>
Run documentation operations in parallel across multiple files using Agent Teams.
Parses operation, scope, and flags from arguments, then uses the team protocol
to distribute work across teammates. Opt-in feature -- falls back to sequential
if Agent Teams are disabled.
Batch operation -- primary work distributed across teammates, with dedicated enforcement
agents and single finalize phase.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init parallel "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: batch config (maxTeammates, maxFilesPerTeammate, teamThreshold), target list, operation details, feature_flags.
</step>

<step name="parse">
## 2. Parse Arguments

Extract from `$ARGUMENTS`:
1. **Operation**: Which docs operation to run (revise, audit, citations generate, etc.)
2. **Scope**: Which files/sections to target (directory path, file list, "all")
3. **Flags**: Any operation-specific flags (--no-sanity-check, --no-verbosity, etc.)
4. **Batch mode**: `--batch-mode team` (default for parallel), `--batch-mode subagent`, `--batch-mode sequential`
</step>

<step name="scope-analysis">
## 3. Scope Analysis

1. Resolve the target scope to a concrete file list
2. Count total files to process
3. Determine batch distribution based on init config:
   - Split files into batches of `maxFilesPerTeammate` (from init config)
   - Cap teammate count at `maxTeammates` (from init config)
   - If file count below `teamThreshold`: warn user and suggest non-parallel execution
</step>

<step name="team-check">
## 4. Agent Teams Availability Check

1. Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled
2. If NOT enabled:
   - Report: "Agent Teams not enabled. Falling back to sequential execution."
   - Execute operations sequentially (one at a time via Agent tool)
   - Skip to step 9 (report)
3. If enabled: proceed to team creation
</step>

<step name="team-execute" condition="teams-enabled">
## 5. Team Execution (Primary Operation Only)

1. Create team: `TeamCreate("fp-docs-{operation}-{timestamp}")`
2. Create tasks via `TaskCreate` -- one per file batch
3. Spawn teammates -- each processes ONLY its assigned file batch:
   - Each teammate runs the PRIMARY OPERATION ONLY on its files
   - Teammates do NOT run enforcement stages (verbosity, citations, API refs)
   - Teammates do NOT run validation (stages 4-5), changelog, index, or git commit
   - Teammates do NOT spawn sub-subagents
4. Monitor via `TaskList` until all teammates complete
5. Collect delegation results from all teammates:
   - Extract file lists, summaries (context offloading)
   - Discard detailed descriptions
   - Merge file lists for enforcement agents
</step>

<step name="enforce-verbosity">
## 6. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity-enforcer --raw)
```
Spawn ONE dedicated verbosity agent for ALL files from team execution:
```
Agent(
  prompt="Enforce verbosity on files modified by parallel {operation} operation.
    Target files: {all files from team execution -- merged across teammates}

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

    Return a Verbosity Enforcement Result with per-file status (PASS/FIXED/FAIL).",
  agent="fp-docs-verbosity-enforcer",
  model="${VERBOSITY_MODEL}"
)
```
</step>

<step name="enforce-citations">
## 7. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `--no-citations` flag is set or `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn ONE dedicated citations agent for ALL files:
```
Agent(
  prompt="Enforce citations on files modified by parallel {operation} operation.
    Target files: {all files from team execution -- merged across teammates}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/citation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    </files_to_read>

    For each target file:
    1. Parse existing citation blocks
    2. Check staleness against current source
    3. Update stale/drifted citations with current source
    4. Generate missing citations for undocumented elements
    5. Verify citation format compliance

    Return a Citation Enforcement Result with per-file status.",
  agent="fp-docs-citations",
  model="${CITATIONS_MODEL}"
)
```
</step>

<step name="enforce-api-refs">
## 8. API Reference Enforcement (Stage 3 -- Dedicated)
Skip if `--no-api-ref` flag is set or `api_ref.enabled` is false.
Also skip if no target files require API Reference sections (per doc type).

```bash
APIREFS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-api-refs --raw)
```
Spawn dedicated API refs agent:
```
Agent(
  prompt="Enforce API references on files modified by parallel {operation} operation.
    Target files: {files from team execution that require API Reference}

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

    Return an API Reference Enforcement Result with per-file status.",
  agent="fp-docs-api-refs",
  model="${APIREFS_MODEL}"
)
```
</step>

<step name="finalize">
## 9. Single Finalize Phase

After all enforcement agents complete:

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator agent for ALL modified files (combined from all teammates).

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation parallel --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update (one combined entry)
#   Stage 7: Index update (conditional)
#   Stage 8: Docs commit and push (one commit for all)
# action == "complete" -> done, extract completion marker
# action == "blocked" -> HALLUCINATION detected, halt
```
</step>

<step name="report">
## 10. Batch Report

Generate report with:
- Total files processed across all teammates
- Per-teammate status (files modified, primary operation summary)
- Enforcement results (verbosity, citations, API refs -- per-file status)
- Validation results (from single validator pass)
- Git commit hash (if committed)
- Any failed teammates with error details
</step>

</process>

<success_criteria>
- [ ] Operation and scope correctly parsed from arguments
- [ ] File batches distributed within configured limits
- [ ] Agent Teams used (or sequential fallback reported)
- [ ] All teammates completed primary operations (step 5)
- [ ] Verbosity enforcement completed by dedicated agent (step 6)
- [ ] Citation enforcement completed by dedicated agent (step 7)
- [ ] API reference enforcement completed by dedicated agent (step 8)
- [ ] Single validation pass over all modified files
- [ ] Single finalize phase (changelog + index + commit)
- [ ] Batch report generated with per-teammate status
</success_criteria>
