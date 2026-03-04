# Git Sync Rules

## Three-Repo Architecture

The fp-docs system operates across three independent git repositories:

1. **Codebase repo** — git root at wp-content/
   - The FP WordPress codebase
   - Docs-relevant code scoped to themes/foreign-policy-2017/

2. **Docs repo** — git root at themes/foreign-policy-2017/docs/
   - Nested INSIDE the codebase workspace but tracked independently
   - Codebase repo gitignores this path

3. **Plugin repo** — standalone at the plugin install location
   - This plugin. Not nested in either repo.

## Remote Origin as Source of Truth

Remote origin is the authoritative source for the docs repo. All local work must incorporate remote changes before starting and push results after completing.

### Lifecycle
Every docs-modifying session follows this remote sync lifecycle:
1. **Verify** — confirm remote origin is accessible
2. **Fetch** — `git fetch origin` to update remote tracking refs
3. **Pull** — `git pull --ff-only` to incorporate remote changes
4. **Work** — execute the documentation operation
5. **Commit** — `git add -A && git commit`
6. **Push** — `git push` to share changes with remote

### Pull Rules
- Pull always uses `--ff-only` — never create merge commits automatically
- If `--ff-only` fails (branches diverged): **halt** with diagnostic guidance showing local vs remote commit counts and resolution options
- If pull fails due to uncommitted changes: **halt** with guidance to stash or commit first
- If remote branch does not exist yet: skip pull (new branch scenario)

### Push Rules
- Push is mandatory after every commit (unless `--no-push` or `--offline`)
- Push failure: **halt** the operation with diagnostic guidance (do NOT continue silently)

### Flag Behavior

| Flag | Fetch | Pull | Work | Commit | Push |
|------|-------|------|------|--------|------|
| (default) | Yes | Yes | Yes | Yes | Yes |
| `--no-push` | Yes | Yes | Yes | Yes | **Skip** |
| `--offline` | **Skip** | **Skip** | Yes | Yes | **Skip** |

- `--offline` skips ALL remote operations (fetch, pull, push) — use for disconnected work
- `--no-push` skips push only — pull still happens to ensure local is current
- `--offline` implies `--no-push`

### Remote Accessibility
- Verified at session start by the SessionStart hook (`branch-sync-check.sh`)
- Uses `timeout 10 git ls-remote --exit-code origin HEAD`
- If unreachable: halt with diagnostic (network, VPN, GitHub status)
- If auth failure: halt with diagnostic (SSH key, token, remote URL)
- If no remote configured: warn and continue (first-time setup scenario, suggest `/fp-docs:setup`)

## Branch Mirroring Rules

### Principle
- Docs `master` = canonical docs for codebase `origin/master`
- Feature branches in docs mirror codebase feature branches
- Branch names match exactly between codebase and docs repos

### Detection
To detect codebase branch:
```bash
git -C {codebase-root} branch --show-current
```

To detect docs branch:
```bash
git -C {docs-root} branch --show-current
```

Codebase root: Traverse upward from the working directory to find
the git root containing `.gitignore` with `themes/foreign-policy-2017/docs/`.
Docs root: the `docs/` path from project-config.md resolved to absolute.

### Sync Flow
0. Verify remote is accessible (halt if not, unless `--offline`)
1. Fetch from remote: `git -C {docs-root} fetch origin`
2. Pull latest on current branch: `git -C {docs-root} pull --ff-only` (halt if diverged)
3. Detect codebase branch name
4. Check if docs repo has a branch with the same name
5. If no matching branch exists:
   a. Pull latest on master first: `git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`
   b. Create branch from master and switch to it
6. If matching branch exists but docs is on a different branch:
   a. Switch docs to the matching branch
   b. Pull latest on the target branch: `git -C {docs-root} pull --ff-only`
7. Run diff report generation

Steps 0-2 are skipped when `--offline` flag is passed.

### Diff Report Generation

**When**: On branch mismatch detection (SessionStart) or manual `/fp-docs:sync`

**Algorithm**:
1. In codebase repo: `git diff --name-only origin/master...HEAD`
2. Filter to theme-scoped files: only `themes/foreign-policy-2017/` paths
3. Map changed source files → affected doc files using source-to-docs mapping table
4. For each affected doc file, classify:
   - LIKELY STALE: source file was modified, doc may not reflect changes
   - POSSIBLY STALE: source file in same directory was modified
   - STRUCTURAL: new/deleted source files affecting doc structure
5. Write report to `docs/diffs/{YYYY-MM-DD}_{codebase-branch}_diff_report.md`

### Diff Report Format

```markdown
# Docs Diff Report

- **Codebase branch**: {branch-name}
- **Codebase divergence from master**: {N} files changed, {N} additions, {N} deletions
- **Generated**: {timestamp}

## Affected Documentation

### LIKELY STALE ({N} files)
| Doc File | Source Change | Reason |
|----------|-------------|--------|
| docs/06-helpers/posts.md | helpers/posts.php modified | Direct source file changed |

### POSSIBLY STALE ({N} files)
| Doc File | Source Change | Reason |
|----------|-------------|--------|

### STRUCTURAL CHANGES ({N} items)
| Change | Source | Impact |
|--------|--------|--------|
| New file | helpers/new-feature.php | Needs new doc: docs/06-helpers/new-feature.md |
| Deleted | helpers/old-feature.php | Doc may need deprecation |

## Recommended Actions
- [ ] Review and update LIKELY STALE docs
- [ ] Check POSSIBLY STALE docs for relevance
- [ ] Handle STRUCTURAL CHANGES (add/deprecate docs)
```

### Committing and Pushing to Docs Repo

All doc-modifying operations (revise, add, auto-update, etc.) should commit and push their changes to the docs repo on the current docs branch:

```bash
cd {docs-root}
# Pull before commit (unless --offline)
git fetch origin && git pull --ff-only
# Commit
git add -A
git commit -m "fp-docs: {operation} — {summary of changes}"
# Push (unless --no-push or --offline)
git push
```

This happens at the END of the post-modification pipeline, AFTER changelog update.

Remote sync behavior:
- Default: pull before commit, push after commit
- `--no-push` flag: suppresses push only (pull still happens)
- `--offline` flag: skips all remote operations (fetch, pull, push)
- Pull failure (diverged): **halt** the operation with diagnostic guidance
- Push failure: **halt** the operation with diagnostic guidance
- No remote configured: warn and skip remote operations (suggest `/fp-docs:setup`)

## Merge Flow

When a codebase branch merges to master:
1. Fetch from remote: `git -C {docs-root} fetch origin` (skip if `--offline`)
2. Pull latest on both branches before merge (skip if `--offline`):
   a. `git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`
   b. `git -C {docs-root} checkout {feature-branch} && git -C {docs-root} pull --ff-only`
3. Switch docs repo to master
4. Merge docs feature branch into docs master
5. Push docs master (skip if `--no-push` or `--offline`; push failure **halts** with diagnostics)
6. Delete the docs feature branch (cleanup)
