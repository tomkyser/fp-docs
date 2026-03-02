# fp-docs — Documentation Management Plugin

Documentation management system for the Foreign Policy WordPress codebase. Built as a Claude Code plugin using native primitives (subagents, skills, hooks, persistent memory).

## Overview

- **8 engine agents** — each owns a domain of responsibility (modify, validate, citations, API refs, locals, verbosity, index, system)
- **10 shared modules** — preloaded into engines as skill dependencies (standards, project config, pipeline, domain rules)
- **18 user commands** — `/fp-docs:*` namespace for all documentation operations
- **4 hooks** — SessionStart, SubagentStop, TeammateIdle, TaskCompleted for pipeline validation

## Installation

```bash
claude --plugin-dir /path/to/fp-docs-system
```

Or symlink into your project's `.claude/plugins/` directory.

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
After any doc modification: Verbosity → Citations → API Refs → Sanity-Check → Verify → Changelog → Index

## Prerequisites

- Claude Code with subagent support
- Project at `wp-content/` working directory
- For parallel mode: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled
