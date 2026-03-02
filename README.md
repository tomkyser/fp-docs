# fp-docs — Documentation Management Plugin

Documentation management system for the Foreign Policy WordPress codebase. Built as a Claude Code plugin using native primitives (subagents, skills, hooks, persistent memory).

## Overview

- **8 engine agents** — each owns a domain of responsibility (modify, validate, citations, API refs, locals, verbosity, index, system)
- **10 shared modules** — preloaded into engines as skill dependencies (standards, project config, pipeline, domain rules)
- **19 user commands** — `/fp-docs:*` namespace for all documentation operations
- **5 hooks** — SessionStart (manifest + branch sync), SubagentStop, TeammateIdle, TaskCompleted
- **Three-repo architecture** — codebase, docs, and plugin each have independent git repos

## Three-Repo Model

- **Codebase** (wp-content/) — FP WordPress source code, gitignores docs/
- **Docs** (themes/foreign-policy-2017/docs/) — nested repo, branch-mirrored with codebase
- **Plugin** (standalone) — installed separately, one version for all team members

## Installation

### Prerequisites
- Claude Code with subagent support
- Git access to https://github.com/tomkyser/docs-foreignpolicy-com (docs repo)
- FP codebase checked out at wp-content/

### Step 1: Install the Plugin
```bash
# Clone the plugin to your local plugins directory
git clone https://github.com/tomkyser/fp-docs.git ~/cc-plugins/fp-docs

# Load the plugin
claude --plugin-dir ~/cc-plugins/fp-docs
```

### Step 2: Set Up the Docs Repo
```bash
# From your codebase's theme directory
cd themes/foreign-policy-2017/
git clone https://github.com/tomkyser/docs-foreignpolicy-com docs
```

### Step 3: Verify Codebase .gitignore
Ensure `themes/foreign-policy-2017/docs/` is in your codebase's `.gitignore`.

### Step 4: Run Setup Verification
```
/fp-docs:setup
```

### Step 5: Sync Docs Branch
```
/fp-docs:sync
```
This creates a docs branch matching your current codebase branch and generates a diff report.

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

## Quick Start for Team Members

1. **Install the plugin**:
   ```bash
   git clone https://github.com/tomkyser/fp-docs.git ~/cc-plugins/fp-docs
   ```
   Add to your Claude Code config or use:
   ```bash
   claude --plugin-dir ~/cc-plugins/fp-docs
   ```

2. **Set up the docs repo** (from your codebase workspace):
   ```bash
   cd themes/foreign-policy-2017/
   git clone https://github.com/tomkyser/docs-foreignpolicy-com docs
   ```

3. **Verify your .gitignore** includes `themes/foreign-policy-2017/docs/`

4. **Run setup**:
   ```
   /fp-docs:setup
   ```

5. **Sync branches**:
   ```
   /fp-docs:sync
   ```
   This creates a docs branch matching your codebase branch
   and generates a diff report showing which docs may be stale.

## For Parallel Mode
Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled.
