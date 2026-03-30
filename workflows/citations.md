<purpose>
Manage code citations for documentation files. Handles four subcommands:
generate (create new citations), update (refresh stale citations),
verify (check citation accuracy without modifying), audit (deep semantic accuracy check).
Write subcommands (generate, update) trigger the full pipeline.
Read subcommands (verify, audit) produce reports only.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op citations "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation context, paths, feature flags, pipeline config.

Parse the first word of `$ARGUMENTS` as the subcommand:
- `generate` — Create new citation blocks for documentable elements
- `update` — Refresh existing citations against current source
- `verify` — Check citation format and symbol existence (read-only)
- `audit` — Deep semantic accuracy check (read-only)

If no subcommand provided, error: "Usage: /fp-docs:citations <generate|update|verify|audit> [target]"

Route to the appropriate procedure below.
</step>

<step name="subcommand-generate">
## 2a. Generate Subcommand (Write)

1. Parse scope from remaining args: doc file path, `--section NN`, or `--all`.
2. Read the target documentation file. Identify every documentable element (functions, hooks, meta fields, shortcodes, REST routes, CPT/taxonomy registrations).
3. Find corresponding source files using the project source-to-doc mapping.
4. Read source files. For each documentable element, locate the matching code.
5. Determine citation tier per `references/citation-rules.md`:
   - <=15 lines: Full tier (complete code excerpt)
   - 16-100 lines: Signature tier (signature + summary)
   - >100 lines: Reference tier (marker only)
6. Generate citation blocks per the citation rules format.
7. Insert citations at correct positions: after function heading + description, after/below tables, after hook sections.
8. For unmatched elements: add `[NEEDS INVESTIGATION]` -- do NOT generate fake citations.
9. Verify format of all inserted citations.

After generation, proceed to the pipeline (step 3).
</step>

<step name="subcommand-update">
## 2b. Update Subcommand (Write)

1. Parse scope from remaining args.
2. Read the documentation file. Parse all existing `> **Citation**` blocks. Extract file path, symbol name, line range, excerpt.
3. Read current source files for each unique cited file path.
4. Compare each citation against current source using staleness detection from `references/citation-algorithm.md`:
   - Symbol lookup -> if not found: Broken
   - Line range check -> if different: Stale
   - Excerpt check -> if different: Drifted, if same: Fresh
5. Update non-Fresh citations:
   - Stale: update line range only
   - Drifted: update line range AND regenerate excerpt
   - Broken: add `[NEEDS INVESTIGATION]` marker
6. Scan for missing citations (documentable elements without citation blocks). Generate new ones.

After update, proceed to the pipeline (step 3).
</step>

<step name="subcommand-verify">
## 2c. Verify Subcommand (Read-Only)

1. Parse scope from remaining args.
2. Read the documentation file. Parse all `> **Citation**` blocks.
3. For each citation:
   a. Verify marker format matches: `> **Citation** · \`{file}\` · \`{symbol}\` · L{start}–{end}`
   b. Verify cited file path exists on disk (relative to theme root)
   c. Verify cited symbol exists in the cited file
   d. Classify: FORMAT (malformed), MISSING (should have citation), BROKEN (symbol not found), FRESH (all good)
4. Generate report with counts per classification.

**No pipeline.** Output the verification report and stop.
</step>

<step name="subcommand-audit">
## 2d. Audit Subcommand (Read-Only)

1. Parse scope from remaining args.
2. Read the documentation file and all its citations.
3. For each citation, perform deep semantic accuracy check:
   a. Read the cited source location
   b. Compare the citation excerpt against current source (verbatim comparison)
   c. Compare the prose adjacent to the citation against the cited code
   d. Verify the documented behavior matches what the code actually does
4. Classify each citation:
   - ACCURATE: excerpt matches, prose matches behavior
   - STALE: excerpt outdated but prose still correct
   - INACCURATE: prose describes behavior differently from code
   - BROKEN: cited symbol no longer exists
5. Check citation coverage: identify documentable elements that lack citations.
6. Generate deep audit report.

**No pipeline.** Output the audit report and stop.
</step>

<step name="pipeline" condition="write-subcommands-only">
## 3. Pipeline Enforcement (generate/update only)

```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```

### Review Phase (Stages 4-5)
Spawn validator agent for sanity-check and 10-point verification.

### Finalize Phase (Stages 6-8)
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 6  # changelog
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 7  # index
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" pipeline run-stage 8  # docs commit
```
</step>

</process>

<success_criteria>
- [ ] Subcommand correctly identified and executed
- [ ] Write operations: all claims verified against source code
- [ ] Write operations: pipeline stages completed (4-8)
- [ ] Read operations: comprehensive report generated
- [ ] No fabricated citations -- unmatched elements tagged [NEEDS INVESTIGATION]
</success_criteria>
