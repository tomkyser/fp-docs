---
command: verbosity-audit
engine: verbosity
operation: audit
instruction: framework/instructions/verbosity/audit.md
agent: orchestrate
context: fork
type: read
pipeline_stages: none
subcommands: none
flags: --depth quick|standard|deep
---

# /fp-docs:verbosity-audit - Behavioral Specification

## Routing Path

1. User invokes `/fp-docs:verbosity-audit "--depth quick|standard|deep [scope]"`
2. Skill SKILL.md passes `$ARGUMENTS` to orchestrate engine
3. Orchestrate classifies as read operation (engine: verbosity)
4. Orchestrate delegates to verbosity engine (2-agent fast path)
5. No pipeline stages triggered -- read operations skip full pipeline

## Pipeline Stages

None. Read operations use the fast path without triggering the 8-stage pipeline.

## Expected Markers

- No `Pipeline complete:` marker (read operations skip full pipeline)
- No `changelog updated` marker
- Agents used marker: `2 agents used` (orchestrator + verbosity)

## Files Typically Touched

- No files modified (read-only operation)
- Reads documentation files for verbosity gaps: missing items, summarization language, unexpanded enumerables

## Error Paths

- Scope resolves to no files: engine reports empty scope
- Invalid depth value: engine reports error and suggests valid options

## Edge Cases

- Verbosity audit with `--depth deep`: exhaustive per-section analysis
- Verbosity audit with `--depth quick`: high-level summarization scan
- Verbosity audit finds banned phrases: engine reports each occurrence with location
- Verbosity engine has `disallowedTools: [Write, Edit]` -- cannot modify files
