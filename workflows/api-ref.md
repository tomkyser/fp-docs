<purpose>
Manage API Reference sections in documentation files. Handles two subcommands:
generate (create/update API reference tables from source code) and
audit (compare existing tables against source for accuracy).
Generate is a write operation with full pipeline; audit is read-only.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op api-ref "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation context, paths, feature flags, pipeline config.

Parse the first word of `$ARGUMENTS` as the subcommand:
- `generate` — Create or update API Reference tables from source code
- `audit` — Compare existing tables against source (read-only)

If no subcommand provided, error: "Usage: /fp-docs:api-ref <generate|audit> [target]"
</step>

<step name="subcommand-generate">
## 2a. Generate Subcommand (Write)

1. Parse scope: doc file path, `--layer name`, or `--all`. If doc type not listed as requiring API Reference per config scope table: report and skip.
2. Read the documentation file. Identify source file via `## Source File` header.
3. Build scope manifest: count all public functions/methods in source file.
4. Read source file. Extract every public function/method:
   - PHP namespaced helpers: every function in the namespace
   - PHP classes: every public method (protected only for abstract classes)
   - JavaScript: every exported function + key event handlers
5. For each function, extract: name, parameters, return type, description (one-liner, present tense), provenance (PHPDoc if docblock exists, Verified if authored from source reading).
6. Generate the API Reference section per `references/api-ref-rules.md`:
   ```
   ## API Reference
   > **Ref Source** · Per-row provenance in `Src` column
   | Function | Params | Return | Description | Src |
   ```
   Rows ordered by source file line number.
7. Insert before `## Related Docs`, or update existing section.
8. Verify row count matches scope manifest function count.

After generation, proceed to pipeline enforcement (step 3).
</step>

<step name="subcommand-audit">
## 2b. Audit Subcommand (Read-Only)

1. Read the documentation file. Find the `## API Reference` section.
2. If no API Reference section and doc type requires one: report MISSING.
3. Parse the API reference table rows.
4. Read the corresponding source file. Extract all public functions/methods.
5. Compare:
   - Functions in source not in table: MISSING
   - Functions in table not in source: ORPHAN (code removed)
   - Functions with different signatures: STALE
   - Functions with PHPDoc provenance: verify PHPDoc matches actual behavior
6. Check Ref Source legend presence and Src column values.
7. Generate audit report.

**No pipeline.** Output the audit report and stop.
</step>

<step name="pipeline" condition="generate-only">
## 3. Pipeline Enforcement (generate only)

### Write Phase (Stages 1-2)
Run verbosity enforcement against scope manifest, then citation generation for API ref entries.

### Review Phase (Stages 4-5)
```bash
VALIDATOR_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-validator --raw)
```
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
- [ ] Generate: API Reference table matches source function count
- [ ] Generate: all provenance values are valid (PHPDoc, Verified, Authored)
- [ ] Generate: pipeline stages completed
- [ ] Audit: comprehensive report with MISSING/ORPHAN/STALE classifications
</success_criteria>
