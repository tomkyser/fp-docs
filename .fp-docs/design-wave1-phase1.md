# Wave 1 Phase 1: Research and Design

> Author: Architect
> Date: 2026-04-09
> Status: DRAFT

---

## Table of Contents

1. [D: File System Reorganization](#d-file-system-reorganization)
2. [C: Docs Branch Merge Intelligence](#c-docs-branch-merge-intelligence)
3. [E: Git Exclusion Strategy](#e-git-exclusion-strategy)
4. [Global State: Repo vs Flat File Decision](#global-state-repo-vs-flat-file-decision)
5. [Impact Matrix: Files Requiring Updates](#impact-matrix)

---

## D: File System Reorganization

### Current State

Today `.fp-docs` exists in three locations with mixed concerns:

| Location | Current Name | Contents |
|----------|-------------|----------|
| `{docs-root}/` | `.fp-docs/` | state.json, staleness.json, drift-pending.json, trackers/, remediation-plans/, plans/, analyses/ |
| `{codebase-root}/` | `.fp-docs/` | update-cache.json |
| `{plugin-root}/` | `.fp-docs/` | trackers/ (fallback only) |

Additionally, docs-root-level files that should be branch-scoped:
- `docs/diffs/` (diff reports per branch)
- `docs/FLAGGED CONCERNS/` (flagged issues)
- `docs/changelog.md` (modification log)
- `docs/claude-code-docs-system/` (contains PROJECT-INDEX.md)
- `docs/About.md` (docs readme)

### Design: Three-Tier Directory Structure

#### Tier 1: `{project_root}/.fp-docs/` -- Global Persistent State

Purpose: Cross-branch, cross-user persistent state. Survives branch switches.

```
{project_root}/.fp-docs/
  state.json              # Operation log (moved from docs/.fp-docs/)
  update-cache.json       # Plugin update cache (moved from {codebase-root}/.fp-docs/)
  staleness.json          # Drift staleness signals (moved from docs/.fp-docs/)
  drift-pending.json      # Pending drift from git hooks (moved from docs/.fp-docs/)
  trackers/               # Operation trackers (moved from docs/.fp-docs/)
  remediation-plans/      # Remediation plans (moved from docs/.fp-docs/)
  plans/                  # Execution plans (moved from docs/.fp-docs/)
  analyses/               # Research analyses (moved from docs/.fp-docs/)
  merge-intel/            # NEW: Branch merge intelligence data (for workstream C)
    candidates.json       # Detected merge candidates and staleness assessments
    history.json          # Past merge decisions for learning
```

**Rationale**: All of these are operational state that should persist across branch switches. When you switch from `feature-x` to `master`, you still want your operation log, trackers, and staleness signals intact. The data belongs to the *user/project*, not to a *branch*.

**Not a separate git repo**: See [decision below](#global-state-repo-vs-flat-file-decision).

#### Tier 2: `{docs-root}/.fp-docs-branch/` -- Branch-Scoped Data

Purpose: Data specific to the current docs branch. Travels with the branch.

```
{docs-root}/.fp-docs-branch/
  plugin-version.json     # NEW: fp-docs plugin version last used on this branch
  diffs/                  # Diff reports (moved from docs/diffs/)
  flagged-concerns/       # Flagged issues (moved from docs/FLAGGED CONCERNS/)
  changelog.md            # Modification log (moved from docs/changelog.md)
  .sync-watermark         # Watermark (moved from docs/.sync-watermark)
```

**Rationale**: These are branch-specific artifacts:
- Diffs show what changed *on this branch* relative to codebase
- Flagged concerns are branch-specific issues
- Changelog tracks modifications *on this branch*
- Watermark tracks sync state for *this branch*
- Plugin version tracks what version of fp-docs was used on *this branch* (for migration)

**plugin-version.json schema**:
```json
{
  "version": "1.0.0",
  "last_used": "2026-04-09T12:00:00Z",
  "compatible_since": "0.9.0"
}
```

#### Tier 3: `{project_root}/.claude/.fp-docs-project/` -- Plugin Cache Only

Purpose: Plugin-related caches that Claude Code manages. Not user-facing state.

```
{project_root}/.claude/.fp-docs-project/
  source-map.json         # Generated source-to-doc mapping cache
```

**Rationale**: Renamed from `.claude/.fp-docs` to clarify that this is plugin-specific cache, not configuration or docs. Currently this only holds the source-map cache. The `.claude/` parent is already Claude Code's domain.

### Docs Root Reorganization

| Current | New | Action |
|---------|-----|--------|
| `docs/About.md` | `docs/README.md` | Rename |
| `docs/claude-code-docs-system/PROJECT-INDEX.md` | `docs/PROJECT-INDEX.md` | Move to docs root |
| `docs/claude-code-docs-system/` | (deleted) | Drop folder after moving PROJECT-INDEX.md |
| `docs/diffs/` | `docs/.fp-docs-branch/diffs/` | Move |
| `docs/FLAGGED CONCERNS/` | `docs/.fp-docs-branch/flagged-concerns/` | Move + rename (no spaces, lowercase) |
| `docs/changelog.md` | `docs/.fp-docs-branch/changelog.md` | Move |
| `docs/.sync-watermark` | `docs/.fp-docs-branch/.sync-watermark` | Move |
| `docs/.fp-docs/` | (deleted) | All contents moved to `{project_root}/.fp-docs/` |

---

## C: Docs Branch Merge Intelligence

### Problem Statement

When `fp-docs:sync` runs on codebase master, it should detect if recent merges into master have matching fp-docs branches that contain generated documentation. If so, those docs should be merged into docs master (auto-merge if current, defer to user if stale).

### Detection Algorithm

```
1. DETECT: Find recently merged branches
   a. git -C {codebase-root} log --merges --first-parent -n 20 --format='%H|%aI|%s' master
   b. Extract branch names from merge commit subjects. Patterns to match:
      - Standard merge: "Merge branch '(.+?)'"
      - GitHub PR merge: "Merge pull request #\d+ from \S+/(.+)"
      - Alternative: "Merge (.+?) into"
      - Squash merge detection: also scan non-merge commits for "[branch-name]" or "(#\d+)" patterns in subject
   c. Filter out self-merges (master, main, dev, develop)
   d. Deduplicate by branch name (keep most recent)
   e. Result: list of recently merged codebase branches

2. MATCH: Check for corresponding docs branches
   For each merged codebase branch:
   a. git -C {docs-root} branch --list {branch-name}
   b. If match found, record as candidate
   c. Result: list of merge candidates with docs branches

3. ASSESS STALENESS: For each candidate
   a. Get last commit date on the docs branch:
      git -C {docs-root} log -1 --format='%aI' {branch-name}
   b. Get merge commit date in codebase master:
      git -C {codebase-root} log -1 --format='%aI' {merge-commit-hash}
   c. Get last commit date on codebase branch before merge:
      git -C {codebase-root} log -1 --format='%aI' {merge-commit-hash}^2
   d. Compare: is docs branch last-commit >= codebase branch last-commit?
      - YES: docs are CURRENT -- auto-merge eligible
      - NO: docs are STALE -- defer to user

4. EXECUTE: Based on assessment
   For CURRENT candidates (auto-merge):
   a. git -C {docs-root} checkout master
   b. git -C {docs-root} merge {branch-name} --no-edit
   c. If conflict: abort merge, mark as NEEDS_USER_REVIEW
   d. If success: push (unless --no-push)
   e. Optionally delete merged branch: git -C {docs-root} branch -d {branch-name}

   For STALE candidates (user review):
   a. Report: "{branch} docs last updated {date}, but codebase had {N} commits after that"
   b. Prompt user: merge anyway / skip / inspect
```

### Staleness Criteria

- **CURRENT**: Docs branch last commit timestamp >= last commit on codebase branch before merge. This means docs were updated after or at the same time as the last code change.
- **STALE**: Docs branch last commit timestamp < last commit on codebase branch before merge. Docs exist but weren't kept up to date with later code changes.
- **CONFLICTED**: Merge attempt results in conflicts. Always defers to user.
- **ORPHANED**: Docs branch exists but no matching merge found in codebase. Report but don't auto-merge.

### Data Model: `{project_root}/.fp-docs/merge-intel/candidates.json`

```json
{
  "version": 1,
  "last_scan": "2026-04-09T12:00:00Z",
  "candidates": [
    {
      "codebase_branch": "feature/new-widget",
      "docs_branch": "feature/new-widget",
      "merge_commit": "abc1234",
      "merge_date": "2026-04-08T10:00:00Z",
      "docs_last_commit": "def5678",
      "docs_last_date": "2026-04-07T15:00:00Z",
      "codebase_last_date": "2026-04-08T09:00:00Z",
      "status": "stale",
      "staleness_commits": 3,
      "action": null,
      "action_date": null
    }
  ]
}
```

### Data Model: `{project_root}/.fp-docs/merge-intel/history.json`

```json
{
  "version": 1,
  "decisions": [
    {
      "codebase_branch": "feature/new-widget",
      "docs_branch": "feature/new-widget",
      "action": "merged",
      "was_stale": false,
      "date": "2026-04-09T12:00:00Z",
      "merge_commit": "abc1234"
    }
  ]
}
```

### Integration with `fp-docs:sync`

The sync workflow gets a new step between "Branch alignment" and "Change detection":

```
Step 2.5: Merge Intelligence (condition: codebase is on master)
  1. Run detection algorithm
  2. For CURRENT candidates: auto-merge, report results
  3. For STALE candidates: present to user with staleness details
  4. Record decisions in history.json
  5. Continue to existing change detection
```

### Implementation Location

New file: `lib/merge-intel.cjs` with functions:
- `detectMergedBranches(codebaseRoot)` -- step 1
- `findMatchingDocsBranches(docsRoot, branches)` -- step 2
- `assessStaleness(docsRoot, codebaseRoot, candidates)` -- step 3
- `executeMerge(docsRoot, branch, opts)` -- step 4
- `scanAndReport(docsRoot, codebaseRoot, opts)` -- orchestrator for sync

CLI: `fp-tools merge-intel <scan|status|history>`

---

## E: Git Exclusion Strategy

### Requirements

Exclude from codebase git:
1. `themes/foreign-policy-2017/docs` (the docs repo -- already a separate git repo)
2. `.claude/` (Claude Code working directory)
3. `.fp-docs` (global persistent state -- new in this wave)

### Research: System Exclude vs .gitignore

| Aspect | `.gitignore` | `.git/info/exclude` |
|--------|-------------|---------------------|
| Scope | Per-repo, committed, shared with all users | Per-clone, local only, not committed |
| Branch portability | Present on all branches (if committed) | Always present regardless of branch |
| Risk on branches without fp-docs | If branch predates .gitignore entry, files could be committed accidentally | Always active -- protects all branches |
| Team visibility | Visible to all collaborators | Invisible to others |
| Git submodule interaction | Normal -- .gitignore rules apply to parent repo | Normal -- exclude rules also apply to parent repo |

### Recommendation: Hybrid Approach

**Use `.git/info/exclude`** for all three paths. Reasoning:

1. **Branch safety**: Some codebase branches predate fp-docs. If we use `.gitignore`, those branches wouldn't have the ignore rules. A developer switching to an old branch could accidentally `git add` docs or `.fp-docs` files. System exclude protects all branches unconditionally.

2. **No pollution**: Adding entries to `.gitignore` creates a commit that touches every branch on merge. The docs system shouldn't require codebase commits just to set up exclusion.

3. **Multi-user**: Each developer's clone needs its own exclude anyway (for `.claude/` which is user-specific). The `/fp-docs:setup` command already runs on first use -- it should configure excludes.

4. **Idempotent setup**: `/fp-docs:setup` should check and add exclude entries if missing. The setup workflow already checks `.gitignore` for docs -- extend it to also configure system exclude.

### Implementation

Extend `fp-docs:setup` workflow to:

```
1. Read {codebase-root}/.git/info/exclude
2. For each required path (docs, .claude/, .fp-docs):
   a. Check if already excluded
   b. If not, append to exclude file with comment
3. Report what was added
```

Exclude file additions:
```
# fp-docs: exclude documentation repo (separate git repo)
themes/foreign-policy-2017/docs/

# fp-docs: exclude Claude Code working directory
.claude/

# fp-docs: exclude fp-docs global state
.fp-docs/
```

**Fallback**: If `.git/info/exclude` is not writable (rare edge case), warn user and suggest manual `.gitignore` addition.

### Note on existing .gitignore check

The current setup workflow checks if `themes/foreign-policy-2017/docs/` is in `.gitignore`. This check should be updated to also accept system exclude as a valid exclusion method. Don't require both -- either one is sufficient.

---

## Global State: Repo vs Flat File Decision

### Should `{project_root}/.fp-docs/` be a separate git repo?

**Recommendation: No. Use flat files (JSON).**

Reasons:

1. **Operational state is disposable**: Operation logs, trackers, and caches are working data. Losing them is inconvenient but not catastrophic -- state can be regenerated from git history (as `seedFromGitHistory()` already does).

2. **No meaningful merge semantics**: Git repos excel when content has meaningful merge/diff semantics. JSON state files with auto-generated IDs and timestamps don't benefit from version history.

3. **Complexity cost**: A fourth git repo adds cognitive overhead (three is already the project's pain point). Every sync operation would need to handle 4 repos instead of 3.

4. **Cross-branch sharing**: The whole point of `{project_root}/.fp-docs/` is that it persists across branch switches. A git repo would either need its own branch management (defeating the purpose) or stay on a single branch (in which case plain files are simpler).

5. **Multi-user handled by file system**: If multiple users work on the same codebase, each has their own clone with their own `.fp-docs/`. There's no need to synchronize operational state between users.

### Should we use SQLite?

**Recommendation: No. Keep flat JSON files.**

Reasons:

1. **Current data volumes are tiny**: The operation log is capped at 100 entries. Trackers are capped at 200. Merge candidates will rarely exceed 20. JSON is fine at this scale.

2. **Node.js SQLite requires native bindings**: The project's constraint is "zero external dependencies -- Node.js built-ins only." SQLite would break this. Node.js 22+ has built-in `node:sqlite` but it's experimental and the runtime version can't be guaranteed.

3. **JSON is debuggable**: Users can `cat state.json` to see what's happening. SQLite requires tooling.

4. **Atomic writes are already handled**: The `writeState()` pattern (write to `.tmp`, rename) gives POSIX atomicity. This is sufficient for single-user concurrent access.

5. **If scale becomes a problem later**: The abstraction layer (loadState/writeState in state.cjs) means we can swap the backend later without changing callers. Design for today's known volumes.

---

## Impact Matrix

### CJS Modules Requiring Path Updates

| Module | Current Path | New Path | Change Type |
|--------|-------------|----------|-------------|
| `lib/state.cjs` | `{docs-root}/.fp-docs/state.json` | `{project_root}/.fp-docs/state.json` | Path change |
| `lib/state.cjs` | `{docs-root}/.fp-docs/remediation-plans/` | `{project_root}/.fp-docs/remediation-plans/` | Path change |
| `lib/drift.cjs` | `{docs-root}/.fp-docs/staleness.json` | `{project_root}/.fp-docs/staleness.json` | Path change |
| `lib/drift.cjs` | `{docs-root}/.fp-docs/drift-pending.json` | `{project_root}/.fp-docs/drift-pending.json` | Path change |
| `lib/tracker.cjs` | `{docs-root}/.fp-docs/trackers/` | `{project_root}/.fp-docs/trackers/` | Path change |
| `lib/plans.cjs` | `{docs-root}/.fp-docs/plans/` | `{project_root}/.fp-docs/plans/` | Path change |
| `lib/plans.cjs` | `{docs-root}/.fp-docs/analyses/` | `{project_root}/.fp-docs/analyses/` | Path change |
| `lib/update.cjs` | `{codebase-root}/.fp-docs/update-cache.json` | `{project_root}/.fp-docs/update-cache.json` | Path change (minor) |
| `lib/git.cjs` | `{docs-root}/.sync-watermark` | `{docs-root}/.fp-docs-branch/.sync-watermark` | Path change |
| `lib/paths.cjs` | (no `.fp-docs` logic) | Add `getGlobalStateRoot()` function | New function |

**Note**: `{project_root}` in the codebase context IS `{codebase-root}` (the git root of the WordPress repo). The distinction matters because `{docs-root}` is a nested path inside it.

### New function needed in `lib/paths.cjs`:

```javascript
function getGlobalStateRoot(codebaseRoot) {
  const root = codebaseRoot || getCodebaseRoot();
  if (!root) return null;
  return path.join(root, '.fp-docs');
}
```

This replaces the current pattern where each module independently constructs `path.join(docsRoot, '.fp-docs', ...)`.

### Workflow and Reference Files Requiring Updates

| File | What Changes |
|------|-------------|
| `workflows/sync.md` | Add merge intelligence step; update watermark path |
| `workflows/setup.md` | Add git exclude configuration step |
| `workflows/update.md` | Line 65: update-cache.json path reference |
| `workflows/add.md` | About.md -> README.md reference |
| `workflows/deprecate.md` | About.md -> README.md reference |
| `workflows/audit.md` | About.md -> README.md reference |
| `references/fp-project.md` | Update docs/changelog.md and FLAGGED CONCERNS paths |
| `references/git-sync-rules.md` | Update diff report path, watermark path, .gitignore mention |
| `references/changelog-rules.md` | Update docs/changelog.md path |
| `references/doc-standards.md` | Update FLAGGED CONCERNS path |
| `references/pipeline-enforcement.md` | Update docs/changelog.md path |
| `references/validation-rules.md` | Update About.md -> README.md, changelog.md path, claude-code-docs-system exclusion |
| `agents/fp-docs-indexer.md` | Line 26: claude-code-docs-system reference |

### Test Files Requiring Updates

All tests in `tests/lib/` that reference `.fp-docs/` paths need updating:
- `lib-state-tests.cjs` (state.json, remediation-plans paths)
- `lib-drift-tests.cjs` (staleness.json, drift-pending.json paths)
- `lib-plans-tests.cjs` (plans/, analyses/ paths)
- `lib-pipeline-tests.cjs` (.fp-docs dir creation)
- `lib-update-tests.cjs` (update-cache.json paths)

Test spec files:
- `tests/specs/update.md` (line 37: .fp-docs/update-cache.json reference)
- `tests/specs/remediate.md` (line 48: .fp-docs reference)

### Spec and Pattern Files Requiring Updates

- `specs/architecture.md` -- directory layout tree, file paths
- `specs/features-and-capabilities.md` -- sync workflow description, pipeline paths
- `specs/usage-and-workflows.md` -- sync workflow, file paths, gotchas
- `specs/patterns/cjs-implementation-spec.md` -- line 77: .fp-docs reference
- `specs/patterns/tracker-doc.md` -- 4 .fp-docs references

### Other Files Requiring Updates

- `README.md` (plugin root) -- references to docs/diffs/, About.md, framework/
- `config.json` -- no changes needed (paths are resolved at runtime, not hardcoded in config)
- `templates/fp-docs-statusline.js` -- update-cache.json path resolution

---

## Migration Considerations

### Data Migration on First Run

When the new code runs against a project with old-layout data:

1. **State migration**: If `{docs-root}/.fp-docs/state.json` exists but `{project_root}/.fp-docs/state.json` doesn't, copy it over.
2. **Branch data migration**: If `docs/diffs/`, `docs/FLAGGED CONCERNS/`, `docs/changelog.md` exist in old locations, move them to `.fp-docs-branch/`.
3. **Watermark migration**: If `docs/.sync-watermark` exists, move to `.fp-docs-branch/`.
4. **Cleanup**: After migration, remove old `.fp-docs/` from docs root (but only after confirming new location has data).

This should be implemented as a migration check in the SessionStart hook or in `/fp-docs:setup`.

### Version Tracking

The new `plugin-version.json` in `.fp-docs-branch/` enables future migrations:
- On session start, check if branch's recorded plugin version < current version
- If so, run migration steps for that version delta
- Update plugin-version.json after migration

---

## Summary of Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Global state location | `{project_root}/.fp-docs/` | Persists across branches, single source of truth |
| Separate git repo for state? | No | Disposable data, no merge semantics, complexity cost |
| SQLite? | No | Tiny data volumes, zero-dependency constraint, JSON is debuggable |
| Git exclusion method | `.git/info/exclude` | Branch-safe, no codebase commits, multi-user compatible |
| Branch-scoped data location | `{docs-root}/.fp-docs-branch/` | Travels with branch, clear naming |
| Plugin cache location | `.claude/.fp-docs-project/` | Clear distinction from user state |
