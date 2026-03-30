<purpose>
Manage $locals contract documentation for PHP template components. Handles six subcommands:
annotate (add @locals PHPDoc blocks to PHP files), contracts (generate Locals Contracts sections in docs),
coverage (report annotation and documentation coverage), cross-ref (validate caller-callee relationships),
shapes (manage shared $locals shapes), validate (verify contracts against actual code).
Write subcommands (annotate, contracts, shapes) trigger the pipeline.
Read subcommands (coverage, cross-ref, validate) produce reports only.
All subcommands support ephemeral WP-CLI tool for ground-truth extraction with manual fallback.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="initialize" priority="first">
## 1. Initialize

```bash
INIT=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" init write-op locals "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: operation context, paths, feature flags, pipeline config.

Parse the first word of `$ARGUMENTS` as the subcommand:
- `annotate` — Add/update @locals PHPDoc blocks in component PHP files (write)
- `contracts` — Generate/update Locals Contracts sections in component docs (write)
- `coverage` — Report annotation and documentation coverage (read-only)
- `cross-ref` — Validate caller-callee relationships (read-only)
- `shapes` — Manage shared $locals shapes in _locals-shapes.md (write)
- `validate` — Verify documented contracts against actual code (read-only)

If no subcommand provided, error: "Usage: /fp-docs:locals <annotate|contracts|coverage|cross-ref|shapes|validate> [target]"
</step>

<step name="cli-setup">
## 2. CLI Tool Setup (all subcommands)

Attempt to install the ephemeral WP-CLI tool for ground-truth extraction:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli setup
```

If setup fails (ddev not running, path error): fall back to manual extraction.
Report extraction method to user.
</step>

<step name="subcommand-annotate">
## 3a. Annotate Subcommand (Write)

**CLI path:** Run `ddev wp fp-locals extract "<file_or_dir>" --format=json --recursive` for ground-truth data.

**Manual fallback:** Read PHP files with Read tool, scan for `$locals['key']` patterns. Classify Required (bare access) vs Optional (null coalesce/isset).

For each component PHP file:
1. Check if `@locals { ... }` PHPDoc block exists
2. If no block: generate new one from extraction data per `references/locals-rules.md` format
3. If block exists: merge -- preserve human descriptions, update keys/types/required from extraction data
4. Insert annotation in file-level PHPDoc comment
5. Run CLI validation: `ddev wp fp-locals validate "<file_or_dir>" --recursive`

**MANDATORY teardown:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli teardown`

After annotation, proceed to pipeline (step 4).
</step>

<step name="subcommand-contracts">
## 3b. Contracts Subcommand (Write)

**CLI path:** Run `ddev wp fp-locals extract "components/<dir>/" --recursive --format=json` for ground-truth data.

For each component doc in scope:
1. Generate/update `## Locals Contracts` section using `references/locals-rules.md` grammar
2. Create per-file subsection with table: Key | Type | Req? | Default | Description
3. Add shape references where keys match shared shapes
4. Generate/update `## Data Flow` section using `ddev wp fp-locals cross-ref` for caller data
5. Replace existing sections entirely with regenerated versions

**MANDATORY teardown:** `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" locals-cli teardown`

After contracts generation, proceed to pipeline (step 4).
</step>

<step name="subcommand-coverage">
## 3c. Coverage Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals coverage --format=json` for ground-truth coverage data.

Cross-check against documentation:
1. Per-directory breakdown from CLI data
2. Inline annotation coverage (@locals blocks in PHP files)
3. Documentation coverage (contract entries in component docs)
4. Combined coverage (both annotation AND doc entry)
5. Highlight directories with 0% coverage

**MANDATORY teardown.** No pipeline. Output coverage report and stop.
</step>

<step name="subcommand-cross-ref">
## 3d. Cross-Reference Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals cross-ref "components/<dir>/" --recursive` for caller-callee data.

Cross-validate:
1. Every caller listed in Data Flow must appear in CLI output
2. Every caller in CLI output should be in Data Flow
3. Keys passed by each caller must match documented keys
4. Required keys not passed by any caller -> flag as data flow gap
5. Shape references must resolve to `_locals-shapes.md`

**MANDATORY teardown.** No pipeline. Output cross-reference report and stop.
</step>

<step name="subcommand-shapes">
## 3e. Shapes Subcommand (Write)

1. Read `docs/05-components/_locals-shapes.md`
2. If `--all`: analyze all component contracts to discover shared key patterns
3. For each identified shape: verify definition matches actual keys, update if changed
4. Generate/update shape entries

**MANDATORY teardown.** After shapes update, proceed to pipeline (step 4).
</step>

<step name="subcommand-validate">
## 3f. Validate Subcommand (Read-Only)

**CLI path:** Run `ddev wp fp-locals validate "<file_or_dir>" --recursive` then `ddev wp fp-locals extract "<file_or_dir>" --recursive --format=json`.

For each component doc in scope:
1. Compare each documented key against CLI-extracted ground truth
2. Verify key exists, type matches, Required/Optional matches, default matches
3. Check for undocumented keys
4. Cross-reference: shape references resolve, all contract keys exist in extraction

**MANDATORY teardown.** No pipeline. Output validation report and stop.
</step>

<step name="pipeline" condition="write-subcommands-only">
## 4. Pipeline Enforcement (annotate/contracts/shapes only)

### Write Phase (Stages 1-2)
Run verbosity enforcement and citation updates.

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
- [ ] CLI tool teardown completed (even on failure)
- [ ] Write operations: all contracts verified against source
- [ ] Write operations: pipeline stages completed
- [ ] Read operations: comprehensive report generated
- [ ] Extraction method reported (CLI or manual fallback)
</success_criteria>
