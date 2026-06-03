<purpose>
Display a formatted command reference for all fp-docs commands. Groups commands by category
(write, read, admin, meta, batch) and shows descriptions, arguments, and flags for each.
No agent spawning -- this workflow executes inline.
</purpose>

<required_reading>
Read all files referenced by the invoking command's execution_context.
</required_reading>

<process>

<step name="generate-help" priority="first">
## 1. Generate Command Reference

Fetch the grouped command listing:
```bash
node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" help grouped
```

If the CLI command is available, format its output. Otherwise, generate from the known command set below.
</step>

<step name="display">
## 2. Display Help

Format and display the command reference:

```
fp-docs -- Documentation Management System
============================================

WRITE OPERATIONS (full pipeline: research -> plan -> write -> review -> finalize)
  /fp-docs:revise <description>     Fix specific documentation you know is wrong or outdated
  /fp-docs:add <description>        Create new documentation for undocumented code
  /fp-docs:auto-update [scope]      Detect and update docs affected by recent code changes
  /fp-docs:auto-revise [flags]      Process the needs-revision tracker
  /fp-docs:deprecate <description>  Mark documentation as deprecated or removed

READ OPERATIONS (research -> plan -> specialist, no pipeline)
  /fp-docs:audit [--depth] [scope]       Compare docs to source code, report discrepancies
  /fp-docs:verify [scope]                Run 10-point verification checklist
  /fp-docs:sanity-check <scope>          Check every factual claim against source code
  /fp-docs:test <scope>                  Test docs against live local environment
  /fp-docs:verbosity-audit [--depth]     Scan for banned phrases and coverage gaps

ENRICHMENT OPERATIONS (write with domain-specific agents)
  /fp-docs:citations <subcommand>   Manage code citations (generate|update|verify|audit)
  /fp-docs:api-ref <subcommand>     Manage API reference tables (generate|audit)
  /fp-docs:locals <subcommand>      Manage $locals contracts (annotate|contracts|cross-ref|validate|shapes|coverage)

ADMIN OPERATIONS (system maintenance)
  /fp-docs:setup                    First-time plugin setup and verification
  /fp-docs:sync                     Sync codebase and docs branches
  /fp-docs:update                   Check for and install plugin updates
  /fp-docs:update-skills            Regenerate command files
  /fp-docs:update-index             Refresh PROJECT-INDEX.md and source-map.json
  /fp-docs:update-claude            Regenerate CLAUDE.md template

META COMMANDS
  /fp-docs:do <description>         Smart router -- describe what you want in plain language
  /fp-docs:help                     Show this command reference

BATCH OPERATIONS
  /fp-docs:parallel <operations>    Run multiple operations in parallel
  /fp-docs:remediate [--plan-only]  Fix all issues from a prior audit

COMMON FLAGS
  --no-research       Skip the pre-operation research phase
  --plan-only         Stop after planning, display plan without executing
  --no-sanity-check   Skip sanity-check during review phase
  --visual            Enable visual verification via Playwright
  --batch-mode        Execution mode: subagent (default) | team | sequential
  --dry-run           Show what would be done without doing it
```
</step>

</process>

<success_criteria>
- [ ] All 23 commands displayed with descriptions
- [ ] Commands grouped by category
- [ ] Common flags listed
- [ ] No agent spawning required
</success_criteria>
