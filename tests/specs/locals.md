---
command: locals
engine: locals
operation: (subcommand)
instruction: framework/instructions/locals/{subcommand}.md
agent: orchestrate
context: fork
type: varies
pipeline_stages: varies
subcommands: annotate, contracts, cross-ref, validate, shapes, coverage
flags: none
---

# /fp-docs:locals - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:locals "annotate|contracts|cross-ref|validate|shapes|coverage [scope]"`
2. Skill SKILL.md parses first word as subcommand, passes to orchestrate engine
3. Orchestrate classifies based on subcommand:
   - `annotate` / `contracts` / `shapes`: write operation with pipeline stages 1, 2, 4-8
   - `cross-ref` / `validate` / `coverage`: read operation with no pipeline stages

### Write subcommands (annotate, contracts, shapes)

4. Orchestrate delegates to locals engine with Write Phase (stages 1-2 + operation)
5. Orchestrate delegates Review Phase (stages 4-5) to validate engine
6. Orchestrate handles Finalize Phase (stages 6-8) itself

### Read subcommands (cross-ref, validate, coverage)

4. Orchestrate delegates to locals engine (2-agent fast path)
5. No pipeline stages triggered

## Pipeline Stages

- Write subcommands (annotate, contracts, shapes): stages 1, 2, 4, 5, 6, 7, 8
- Read subcommands (cross-ref, validate, coverage): none

## Expected Markers

### Write subcommands (annotate, contracts, shapes)
- Pipeline completion: `Pipeline complete: [verbosity: ...] [citations: ...] ...`
- Changelog: `changelog updated` or `updated changelog`
- Delegation: `delegation result` or `agents used`

### Read subcommands (cross-ref, validate, coverage)
- No `Pipeline complete:` marker
- No `changelog updated` marker

## Files Typically Touched

### Write subcommands
- Target documentation file(s) with locals contract sections
- docs/changelog.md (stage 6)
- Ephemeral: functions.php (locals-cli-setup and teardown for WP-CLI extraction)

### Read subcommands
- No files modified (read-only)

## Error Paths

- Invalid subcommand: engine reports valid options (annotate, contracts, cross-ref, validate, shapes, coverage)
- ddev not running: WP-CLI extraction fails, engine falls back to manual analysis
- Template file not found: engine reports missing component
- Ephemeral CLI artifact not cleaned: SubagentStop hook handles cleanup

## Edge Cases

- Locals annotate uses ephemeral WP-CLI `fp-locals` tool for PHP token-based extraction
- Locals contracts on a template with no $locals usage: engine reports empty contract
- Locals coverage across all component docs: aggregated coverage report
- Locals when ddev is not running: falls back to regex-based extraction (less accurate)
