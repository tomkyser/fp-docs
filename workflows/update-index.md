<purpose>
Update PROJECT-INDEX.md and source-map.json to reflect current codebase state.
Supports two modes: incremental update (default) and full regeneration.
Write operation -- delegates to specialized agents for primary operation, dedicated
enforcement agents, review, and finalization.
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
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init admin-op update-index "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation, agent, target_files, pipeline_config, feature_flags.

Parse mode from `$ARGUMENTS`: `update` (default) or `full`.

Check for flags:
- `--no-sanity-check`: Skip sanity-check in review phase
- `--no-verbosity`: Skip dedicated verbosity enforcement
- `--no-citations`: Skip dedicated citation enforcement
</step>

<step name="execute-primary">
## 2. Write Phase (Primary Operation Only)
```bash
INDEX_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-index --raw)
```
Spawn index agent:
```
Agent(
  prompt="Execute update-index operation -- PRIMARY OPERATION ONLY.
    Mode: {update or full}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    For incremental update (default):
    1. Read existing PROJECT-INDEX.md in the docs root
    2. Check changes since last update via git log
    3. For each affected section: re-scan source directory, update entries
    4. Update file statistics and Generated date
    5. Write updated content
    6. Reconcile source-map: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map generate

    For full regeneration:
    1. Scan entire theme directory: git ls-tree -r --name-only HEAD
    2. Regenerate all sections from scratch
    3. Preserve existing Security Notes and Performance Notes
    4. Record branch name in header
    5. Write regenerated content
    6. Regenerate source-map: node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs source-map generate

    Verify dual-artifact consistency:
    - PROJECT-INDEX.md reflects current git-tracked file tree
    - source-map.json has entries for all documented source directories
    - Generated date updated

    IMPORTANT: Do NOT run pipeline enforcement stages (verbosity, citations).
    Those are handled by dedicated agents in subsequent steps.
    Do NOT run stages 4-8.
    Return a Primary Operation Result listing files modified and a brief summary.",
  agent="fp-docs-index",
  model="${INDEX_MODEL}"
)
```
Extract: files modified, summary.
</step>

<step name="enforce-verbosity">
## 3. Verbosity Enforcement (Stage 1 -- Dedicated)
Skip if `--no-verbosity` flag is set or `verbosity.enabled` is false.

```bash
VERBOSITY_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-verbosity-enforcer --raw)
```
Spawn dedicated verbosity enforcement agent:
```
Agent(
  prompt="Enforce verbosity on files modified by update-index operation.
    Target files: {files from write phase}

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
## 4. Citation Enforcement (Stage 2 -- Dedicated)
Skip if `citations.enabled` is false.

```bash
CITATIONS_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-citations --raw)
```
Spawn dedicated citations agent:
```
Agent(
  prompt="Enforce citations on files modified by update-index operation.
    Target files: {files from write phase}

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

<step name="execute-review-phase">
## 5. Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
Spawn validator agent:
```
Agent(
  prompt="Validate files modified by the update-index operation.
    Target files: {files from write phase}

    <files_to_read>
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-rules.md
    - ${CLAUDE_PLUGIN_ROOT}/references/validation-algorithm.md
    - ${CLAUDE_PLUGIN_ROOT}/references/doc-standards.md
    - ${CLAUDE_PLUGIN_ROOT}/references/fp-project.md
    </files_to_read>

    Run sanity-check (stage 4) on all target files.
    Run 10-point verification (stage 5) on all target files.
    Return a Pipeline Validation Report.",
  agent="fp-docs-validator",
  model="${VALIDATOR_MODEL}"
)
```
If sanity-check confidence is LOW: retry once. If still LOW, report without committing.
</step>

<step name="execute-finalize-phase">
## 6. Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline init --operation update-index --files {files} --changelog-summary "{summary}"
```
Loop:
```bash
NEXT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline next)
# action == "execute" -> fp-tools pipeline run-stage {id}
#   Stage 6: Changelog update
#   Stage 7: Index update (self-referential -- verify no infinite loop)
#   Stage 8: Docs commit and push
# action == "complete" -> done, extract completion marker
# action == "blocked" -> HALLUCINATION detected, halt
```

Include completion marker verbatim in final report.
</step>

</process>

<success_criteria>
- [ ] Mode correctly identified (update or full)
- [ ] PROJECT-INDEX.md reflects current file tree
- [ ] source-map.json consistent with documented directories
- [ ] Generated date updated
- [ ] Primary operation completed by index agent (step 2)
- [ ] Verbosity enforcement completed by dedicated agent (step 3)
- [ ] Citation enforcement completed by dedicated agent (step 4)
- [ ] Pipeline stages 4-5 completed by validator agent (step 5)
- [ ] Pipeline stages 6-8 completed via CJS pipeline loop (step 6)
- [ ] Changelog entry added
- [ ] Docs committed and pushed
</success_criteria>
