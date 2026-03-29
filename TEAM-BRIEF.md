# fp-docs Conversion Team Brief

> Working reference for the 3-person parallel team executing the architecture conversion.
> Master plan: `CONVERSION-PLAN.md` | Current state: `fp-docs-current-state.md` | GSD reference: `gsd-architecture-analysis.md`

## Team Roster

| Name | Role | Perspective | Focus Areas |
|------|------|-------------|-------------|
| **Mira** | Software Architect | Structural thinking, pattern consistency, GSD alignment | Commands, workflows, agents, references, documentation |
| **Kai** | Senior Engineer | Implementation precision, CJS mastery, test-driven | CJS modules, hooks (JS), tests, configs, fp-tools.cjs |
| **Reese** | Principal Engineer | Quality gate, correctness, completeness — superior authority | Review, verification, git commit/push, flagging issues |

## User Decisions (Final)

1. **Manifest disposition (Decision 2):** Roll manifest content into README.md. Delete `framework/manifest.md` in Phase 10.
2. **Module loading strategy (Decision 5):** GSD explicit style — repeat `doc-standards.md` and `fp-project.md` as `@-reference` in every command's `<execution_context>`.

## Working Directory

```
/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs
```

Branch: `dev` (push here after each phase)

## Workflow Protocol

### Per-Phase Cycle

```
1. Mira + Kai work in parallel on their portions of the phase
2. Each messages Reese when their portion is complete (list files changed)
3. Reese reviews ALL changes against CONVERSION-PLAN.md
4. If CRITICAL issues → Reese messages the responsible dev to fix before commit
5. If only MINOR issues → Reese logs them in REVIEW-LOG.md for second pass
6. Reese commits and pushes to dev with message format:
   {type}(phase-{N}): {description}
7. Reese messages both Mira and Kai: "Phase N complete. Proceed to Phase N+1."
```

### Git Rules

- **ONLY Reese commits and pushes.** Mira and Kai NEVER touch git.
- Commit after EACH phase (not batched).
- Commit message types: `feat`, `refactor`, `docs`, `test`, `chore`
- Push to `dev` branch (upstream already set).

### Communication Protocol

- Dev-to-dev: Mira and Kai message each other directly to coordinate within a phase.
- Dev-to-reviewer: Message Reese when phase work is complete.
- Reviewer-to-devs: Reese messages both when review passes or when fixes are needed.
- Broadcast (`*`): Use sparingly — only for blocking issues.

## Phase Division of Labor

### Phase 1: Foundation

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Create `commands/fp-docs/` directory | Update `settings.json` with hooks placeholder |
| Create `workflows/` directory | Add `source-map.json` to `.gitignore` |
| Create `references/` directory | Delete `commands/generate.md` (untracked stub) |
| Create `templates/` directory | Delete `workflows/generate.md` (untracked stub) |
| Update `config.json` with `model_profile` section | Delete `framework/config/system-config.md` |
| | Delete `framework/config/project-config.md` |

### Phase 2: References

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Convert 10 modules to reference files: | Move 6 algorithms to `references/`: |
| `mod-standards` → `references/doc-standards.md` | `verbosity-algorithm.md` → `references/` |
| `mod-project` → `references/fp-project.md` | `citation-algorithm.md` → `references/` |
| `mod-pipeline` → `references/pipeline-enforcement.md` | `api-ref-algorithm.md` → `references/` |
| `mod-citations` → `references/citation-rules.md` | `validation-algorithm.md` → `references/` |
| `mod-api-refs` → `references/api-ref-rules.md` | `git-sync-rules.md` → `references/` |
| `mod-changelog` → `references/changelog-rules.md` | `codebase-analysis-guide.md` → `references/` |
| `mod-index` → `references/index-rules.md` | |
| `mod-locals` → `references/locals-rules.md` | Move 4 templates to `templates/`: |
| `mod-verbosity` → `references/verbosity-rules.md` | `fp-docs-shell.zsh` → `templates/` |
| `mod-validation` → `references/validation-rules.md` | `fp-docs-statusline.js` → `templates/` |
| (Strip SKILL.md frontmatter, preserve all content) | `post-merge.sh` → `templates/` |
| | `post-rewrite.sh` → `templates/` |

### Phase 3: CLI Tooling

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Design init command JSON response schemas | Implement `lib/init.cjs` |
| Design model profile table structure | Implement `lib/model-profiles.cjs` |
| Document schemas in code comments | Update `fp-tools.cjs` with `init` and `resolve-model` routes |
| Validate design against CONVERSION-PLAN.md | Test: `fp-tools init write-op revise "test"` returns valid JSON |

### Phase 4: Agents

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Write all 10 new agent files: | Update `lib/enforcement.cjs` STAGE_AUTHORITY_MAP |
| `agents/fp-docs-modifier.md` | Update agent name references in other CJS modules |
| `agents/fp-docs-validator.md` | |
| `agents/fp-docs-citations.md` | |
| `agents/fp-docs-api-refs.md` | |
| `agents/fp-docs-locals.md` | |
| `agents/fp-docs-verbosity.md` | |
| `agents/fp-docs-indexer.md` | |
| `agents/fp-docs-system.md` | |
| `agents/fp-docs-researcher.md` | |
| `agents/fp-docs-planner.md` | |
| (GSD-style frontmatter + XML body, preserve domain knowledge) | |

### Phase 5: Workflows (LARGEST PHASE)

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Create write workflow template | Create multi-subcommand workflows: |
| Write workflows: | `workflows/citations.md` (merge 4 instruction files) |
| `workflows/revise.md` | `workflows/api-ref.md` (merge 2 instruction files) |
| `workflows/add.md` | `workflows/locals.md` (merge 6 instruction files) |
| `workflows/auto-update.md` | |
| `workflows/auto-revise.md` | Create admin/system workflows: |
| `workflows/deprecate.md` | `workflows/setup.md` |
| | `workflows/sync.md` |
| Create read workflows: | `workflows/update.md` |
| `workflows/audit.md` | `workflows/update-skills.md` |
| `workflows/verify.md` | `workflows/update-index.md` |
| `workflows/sanity-check.md` | `workflows/update-claude.md` |
| `workflows/test.md` | |
| `workflows/verbosity-audit.md` | Create special workflows: |
| | `workflows/parallel.md` |
| Create meta workflows: | `workflows/remediate.md` |
| `workflows/do.md` | |
| `workflows/help.md` | |

### Phase 6: Commands

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Create ALL 23 command files in `commands/fp-docs/` | Verify all `@-reference` paths resolve |
| Each with: YAML frontmatter + XML body | Spot-check frontmatter schema consistency |
| Include GSD explicit style: `doc-standards.md` + `fp-project.md` in every command | Validate `allowed-tools` per command type |

### Phase 7: Hooks

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Write complete hook registrations in `settings.json` | Implement `hooks/fp-docs-session-start.js` |
| Include ALL SubagentStop matchers (7 agents) | Implement `hooks/fp-docs-check-update.js` |
| Design hook output JSON structure | Implement `hooks/fp-docs-git-guard.js` |
| | Implement `hooks/fp-docs-subagent-stop.js` |
| | Implement `hooks/fp-docs-teammate-idle.js` |
| | Implement `hooks/fp-docs-task-completed.js` |
| | Refactor `lib/hooks.cjs` to shared utility |

### Phase 8: Integration

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Update `lib/routing.cjs` routing table | Update `lib/health.cjs` for new directory structure |
| Verify all cross-references resolve | Update `lib/enforcement.cjs` delegation result parsing |
| Check workflow → agent → reference chains | Update `.claude-plugin/plugin.json` description |
| | Run `node tests/run.cjs` to identify failures |

### Phase 9: Tests

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Update all 23 `tests/specs/*.json` files | Update `tests/run.cjs` for new paths |
| Update spec frontmatter expectations | Update `tests/lib/spec-validator.cjs` |
| | Update `tests/lib/fixture-runner.cjs` |
| | Update `tests/lib/hooks-ab-runner.cjs` |
| | Update `tests/lib/lib-routing-tests.cjs` |
| | Update `tests/lib/lib-engine-compliance-tests.cjs` |
| | Update `tests/lib/lib-enforcement-tests.cjs` |
| | Create `tests/lib/lib-init-tests.cjs` |
| | Create `tests/lib/lib-model-profiles-tests.cjs` |
| | Update `tests/lib/marker-checker.cjs` |
| | Run full test suite, fix failures |

### Phase 10: Cleanup

| Mira (Architect) | Kai (Engineer) |
|-------------------|----------------|
| Delete all old `skills/` directories (23) | Update root `CLAUDE.md` (at cc-plugins/) |
| Delete all old `modules/` directories (11) | Update `CHANGELOG.md` |
| Delete all `framework/instructions/` files (30) | Run `fp-tools health check` |
| Delete all `framework/algorithms/` files (6) | Run `claude plugin validate .` |
| Delete `framework/templates/` (moved) | Flatten `framework/` if nearly empty |
| Delete old agent files (11) | |
| Delete `hooks/hooks.json` | |
| Update `specs/architecture.md` (full rewrite) | |
| Update `specs/features-and-capabilities.md` | |
| Update `specs/usage-and-workflows.md` | |
| Update `README.md` (roll in manifest content) | |

## Second Pass Protocol

After Phase 10 is reviewed, Reese presents the REVIEW-LOG.md to Mira and Kai. They address all MINOR flagged items. Reese reviews fixes, commits, pushes.

## Final Documentation Protocol

After second pass, all three teammates discuss:
1. What went well
2. What could be improved
3. Patterns discovered
4. Gotchas encountered
5. Remaining risks or technical debt

Record findings in `CONVERSION-RETROSPECTIVE.md`. Then update any documentation that needs it.

## Critical Reminders

- **Read CONVERSION-PLAN.md thoroughly** before starting any phase. It has the exact before/after examples, frontmatter schemas, and XML structures.
- **Preserve all domain knowledge.** Content from modules moves to references unchanged. Content from instruction files is absorbed into workflows. Nothing is lost.
- **Pipeline enforcement is the core value prop.** The 8-stage pipeline (`lib/pipeline.cjs`) must work exactly as before. Only WHO calls it changes (workflows instead of orchestrate engine).
- **Three-repo git model is a hard constraint.** `lib/git.cjs` and `lib/paths.cjs` are untouched.
- **Version is NOT bumped.** Per governance rules, version stays at 1.0.0 until user explicitly instructs otherwise.
- **No external dependencies.** Everything must remain self-contained with Node.js built-ins only.
