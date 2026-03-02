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
1. Detect codebase branch name
2. Check if docs repo has a branch with the same name
3. If no matching branch exists:
   a. Create it from docs `master`
   b. Switch to it
4. If matching branch exists but docs is on a different branch:
   a. Switch docs to the matching branch
5. Run diff report generation

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

### Committing to Docs Repo

All doc-modifying operations (revise, add, auto-update, etc.) should commit their changes to the docs repo on the current docs branch:

```bash
cd {docs-root}
git add -A
git commit -m "fp-docs: {operation} — {summary of changes}"
```

This happens at the END of the post-modification pipeline, AFTER changelog update.

## Merge Flow

When a codebase branch merges to master:
1. Switch docs repo to the matching feature branch
2. Merge docs feature branch into docs master
3. Push docs master
4. Delete the docs feature branch (cleanup)

This is currently manual/plugin-assisted via `/fp-docs:sync merge`.
