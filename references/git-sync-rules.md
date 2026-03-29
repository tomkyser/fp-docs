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

**Phase 1 — Remote sync** (skipped when `--offline`):
0. Verify remote is accessible (halt if not, unless `--offline`)
1. Fetch from remote: `git -C {docs-root} fetch origin`
2. Pull latest on current docs branch: `git -C {docs-root} pull --ff-only` (halt if diverged)

**Phase 2 — Branch alignment** (makes docs branch match codebase branch):
3. Detect codebase branch name
4. Check if docs repo has a branch with the same name
5. If no matching branch exists:
   a. Pull latest on master first: `git -C {docs-root} checkout master && git -C {docs-root} pull --ff-only`
   b. Create branch from master and switch to it
6. If matching branch exists but docs is on a different branch:
   a. Switch docs to the matching branch
   b. Pull latest on the target branch: `git -C {docs-root} pull --ff-only`

**Phase 3 — Change detection** (ALWAYS runs, even when branches already matched):
7. Run diff report generation using the watermark-based algorithm (see Diff Report Generation)
8. Update the watermark file with the current codebase HEAD (see Codebase Change Watermark)
9. If a diff report was generated or watermark was updated: commit changes to docs repo

Phase 3 is the critical addition. Without it, the sync command short-circuits when branches match (e.g., both on master) and never detects that new code was merged to the codebase. The watermark mechanism enables cross-repo change detection regardless of branch state.

### Codebase Change Watermark

The watermark tracks the codebase commit hash that the docs were last synced against. It solves the fundamental problem: branch-name parity (both repos on `master`) does not mean content parity (docs reflect current code). Without the watermark, there is no baseline to detect that new code was merged to the codebase since the last time docs were checked.

**File location**: `{docs-root}/.sync-watermark`

**Format** (shell-parseable, one key=value per line):
```
# fp-docs sync watermark — do not edit manually
# Records the codebase state that docs were last synced against.
codebase_branch=master
codebase_commit=abc123def456789012345678901234567890abcd
sync_timestamp=2026-03-04T10:30:00Z
```

**Lifecycle**:
1. **Created**: On the first successful `/fp-docs:sync` invocation, after diff report generation completes
2. **Read**: At the start of every sync's change detection phase (Sync Flow step 7)
3. **Updated**: After every successful change detection, with the current codebase HEAD — even when no changes are detected (timestamp advances, commit hash may or may not change)
4. **Committed**: Included in the sync operation's docs repo commit alongside any diff report. The watermark is a tracked file in the docs repo so it persists across machines and sessions.

**Validation rules**:
- Before using the watermark commit for diffing, verify it exists in codebase history: `git -C {codebase-root} cat-file -t {watermark_commit} 2>/dev/null`
- If the watermark commit is invalid (codebase was force-pushed, rebased, or the commit was garbage-collected), treat as a first-sync scenario and log the reason
- If the watermark file exists but is malformed (missing `codebase_commit` key, empty value, parse error), treat as first-sync scenario and log the reason
- A missing watermark file is normal on first sync — not an error condition

### Diff Report Generation

**When**: On every manual `/fp-docs:sync` invocation — regardless of whether branches already matched — and on branch mismatch detection during SessionStart.

**Algorithm**:

1. **Read watermark**: Parse `{docs-root}/.sync-watermark` if it exists. Extract `codebase_commit` value.

2. **Get current codebase state**:
   ```bash
   CODEBASE_HEAD=$(git -C {codebase-root} rev-parse HEAD)
   CODEBASE_BRANCH=$(git -C {codebase-root} branch --show-current)
   ```

3. **Determine diff baseline** (three scenarios):

   **a. Valid watermark exists** (file present, `codebase_commit` is non-empty, and the commit exists in codebase history):
   - If `{watermark_commit}` == `{CODEBASE_HEAD}`: no codebase changes since last sync. Report "No codebase changes since last sync ({watermark_commit_short})" — skip steps 5-8, proceed to watermark timestamp update only.
   - Otherwise, compute diff:
     ```bash
     git -C {codebase-root} diff --name-only {watermark_commit}...{CODEBASE_HEAD}
     ```
   - This detects ALL codebase changes since the last sync, on any branch, including new commits merged to master.

   **b. No valid watermark, on a feature branch** (not master/main):
   - Fall back to comparing the feature branch against its merge base with master:
     ```bash
     git -C {codebase-root} diff --name-only origin/master...HEAD
     ```
   - This shows all files changed on the feature branch relative to master.

   **c. No valid watermark, on master/main** (first-ever sync on master):
   - No commit-based diff baseline is available.
   - Instead: enumerate all source directories from the source-to-doc mapping (`source-map.json`, queried via `node {plugin-root}/fp-tools.cjs source-map dump`).
   - For each mapped source directory that exists, list all files within it.
   - Mark all as NEEDS INITIAL REVIEW in the report (one-time bootstrap).
   - Log: "First sync on master — no watermark baseline. Performing initial source scan."

4. **Early exit check**: If step 3a determined no changes, update the watermark timestamp and report "No codebase changes since last sync." Do not generate a diff report file. Stop here.

5. **Filter to theme scope**: From the diff results, keep only paths under `themes/foreign-policy-2017/`.

6. **Map to documentation**: Using the source-to-doc mapping from `source-map.json` (query via `node {plugin-root}/fp-tools.cjs source-map lookup <path>`), map each changed source file to its corresponding doc file(s).

7. **Classify staleness** for each affected doc file:
   - **LIKELY STALE**: The doc's direct source file was modified (e.g., `helpers/posts.php` changed → `docs/06-helpers/posts.md` is likely stale)
   - **POSSIBLY STALE**: A source file in the same mapped directory was modified (sibling file change)
   - **STRUCTURAL**: A source file was added or deleted, affecting doc structure (needs new doc, or existing doc may need deprecation)

8. **Write diff report** to `docs/diffs/{YYYY-MM-DD}_{codebase-branch}_diff_report.md`

9. **Update watermark**: Write the current codebase HEAD, branch, and timestamp to `{docs-root}/.sync-watermark` (see Codebase Change Watermark for format). This happens regardless of whether a diff report was generated — the watermark always advances to record that a sync check was performed.

### Diff Report Format

```markdown
# Docs Diff Report

- **Codebase branch**: {branch-name}
- **Sync baseline**: {watermark-commit-short} → {HEAD-short} | "initial sync (no prior watermark)"
- **Commits since last sync**: {N} | "N/A (initial sync)"
- **Files changed in codebase**: {N} files
- **Generated**: {YYYY-MM-DD HH:MM:SS}

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
- [ ] Run `/fp-docs:auto-update` to batch-process affected docs
```

For the initial-scan scenario (first sync on master, no watermark), use this variant header:

```markdown
# Docs Diff Report — Initial Sync

- **Codebase branch**: master
- **Sync baseline**: initial sync (no prior watermark)
- **Source directories scanned**: {N}
- **Generated**: {YYYY-MM-DD HH:MM:SS}

## NEEDS INITIAL REVIEW ({N} source paths)
| Source Directory | Mapped Doc Target | Files |
|----------------|-------------------|-------|
| helpers/ | docs/06-helpers/ | {N} files |
| components/ | docs/05-components/ | {N} files |

## Recommended Actions
- [ ] Run `/fp-docs:audit` on each mapped doc directory
- [ ] Run `/fp-docs:auto-update` to detect and apply needed updates
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
