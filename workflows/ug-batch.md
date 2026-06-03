<purpose>
Run user guide operations in batch across multiple pages. Supports validate, screenshot, and
update operations. Uses Agent Teams for parallel execution when enabled, falls back to
sequential. For write operations (screenshot, update), includes user guide pipeline enforcement
and a single finalize phase. For read operations (validate), aggregates results only.
</purpose>

<required_reading>
DO NOT read reference files yourself. Each step below specifies which files
its specialist agent will read via files_to_read. You are a dispatcher — pass
arguments and results between steps, nothing more.
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
1. **Operation**: Which user guide operation to run: `validate`, `screenshot`, or `update`
2. **Scope**: Which pages to target:
   - `--section <name>`: All pages in a specific section
   - `--all`: All user guide pages
   - Page path: Specific page(s)
3. **Flags**: Operation-specific flags passed through to the sub-operation:
   - For validate: `--depth quick|standard|deep`, `--no-tone-check`
   - For screenshot: `--replace`, `--dry-run`
   - For update: `--refresh-screenshots`, `--no-tone-check`

Determine operation type:
- `validate` -> read operation (no pipeline, no commit)
- `screenshot` -> write operation (pipeline + commit)
- `update` -> write operation (pipeline + commit)
</step>

<step name="enumerate-targets">
## 3. Enumerate Target Pages
```bash
DOCS_ROOT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" paths docs-root)
```

1. Resolve scope to concrete page list:
   - If `--all`: find all `index.md` files under `user-guide/content/`
   - If `--section <name>`: find all `index.md` files under `user-guide/content/{section}/`
   - If page path: validate path exists
2. Count total pages
3. Determine batch distribution based on init config:
   - Split pages into batches of `maxFilesPerTeammate`
   - Cap teammate count at `maxTeammates`
   - If page count below `teamThreshold`: warn user and suggest non-batch execution
</step>

<step name="team-check">
## 4. Agent Teams Availability Check

1. Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled
2. If NOT enabled:
   - Report: "Agent Teams not enabled. Falling back to sequential execution."
   - Execute operations sequentially (one at a time via Agent tool)
   - For each page, spawn the appropriate agent with the sub-operation
   - Skip to step 7 (pipeline) for write ops, or step 8 (report) for read ops
3. If enabled: proceed to team execution
</step>

<step name="team-execute" condition="teams-enabled">
## 5. Team Execution

1. Create team: `TeamCreate("fp-docs-ug-batch-{operation}-{timestamp}")`
2. Create tasks via `TaskCreate` -- one per page batch
3. Spawn teammates based on operation type:

   **For validate (read):**
   Each teammate spawns fp-docs-ug-validator for its page batch:
   ```
   Agent(
     prompt="Execute ug-validate on assigned pages.
       Pages: {batch}
       Depth: {depth}
       Flags: {flags}
       <files_to_read>
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
       - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
       </files_to_read>
       Run all validation checks. Return per-page PASS/WARN/FAIL.
       Read-only -- do NOT modify any files.",
     agent="fp-docs-ug-validator"
   )
   ```

   **For screenshot (write):**
   Each teammate spawns fp-docs-ug-writer for its page batch:
   ```
   Agent(
     prompt="Execute ug-screenshot on assigned pages.
       Pages: {batch}
       Flags: {--replace, --dry-run}
       <files_to_read>
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
       - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
       </files_to_read>
       PRIMARY OPERATION ONLY. Capture screenshots, update frontmatter.
       Do NOT run pipeline stages 3-5.",
     agent="fp-docs-ug-writer"
   )
   ```

   **For update (write):**
   Each teammate spawns fp-docs-ug-writer for its page batch:
   ```
   Agent(
     prompt="Execute ug-update on assigned pages.
       Pages: {batch}
       Flags: {--refresh-screenshots, --no-tone-check}
       <files_to_read>
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
       - ${CLAUDE_PLUGIN_ROOT}/references/ug-ui-verification.md
       - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
       </files_to_read>
       PRIMARY OPERATION ONLY. Update affected sections, refresh screenshots if flagged.
       Do NOT run pipeline stages 3-5. Do NOT commit.",
     agent="fp-docs-ug-writer"
   )
   ```

4. Monitor via `TaskList` until all teammates complete
5. Collect results from all teammates:
   - Extract file lists and per-page summaries
   - Merge file lists for pipeline enforcement (write ops only)
</step>

<step name="sequential-fallback" condition="teams-disabled">
## 6. Sequential Fallback
Only if Agent Teams not available (step 4 detected disabled).

For each page in target list, spawn the appropriate agent sequentially:
- validate: fp-docs-ug-validator (same prompt as step 5)
- screenshot: fp-docs-ug-writer (same prompt as step 5)
- update: fp-docs-ug-writer (same prompt as step 5)

Collect results after each completes.
</step>

<step name="pipeline" condition="write-operation">
## 7. Pipeline Enforcement (Write Operations Only)
Skip for validate (read operation).
Skip if --dry-run (screenshot).

```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-ug-validator --raw)
```
Spawn ONE validator agent for ALL modified pages:
```
Agent(
  prompt="Execute user guide pipeline stages 3-4 on batch-modified pages.
    Target files: {all files from team execution -- merged across teammates}
    Flags: {--no-tone-check if set}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/ug-standards.md
    </files_to_read>

    Stage 3 -- Jargon & Tone Check (skip if --no-tone-check):
    Scan all modified pages for banned patterns.

    Stage 4 -- Completeness Check:
    Verify required sections and frontmatter on all modified pages.

    Return per-page and per-stage PASS/WARN/FAIL.",
  agent="fp-docs-ug-validator",
  model="${VALIDATOR_MODEL}"
)
```

### Finalize (Stage 5)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation ug-batch --files {files} --changelog-summary "Batch {operation}: {page-count} pages"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   ug-commit stage: update changelog, commit all changes in single commit
# action == "complete" -> done, extract completion marker
# action == "blocked" -> halt
```
</step>

<step name="report">
## 8. Batch Report

Generate report with:
- Operation: {validate|screenshot|update}
- Execution mode: {Agent Teams | Sequential}
- Total pages processed: {count}
- Per-page results:
  - For validate: PASS/WARN/FAIL per page with issue counts
  - For screenshot: captured/skipped/failed per page
  - For update: sections updated per page
- Pipeline results (write ops only): per-stage PASS/WARN/FAIL
- Git commit hash (write ops only, unless --dry-run)
- Failed pages with error details (if any)
</step>

</process>

<success_criteria>
- [ ] Operation and scope correctly parsed from arguments
- [ ] Target pages enumerated and batched within configured limits
- [ ] Agent Teams used when available (sequential fallback reported otherwise)
- [ ] All pages processed by appropriate agent (validator for read, writer for write)
- [ ] For write operations: pipeline stages 3-4 passed via single validator
- [ ] For write operations: single finalize phase (changelog + commit)
- [ ] Batch report generated with per-page results
- [ ] No pipeline or commit for read operations (validate)
- [ ] No pipeline or commit for --dry-run (screenshot)
</success_criteria>
