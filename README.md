# fp-docs — Documentation Management Plugin

Documentation management system for the Foreign Policy WordPress codebase. Built as a Claude Code plugin using native primitives (subagents, skills, hooks, persistent memory). Distributed via the `fp-tools` plugin marketplace.

## Overview

- **8 engine agents** — each owns a domain of responsibility (modify, validate, citations, API refs, locals, verbosity, index, system)
- **10 shared modules** — preloaded into engines as skill dependencies (standards, project config, pipeline, domain rules)
- **19 user commands** — `/fp-docs:*` namespace for all documentation operations
- **5 hooks** — SessionStart (manifest + branch sync), SubagentStop, TeammateIdle, TaskCompleted
- **Three-repo architecture** — codebase, docs, and plugin each have independent git repos
- **Marketplace distribution** — install via `/plugin install fp-docs@fp-tools`

## Three-Repo Model

- **Codebase** (wp-content/) — FP WordPress source code, gitignores docs/
- **Docs** (themes/foreign-policy-2017/docs/) — nested repo, branch-mirrored with codebase
- **Plugin** (standalone) — distributed via marketplace, cached locally by Claude Code

## Installation

### Prerequisites
- Claude Code with subagent support
- Git access to https://github.com/tomkyser/docs-foreignpolicy-com (docs repo)
- FP codebase checked out at wp-content/

### Step 1: Add the Marketplace

```
/plugin marketplace add tomkyser/fp-docs
```

### Step 2: Install the Plugin

```
/plugin install fp-docs@fp-tools
```

The plugin is copied to `~/.claude/plugins/cache/` and enabled.

### Step 3: Set Up the Docs Repo
```bash
# From your codebase's theme directory
cd themes/foreign-policy-2017/
git clone https://github.com/tomkyser/docs-foreignpolicy-com docs
```

### Step 4: Run Setup Verification
```
/fp-docs:setup
```
This verifies the plugin, docs repo, codebase .gitignore, and branch sync state.

### Step 5: Sync Docs Branch
```
/fp-docs:sync
```
This creates a docs branch matching your current codebase branch and generates a diff report.

### Development Mode

To load the plugin from a local directory (for plugin development only):
```bash
git clone https://github.com/tomkyser/fp-docs.git ~/cc-plugins/fp-docs
claude --plugin-dir ~/cc-plugins/fp-docs
```

## Commands

### Documentation Modification
| Command | Description |
|---------|-------------|
| `/fp-docs:revise` | Fix specific docs you know are wrong or outdated |
| `/fp-docs:add` | Create documentation for new code |
| `/fp-docs:auto-update` | Auto-detect code changes and update affected docs |
| `/fp-docs:auto-revise` | Batch-process all items in the revision tracker |
| `/fp-docs:deprecate` | Mark documentation as deprecated |

### Validation (Read-Only)
| Command | Description |
|---------|-------------|
| `/fp-docs:audit` | Compare docs against source code |
| `/fp-docs:verify` | Run 10-point verification checklist |
| `/fp-docs:sanity-check` | Validate doc claims against source code |
| `/fp-docs:test` | Runtime validations against local dev environment |

### Specialized Operations
| Command | Description |
|---------|-------------|
| `/fp-docs:citations` | Manage code citations (generate, update, verify, audit) |
| `/fp-docs:api-ref` | Generate or update API Reference sections |
| `/fp-docs:locals` | Manage $locals contract documentation |
| `/fp-docs:verbosity-audit` | Scan docs for verbosity gaps |

### System
| Command | Description |
|---------|-------------|
| `/fp-docs:update-index` | Refresh PROJECT-INDEX.md |
| `/fp-docs:update-claude` | Regenerate CLAUDE.md template |
| `/fp-docs:update-skills` | Sync skills with prompt definitions |
| `/fp-docs:setup` | Initialize or verify plugin installation |
| `/fp-docs:sync` | Sync docs branch with codebase branch, generate diff reports |
| `/fp-docs:parallel` | Parallel batch processing via Agent Teams |

## Architecture

### Engine Pattern
```
User types /fp-docs:revise → Skill (context:fork) → docs-modify engine subagent
  → Reads instruction file → Executes operation → Runs pipeline → Returns report
```

### Shared Module Deduplication
Each rule lives in exactly one module. Engines preload modules; modules don't know about engines. FP-specific values live in the project module, not in domain modules.

### Post-Modification Pipeline
After any doc modification: Verbosity → Citations → API Refs → Sanity-Check → Verify → Changelog → Index → Docs Commit

### Branch Mirroring
- Docs `master` = canonical docs for codebase `origin/master`
- Feature branches in docs mirror codebase feature branches
- SessionStart hook detects branch mismatches and warns
- `/fp-docs:sync` creates/switches branches and generates diff reports
- `/fp-docs:sync merge` merges docs feature branch to master

## Team Setup

Each team member maintains their own `.claude/settings.json`. To enable auto-prompt for the marketplace and plugin, add the following to your local `.claude/settings.json` (or `.claude/settings.local.json`):

```json
{
  "extraKnownMarketplaces": {
    "fp-tools": {
      "source": { "source": "github", "repo": "tomkyser/fp-docs" }
    }
  },
  "enabledPlugins": {
    "fp-docs@fp-tools": true
  }
}
```

With this in place, Claude Code will auto-prompt you to add the marketplace and enable the plugin when you open the project.

Without the settings above, install manually:
```
/plugin marketplace add tomkyser/fp-docs
/plugin install fp-docs@fp-tools
```

### Updating

Plugin updates are detected when the `version` in `plugin.json` changes:
```
/plugin update fp-docs@fp-tools
```

## Validation

Validate the plugin structure:
```bash
claude plugin validate .
```

## For Parallel Mode
Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled.

## License

MIT — see [LICENSE](LICENSE).
