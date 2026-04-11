# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**fp-docs** is a Claude Code plugin — a documentation management system for the Foreign Policy (FP) WordPress codebase. It automates creation, maintenance, validation, and deprecation of developer documentation by reading actual source code. Built entirely on Claude Code's native plugin primitives (agents, skills, hooks, modules) with a GSD-style command-workflow-agent architecture.

**Core Value:** Every documentation claim is verified against actual source code — zero tolerance for hallucination. If the accuracy guarantee breaks, nothing else matters.

**Repository:** `tomkyser/fp-docs` (independent repo, also available as submodule under `tomkyser/fp-tools` marketplace)

## Specs Directory — Canonical Reference

The `specs/` directory is the **authoritative reference** for this plugin. These documents are the single source of truth for how fp-docs works, how it's built, and how it's used.

| File | Scope |
|------|-------|
| `specs/architecture.md` | Internal design: routing, agents, references, pipeline, hooks, git model, config, end-to-end traces |
| `specs/features-and-capabilities.md` | Feature catalog: 23 commands, 10 agents, pipeline stages, templates, verification checklist |
| `specs/usage-and-workflows.md` | User-facing: installation, workflows A-F, command reference, config, gotchas |

**Before any development work**, read the relevant spec file(s). During development, verify changes align with established patterns. After changes, update affected spec files — Claude is solely responsible for keeping specs current and internally consistent.

## Version Management

### Source of Truth

`.claude-plugin/plugin.json` -> `"version"` field (currently `1.0.0`)

### Files That Must Match

| File | Location of version reference |
|------|-------------------------------|
| `.claude-plugin/plugin.json` | `"version": "X.Y.Z"` — **source of truth** |
| `CLAUDE.md` | Repository layout tree comment |
| `README.md` | Plugin identity section |
| `specs/architecture.md` | Layout tree, plugin.json example |
| `specs/features-and-capabilities.md` | Plugin identity (`**Version**: X.Y.Z`) |
| `specs/usage-and-workflows.md` | Plugin identity (`Version: X.Y.Z`) |
| `CHANGELOG.md` | New `## [X.Y.Z]` entry |

### Version Bump Procedure

1. Update `plugin.json` first
2. Update every file in the table above
3. Add a new `CHANGELOG.md` entry
4. Search repo for old version string to catch stragglers

## Versioning Governance

These rules are PERMANENT.

1. **Claude is NEVER allowed to automatically increment version numbers, create tags, or publish releases.** All version bumps require explicit user instruction.
2. **Claude CAN create feature/task branches.** Pattern: `{feature/task}-{milestone}-{phase}-{patch}`.
3. **All phases for a milestone fold into a milestone branch** before release.

### Merge and Release Flow
```
feature/task branch -> dev -> tag + dev release -> merge dev into master -> tag + master release
```

### Branch Naming
- **master** (release): Tag `{major}.{minor}.{patch}`
- **dev** (testing): Tag `D.{major}.{minor}.{patch}`
- **Feature/Task**: `{feature/task}-{milestone}-{phase}-{patch}`

## Repository Layout

```
fp-docs/                             # Plugin root (git root: tomkyser/fp-docs)
├── .claude-plugin/
│   └── plugin.json                  # Plugin manifest (v1.0.0)
├── agents/                          # 10 specialist agents (fp-docs-*)
│   ├── fp-docs-modifier.md
│   ├── fp-docs-validator.md
│   ├── fp-docs-citations.md
│   ├── fp-docs-api-refs.md
│   ├── fp-docs-locals.md
│   ├── fp-docs-verbosity.md
│   ├── fp-docs-indexer.md
│   ├── fp-docs-system.md
│   ├── fp-docs-researcher.md
│   └── fp-docs-planner.md
├── commands/                        # 23 GSD command files (namespaced /fp-docs:*)
├── workflows/                       # 23 workflow orchestrators (XML-structured)
├── references/                      # 16 shared reference files (@-loaded by workflows)
├── hooks/                           # 6 standalone JS hook files
│   ├── fp-docs-session-start.js
│   ├── fp-docs-check-update.js
│   ├── fp-docs-git-guard.js
│   ├── fp-docs-subagent-stop.js
│   ├── fp-docs-teammate-idle.js
│   └── fp-docs-task-completed.js
├── lib/                             # 23 CJS modules
│   ├── core.cjs                     # Output helpers, safe I/O
│   ├── paths.cjs                    # Three-repo path resolution
│   ├── git.cjs                      # Git operations
│   ├── routing.cjs                  # Command-to-agent routing table (23 entries)
│   ├── health.cjs                   # System health checks
│   ├── hooks.cjs                    # Hook handlers
│   ├── config.cjs                   # Config reader
│   └── ...                          # 16 more domain modules
├── fp-tools.cjs                     # CLI entry point for all CJS modules
├── config.json                      # Unified config (system + project + model + pipeline)
├── settings.json                    # Default permissions and hook registrations
├── scaffolds/                       # Bundled scaffolds for docs repo structures
│   └── user-guide/                  # Hugo Relearn user guide (20 files)
├── specs/                           # Canonical specification documents
├── tests/                           # Characterization and unit tests
├── templates/                       # Shell integration templates
├── tools/                           # Ephemeral WP-CLI tool (class-locals-cli.php)
├── .mcp.json                        # MCP/tool config (Playwright)
├── source-map.json                  # Generated source mapping (gitignored)
├── README.md
├── CHANGELOG.md
└── CLAUDE.md                        # This file
```

## Three-Repo Git Model

fp-docs operates across three independent git repositories. Understanding this is critical.

| Repo | Location | Remote | Purpose |
|------|----------|--------|---------|
| **Plugin** | This repo (`fp-docs/`) | `tomkyser/fp-docs` | Plugin code, agents, commands, workflows |
| **Codebase** | Auto-detected via `git rev-parse` | FP wp-content repo | WordPress source code being documented |
| **Docs** | `{codebase}/themes/foreign-policy-2017/docs/` | `tomkyser/docs-foreignpolicy-com` | Documentation output (dev wiki, user guide) |

### Path Resolution

`lib/paths.cjs` resolves all three roots:
- **Plugin root**: `__dirname` up one level, fallback to `$CLAUDE_PLUGIN_ROOT`
- **Codebase root**: `git rev-parse` from cwd, walk-up detection for FP marker (`themes/foreign-policy-2017/`), fallback to `$FP_CODEBASE_ROOT`
- **Docs root**: `{codebase}/themes/foreign-policy-2017/docs/`

**When codebase root is unreachable** (e.g., plugin dev mode via `--plugin-dir`), paths.cjs returns `null` and callers degrade gracefully. Plugin development does not require the FP codebase to be present.

### Git Protocol
- Only the workflow orchestrator touches git — specialist agents never commit
- Codebase repo: `git -C {codebase-root} [command]`
- Docs repo: `git -C {docs-root} [command]` — docs is a SEPARATE nested repo, never mix with codebase git
- Plugin repo: standard git operations from repo root

## Plugin Development

**Validate plugin structure:**
```bash
claude plugin validate .
```

**Load plugin from local directory (dev mode):**
```bash
claude --plugin-dir /path/to/fp-docs
```

**Install from marketplace (production):**
```
/plugin marketplace add tomkyser/fp-tools
/plugin install fp-docs@fp-tools
```

## Architecture (Quick Reference)

> Full details: `specs/architecture.md`

**Core routing**: User command (`commands/{name}.md`) -> workflow (`workflows/{name}.md`) -> specialist agent(s) -> pipeline enforcement -> report

**Routing table**: `lib/routing.cjs` is the single source of truth for command-to-agent mapping (23 entries).

**Pipeline**: 8 stages split into 3 phases:
- **Write Phase** (stages 1-3): Primary engine + verbosity/citations/api-refs enforcement
- **Review Phase** (stages 4-5): Sanity-check + 10-point verification
- **Finalize Phase** (stages 6-8): Changelog + index + git commit

**Agents**: 10 specialists
- Write-capable: fp-docs-modifier, fp-docs-citations, fp-docs-api-refs, fp-docs-locals, fp-docs-indexer, fp-docs-system
- Read-only: fp-docs-validator, fp-docs-verbosity
- Research/planning: fp-docs-researcher, fp-docs-planner

**Key constraints**:
- Commands are thin YAML+XML files that load workflows via `@-reference`
- Workflows load shared context via `@-reference` to `references/` files
- Pipeline stages 5 (verification), 6 (changelog), and 8 (docs commit) never skip

## Adding a New Command

1. Create `commands/{name}.md` — YAML frontmatter + XML body (`<objective>`, `<execution_context>`, `<process>`, `<success_criteria>`)
2. Create `workflows/{name}.md` — workflow orchestration with agent spawn patterns
3. Add to routing table in `lib/routing.cjs`
4. If new agent needed: create `agents/fp-docs-{name}.md`
5. Add behavioral spec at `tests/specs/{name}.md`
6. Update affected spec files in `specs/`

## Adding a New Reference

1. Create `references/{name}.md`
2. Add `@${CLAUDE_PLUGIN_ROOT}/references/{name}.md` to workflows that need it
3. Update affected spec files in `specs/`

## Key Conventions

- All commands namespaced as `/fp-docs:*`
- Workflows are source of truth for operation behavior; commands just load them
- `config.json` is the unified configuration file
- Hooks are standalone JS files in `hooks/` (registered in `settings.json`)
- `/fp-docs:parallel` requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled
- CJS modules in `lib/` — handlers: `handleX` for hooks, `cmdX` for CLI commands
- Invoked via `fp-tools.cjs` CLI (e.g., `fp-tools.cjs hooks run session-start inject-manifest`)

## Scaffolding and Bootstrap

The plugin includes scaffolding assets for structures it manages in the docs repo. When a workflow needs a structure that doesn't exist yet (e.g., `user-guide/` directory), the plugin **bootstraps it automatically** from bundled scaffolds rather than requiring manual file copying.

Scaffold assets live in `scaffolds/` within the plugin. The workflow detects absence, copies from scaffold, and proceeds — the user never manually moves files between repos.

## Project Memory

This project uses `.claude/project-memory.md` for persistent memory across sessions.

**Before starting work**, read `.claude/project-memory.md` to load prior context.

**During work**, update it when you discover patterns, confirm decisions, encounter non-obvious issues, or learn plugin system behavior not covered in specs.

### Three-Tier Knowledge Hierarchy

| Tier | Location | Purpose | Stability |
|------|----------|---------|-----------|
| **Specs** | `specs/*.md` | Canonical system reference | Stable, authoritative |
| **CLAUDE.md** | This file | Quick-reference orientation + rules | Stable |
| **Project Memory** | `.claude/project-memory.md` | Session learnings, active decisions, known issues | Evolving |

**Promotion rule**: When a project-memory entry proves stable and broadly applicable, promote it to the relevant spec file and remove from project-memory.

## Constraints

- **Platform**: Claude Code plugin system — all capabilities bounded by plugin primitives
- **Model**: All engines use Claude Opus with 50-100 maxTurns per engine
- **Dependencies**: WordPress + ddev + WP-CLI required for runtime testing and locals extraction
- **Git**: Three independent repos must stay coordinated; only orchestrator commits
- **No build system**: Plugin is static markdown, YAML frontmatter, CJS modules, and JSON config

## Technology Stack

- **Markdown/YAML**: Commands, workflows, agents, references, specs
- **CJS (Node.js)**: `lib/*.cjs` modules, `fp-tools.cjs` CLI, hook files in `hooks/`
- **JSON**: `plugin.json`, `config.json`, `settings.json`, `.mcp.json`
- **PHP**: Ephemeral WP-CLI tool (`tools/class-locals-cli.php`)
- **Git**: Three-repo coordination
- **Hugo**: Docs repo uses Hugo for both dev wiki (Book theme) and user guide (Relearn theme)
- **Playwright MCP**: Visual tooling for screenshots/recordings in user docs

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

- `/gsd:quick` for small fixes, doc updates, ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
