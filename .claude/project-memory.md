# Project Memory — fp-docs

> Persistent memory for the fp-docs plugin. Read at session start. Update as you learn.
> Promote stable entries to specs. Prune stale entries.

## Decisions

- **Repo split (2026-04-09)**: fp-docs split from cc-plugins marketplace into independent repo (`tomkyser/fp-docs`). Still available as submodule under `tomkyser/fp-tools`. CLAUDE.md created for standalone context.
- **User guide placement (2026-04-10)**: User guide lives at `{docs-repo}/user-guide/` as a separate Hugo site (Relearn theme) within the existing docs repo. Not a separate repo.
- **User guide theme (2026-04-10)**: Hugo Relearn for user docs (visual, user-friendly, search/tabs/badges). Hugo Book stays for dev wiki. Audience separation is non-negotiable.
- **Scaffolding model (2026-04-11)**: User-guide infrastructure (hugo.toml, layouts, content stubs, templates, deploy workflow) must be bundled as plugin scaffolding in `scaffolds/user-guide/`, not staged in team-state for manual copying. The plugin bootstraps docs repo structures automatically when they're absent.
- **Visual tooling (2026-04-10)**: Playwright MCP (already configured with SSL bypass) for screenshots/recordings. Screencast API (Playwright 1.59+) for video. Git LFS for binary assets. Dual pipeline: MCP interactive + CJS batch.

## Known Issues & Workarounds

- **Dev wiki contentDir gotcha**: Dev wiki's `hugo.toml` uses `contentDir = "."` which means any new subdirectory (like `user-guide/`) gets rendered by the dev wiki unless added to `ignoreFiles`. Always check existing Hugo config scope when adding directories to docs repo.
- **Codebase root unreachable in plugin dev mode**: When running via `--plugin-dir`, `paths.cjs` can't find the FP codebase (returns null). Set `$FP_CODEBASE_ROOT` env var or run from within the FP codebase directory.
- **Hugo modules require Go in CI**: GitHub Actions for Hugo module themes need `setup-go` step. Gotcha hit in both wave2 and wave3.

## Patterns & Conventions

- **Three-repo coordination**: Plugin repo (this), codebase repo (FP wp-content), docs repo (nested in codebase). `lib/paths.cjs` resolves all three. Only orchestrator touches git.
- **Wave-based team work**: Agent teams (Architect + Engineer + Lead) execute phased work. Lead reviews and commits. Retrospectives written after final phase. State in `.claude/team-state/`.
- **Reports to disk immediately**: Wave2 learned that deliverables must be written incrementally, not batched at the end. Prevents loss if agent hits context limit.

## Version Notes

- **v1.0.0** (current): 23 commands, 10 agents, 16 references, 6 hooks, 23 CJS lib modules. Full pipeline with 8 stages in 3 phases.

## Active Plans

- **User guide command/pipeline system** (`.claude/plans/user-guide-system.md`): 8 new `/fp-docs:ug-*` commands, 2 new agents (fp-docs-ug-writer, fp-docs-ug-validator), 3 new references, 5-stage pipeline enforcing UI behavior accuracy. 5 implementation phases, 28 new files + 7 modified. Ready for implementation.

## Session Log

- **2026-04-09 wave2**: Dev wiki scaffolding (Hugo Book theme), migration detection fixes, session nudge. Wiki research report produced.
- **2026-04-09/10 wave3**: User docs research + implementation. Hugo Relearn site scaffolded, Playwright visual tooling researched. Scaffolding staged in team-state (needs rearchitecting to plugin scaffolds).
- **2026-04-11**: Repo split recognized. CLAUDE.md created for standalone fp-docs repo. Scaffolding architecture identified as gap — staged files in team-state need to become bundled plugin scaffolds with auto-bootstrap.
