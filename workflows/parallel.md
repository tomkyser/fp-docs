<purpose>
Run documentation operations in parallel across multiple files using Agent Teams.
Parses operation, scope, and flags from arguments, then uses the team protocol
to distribute work across teammates. Opt-in feature -- falls back to sequential
if Agent Teams are disabled.
Batch operation -- triggers pipeline per-teammate, with single finalize phase.
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

Parse JSON for: batch config (maxTeammates, maxFilesPerTeammate, teamThreshold), target list, operation details.
</step>

<step name="parse">
## 2. Parse Arguments

Extract from `$ARGUMENTS`:
1. **Operation**: Which docs operation to run (revise, audit, citations generate, etc.)
2. **Scope**: Which files/sections to target (directory path, file list, "all")
3. **Flags**: Any operation-specific flags (--no-sanity-check, --force, etc.)
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
   - Skip to step 7 (report)
3. If enabled: proceed to team creation
</step>

<step name="team-execute" condition="teams-enabled">
## 5. Team Execution

1. Create team: `TeamCreate("fp-docs-{operation}-{timestamp}")`
2. Create tasks via `TaskCreate` -- one per file batch
3. Spawn teammates -- each runs as the specialist engine in delegated mode:
   - Each teammate reads the operation's instruction file directly
   - Each teammate processes ONLY its assigned file batch
   - Each teammate runs enforcement stages 1-3 (verbosity, citations, API refs) on its files
   - Teammates do NOT spawn sub-subagents
   - Teammates do NOT run validation (stages 4-5), changelog, index, or git commit
4. Monitor via `TaskList` until all teammates complete
5. Collect delegation results from all teammates:
   - Extract file lists, stage statuses, issue counts (context offloading)
   - Discard detailed descriptions
</step>

<step name="finalize">
## 6. Single Finalize Phase

After all teammates complete:

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn ONE validator agent for ALL modified files (combined from all teammates).

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 6  # changelog (one combined entry)
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 7  # index (conditional)
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 8  # docs commit (one commit for all)
```
</step>

<step name="report">
## 7. Batch Report

Generate report with:
- Total files processed across all teammates
- Per-teammate status (files modified, stages passed/failed)
- Aggregated enforcement stage pass rates
- Validation results (from single validator pass)
- Git commit hash (if committed)
- Any failed teammates with error details
</step>

</process>

<success_criteria>
- [ ] Operation and scope correctly parsed from arguments
- [ ] File batches distributed within configured limits
- [ ] Agent Teams used (or sequential fallback reported)
- [ ] All teammates completed their assigned batches
- [ ] Single validation pass over all modified files
- [ ] Single finalize phase (changelog + index + commit)
- [ ] Batch report generated with per-teammate status
</success_criteria>
