# fp-docs Plugin — Update Plan: Three-Repo Architecture & Git Sync

> **Purpose**: Addendum to `implementation-plan.md`. Covers relocating the plugin source, initializing both repos, and adding branch mirroring + diff report capabilities.
> **Strategy**: Agile — parallel workstreams where possible, incremental delivery.
> **Pre-requisite**: The 81-file plugin is already built at `wp-content/fp-docs-system/`.

---

## Context

The original implementation plan assumed a single-repo model. This update adds:

1. **Plugin source relocation** — out of the codebase entirely, into a dedicated plugins directory
2. **Plugin git repo** — `https://github.com/tomkyser/fp-docs` (public)
3. **Docs git repo** — `https://github.com/tomkyser/docs-foreignpolicy-com` (private)
4. **Branch mirroring** — plugin manages docs branches to mirror codebase branches
5. **Diff reports** — auto-generated when docs branch state doesn't match codebase branch
6. **Two-repo git awareness** — all engines understand docs/ is a separate git repo

---

## Workstream A: Relocate & Initialize Repos

These steps happen ONCE and establish the three-repo foundation.

### A1. Move Plugin Source

**From**: `/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/wp-content/fp-docs-system/`
**To**: `/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs/`

```bash
# Move the built plugin to its permanent home
mv "/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/wp-content/fp-docs-system" \
   "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs"
```

After this, the plugin is loaded via:
```bash
claude --plugin-dir "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs"
```

### A2. Initialize Plugin Git Repo

```bash
cd "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs"
git init
git remote add origin https://github.com/tomkyser/fp-docs.git

# Create .gitignore for the plugin repo
cat > .gitignore << 'EOF'
.DS_Store
*.swp
*.swo
*~
.env
EOF

git add -A
git commit -m "Initial commit: fp-docs plugin v2.0.0 — 81 files, 8 engines, 18 commands"
git branch -M master
git push -u origin master
```

### A3. Initialize Docs Git Repo

The docs content currently lives at `themes/foreign-policy-2017/docs/` inside the codebase repo. It needs to become its own repo AT THE SAME PATH.

**Strategy**: Extract docs from codebase tracking, init as standalone repo, push to remote.

```bash
DOCS_PATH="/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/wp-content/themes/foreign-policy-2017/docs"

cd "$DOCS_PATH"

# Init a new git repo right where the docs live
git init
git remote add origin https://github.com/tomkyser/docs-foreignpolicy-com.git

# Create .gitignore for the docs repo
cat > .gitignore << 'EOF'
.DS_Store
*.swp
*~
EOF

# Create the diffs directory for branch diff reports
mkdir -p diffs

# Add and commit all existing docs content
git add -A
git commit -m "Initial commit: FP developer documentation — 364 files across 24 sections"
git branch -M master
git push -u origin master
```

### A4. Update Codebase .gitignore

Add the docs path to the codebase repo's gitignore so the nested docs repo is independent.

**File**: `/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/wp-content/.gitignore`

Add this line:
```
themes/foreign-policy-2017/docs/
```

> **Note**: After adding this gitignore entry, the docs files will appear as "deleted" in the codebase repo's git status. This is expected — they're now tracked by their own repo. Commit this gitignore change to the codebase repo.

### A5. Remove Old Plugin Location

After confirming the plugin works from `cc-plugins/fp-docs`:

```bash
rm -rf "/Users/tom.kyser/FP LOCAL DEV/foreignpolicy.com/wordpress/wp-content/fp-docs-system"
```

---

## Workstream B: Plugin Updates — Git Sync System

These changes add three-repo awareness and branch mirroring to the plugin. All file paths are relative to the plugin root (`cc-plugins/fp-docs/`).

### B1. New File: `framework/modules/git-sync-rules.md`

**Purpose**: Branch mirroring logic, diff report format, two-repo detection rules.

```markdown
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
```

**Estimated size**: ~120 lines

### B2. New File: `scripts/branch-sync-check.sh`

**Purpose**: SessionStart hook script that detects branch mismatch and warns user.

```bash
#!/bin/bash
# SessionStart: Detect codebase branch, compare with docs branch, warn on mismatch
# Runs AFTER inject-manifest.sh
# Output: JSON with additionalContext (branch info) and optional stopMessage

# Find codebase root (wp-content/)
CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$CODEBASE_ROOT" ]; then
  exit 0  # Not in a git repo, skip silently
fi

# Resolve docs path
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"
if [ ! -d "${DOCS_ROOT}/.git" ]; then
  # Docs repo not set up — not an error, just skip
  cat <<EOF
{
  "additionalContext": "Docs repo not detected at ${DOCS_ROOT}. Run /fp-docs:setup to initialize."
}
EOF
  exit 0
fi

# Get branch names
CODEBASE_BRANCH=$(git -C "${CODEBASE_ROOT}" branch --show-current 2>/dev/null)
DOCS_BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current 2>/dev/null)

if [ "$CODEBASE_BRANCH" = "$DOCS_BRANCH" ]; then
  # Branches match — inject context and proceed
  cat <<EOF
{
  "additionalContext": "Repos synced. Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Docs git root: ${DOCS_ROOT}"
}
EOF
  exit 0
else
  # Branch mismatch — warn user
  cat <<EOF
{
  "additionalContext": "BRANCH MISMATCH — Codebase: ${CODEBASE_BRANCH}, Docs: ${DOCS_BRANCH}. Run /fp-docs:sync to align. Docs git root: ${DOCS_ROOT}",
  "stopMessage": "Docs branch '${DOCS_BRANCH}' does not match codebase branch '${CODEBASE_BRANCH}'. Run /fp-docs:sync to create/switch the docs branch and generate a diff report. Or continue if you want to work on docs independently."
}
EOF
  exit 0
fi
```

### B3. New File: `skills/sync/SKILL.md`

**Purpose**: Manual branch sync command.

```yaml
---
name: sync
description: Synchronize the docs repo branch with the codebase branch. Creates or switches docs branches, generates diff reports, and optionally merges docs branches.
argument-hint: "[merge] [--force]"
context: fork
agent: docs-system
---
```

Body:
```markdown
Operation: sync

Read the git sync rules at `framework/modules/git-sync-rules.md` and follow the sync flow.

Context about current branch state is available in your session context (injected by SessionStart hook).

Subcommands:
- (no args): Detect branches, create/switch docs branch to match codebase, generate diff report
- merge: Merge current docs feature branch into docs master, push, clean up
- --force: Force branch switch even if there are uncommitted docs changes

$ARGUMENTS
```

### B4. New File: `scripts/docs-commit.sh`

**Purpose**: Utility script called by engines to commit changes to the docs repo.

```bash
#!/bin/bash
# Commit docs changes to the docs repo on the current branch
# Usage: bash docs-commit.sh "commit message"
# Called by engines after pipeline completion

CODEBASE_ROOT=$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null)
DOCS_ROOT="${CODEBASE_ROOT}/themes/foreign-policy-2017/docs"

if [ ! -d "${DOCS_ROOT}/.git" ]; then
  echo "Error: Docs repo not found at ${DOCS_ROOT}" >&2
  exit 1
fi

COMMIT_MSG="${1:-fp-docs: automated update}"
BRANCH=$(git -C "${DOCS_ROOT}" branch --show-current)

cd "${DOCS_ROOT}"
git add -A
if git diff --cached --quiet; then
  echo "No docs changes to commit."
  exit 0
fi

git commit -m "${COMMIT_MSG}"
echo "Committed to docs repo (branch: ${BRANCH}): ${COMMIT_MSG}"
```

### B5. Modify: `hooks/hooks.json`

Add the branch sync check hook to SessionStart (runs after manifest injection).

**Change**: Add a second hook entry under SessionStart.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-manifest.sh"
          },
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/branch-sync-check.sh"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "docs-modify",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/post-modify-check.sh"
          }
        ]
      }
    ],
    "TeammateIdle": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/teammate-idle-check.sh"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/task-completed-check.sh"
          }
        ]
      }
    ]
  }
}
```

### B6. Modify: `framework/config/project-config.md`

Add repo configuration section.

**Append** to existing file:

```markdown
## Repository Configuration

### Codebase Repo
- Git root: wp-content/ (relative to workspace)
- Docs-relevant scope: themes/foreign-policy-2017/
- Remote: origin (VIP Go deployment repo)

### Docs Repo
- Git root: themes/foreign-policy-2017/docs/ (nested in codebase workspace)
- Remote: https://github.com/tomkyser/docs-foreignpolicy-com
- Visibility: private
- Branch strategy: mirrors codebase branches

### Plugin Repo
- Remote: https://github.com/tomkyser/fp-docs
- Visibility: public
- Branch strategy: master for all users

### Path Resolution
- Codebase root detection: `git rev-parse --show-toplevel` from working directory
- Docs root: {codebase-root}/themes/foreign-policy-2017/docs/
- Docs is a separate git repo — use `git -C {docs-root}` for all docs git operations
- NEVER use the codebase repo's git for docs operations

### Diff Reports
- Location: docs/diffs/
- Format: {YYYY-MM-DD}_{branch-name}_diff_report.md
- Accumulate as history (do not clean up)
- Committed to docs repo on the feature branch
```

### B7. Modify: `agents/docs-system.md`

Expand the docs-system engine to handle git operations and the sync command.

**Changes to make**:

1. Add `sync` to the Operations list in Identity section
2. Add a new "#### For sync" block under Step 2 with the full sync procedure
3. Add git-awareness rules to Critical Rules:
   - "Docs is a SEPARATE git repo — always use `git -C {docs-root}` for docs git operations"
   - "Never commit to the codebase repo — only commit to the docs repo"
   - "Read `framework/modules/git-sync-rules.md` for branch mirroring rules"
4. Add `<example>` block for sync:
   ```
   <example>
   User: /fp-docs:sync
   <commentary>
   Branch sync request — detects codebase branch, creates/switches docs branch, generates diff report.
   </commentary>
   </example>
   ```

### B8. Modify: `agents/docs-modify.md`

Add docs repo commit step to the pipeline.

**Changes to make**:

1. In Step 4 (pipeline), add after Stage 7 (Index):
   ```
   ### Stage 8: Docs Repo Commit
   After pipeline completes, commit all changes to the docs repo:
   - Detect docs root: {codebase-root}/themes/foreign-policy-2017/docs/
   - Verify docs root is a git repo (has .git/)
   - If it is: stage all changes, commit with message "fp-docs: {operation} — {summary}"
   - If not: skip (docs repo not set up yet — not an error)
   ```

2. In Critical Rules, add:
   - "Docs is a SEPARATE git repo at themes/foreign-policy-2017/docs/ — commit there, not to the codebase repo"
   - "Use `git -C {docs-root}` for all docs git operations"

3. Update the pipeline completion marker to include commit:
   ```
   Pipeline complete: [...] [docs-commit: committed|skipped]
   ```

### B9. Modify: All Other Engine Agents (6 files)

For each of these agents, add two-repo awareness:
- `agents/docs-validate.md`
- `agents/docs-citations.md`
- `agents/docs-api-refs.md`
- `agents/docs-locals.md`
- `agents/docs-verbosity.md`
- `agents/docs-index.md`

**Add to each agent's system prompt** (in a "Git Awareness" section or in Critical Rules):

```markdown
## Git Awareness
The docs directory (themes/foreign-policy-2017/docs/) is a SEPARATE git repository
nested inside the codebase workspace. The codebase repo gitignores it.
- For docs git operations: `git -C {docs-root}`
- For codebase git operations: `git -C {codebase-root}`
- NEVER mix them up
```

For engines that modify docs (citations, api-refs, locals, index), also add the Stage 8 commit step to their pipeline.

### B10. Modify: `skills/setup/SKILL.md`

Expand setup to handle docs repo initialization and three-repo verification.

Replace the current body with:

```markdown
Operation: setup

Verify AND initialize the fp-docs system:

### Phase 1: Plugin Verification (existing)
1. Check all required directories exist (agents/, skills/, hooks/, scripts/, framework/)
2. Validate plugin.json manifest
3. Verify all 8 engine agent files exist
4. Verify all 18 user skill files exist + 10 shared modules
5. Verify hooks.json and hook scripts

### Phase 2: Docs Repo Setup (new)
1. Detect codebase root: `git rev-parse --show-toplevel`
2. Check if docs repo exists at {codebase-root}/themes/foreign-policy-2017/docs/.git
3. If docs repo NOT found:
   a. Ask user: "The docs repo is not set up. Clone it now? (requires git access to https://github.com/tomkyser/docs-foreignpolicy-com)"
   b. If yes: `git clone https://github.com/tomkyser/docs-foreignpolicy-com {codebase-root}/themes/foreign-policy-2017/docs`
   c. If no: note as "docs repo not configured" and continue
4. If docs repo found: verify remote URL and branch state

### Phase 3: Codebase Gitignore Check (new)
1. Check if `themes/foreign-policy-2017/docs/` is in the codebase repo's .gitignore
2. If NOT present: warn user and offer to add it
3. If present: confirm

### Phase 4: Branch Sync (new)
1. If docs repo is set up: detect codebase branch and docs branch
2. If mismatched: offer to run sync
3. Report overall three-repo health

$ARGUMENTS
```

### B11. Modify: `skills/docs-mod-pipeline/SKILL.md`

Add Stage 8 (Docs Repo Commit) to the pipeline definition.

**Add after Stage 7**:

```markdown
### Stage 8: Docs Repo Commit

Commit all pipeline changes to the docs repo:
1. Detect docs root from project-config (themes/foreign-policy-2017/docs/)
2. Check if docs root has a .git/ directory
3. If yes:
   - `git -C {docs-root} add -A`
   - `git -C {docs-root} commit -m "fp-docs: {operation} — {summary}"`
4. If no: skip (docs repo not initialized)

Skip condition: NEVER skip — always attempt if docs repo exists.
```

**Update Pipeline Trigger Matrix**: Add "Stage 8" to all operation rows that currently run Stage 7.

**Update Pipeline Completion Marker**:
```
Pipeline complete: [...] [changelog: updated] [index: ...] [docs-commit: committed|skipped]
```

### B12. Modify: `framework/manifest.md`

Add sync command and git-sync module to the manifest.

**Add to Commands table**:
```
| /fp-docs:sync | skills/sync/SKILL.md | docs-system | sync |
```

**Add to On-Demand Framework Modules table**:
```
| Git Sync Rules | framework/modules/git-sync-rules.md | docs-system sync, SessionStart hook |
```

**Add to Hooks table**:
```
| SessionStart | (all) | scripts/branch-sync-check.sh | Detect branch mismatch |
```

**Update docs-system Operations**:
```
| docs-system | agents/docs-system.md | sonnet | update-skills, setup, sync |
```

### B13. Modify: `README.md`

Update the README to reflect three-repo architecture, new installation flow, and sync command.

**Replace entire Installation section**:

```markdown
## Installation

### Prerequisites
- Claude Code with subagent support
- Git access to https://github.com/tomkyser/docs-foreignpolicy-com (docs repo)
- FP codebase checked out at wp-content/

### Step 1: Install the Plugin
```bash
# Clone the plugin to your local plugins directory
git clone https://github.com/tomkyser/fp-docs.git /path/to/your/plugins/fp-docs

# Load the plugin
claude --plugin-dir /path/to/your/plugins/fp-docs
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
```

**Add to Commands table (System section)**:
```
| `/fp-docs:sync` | Sync docs branch with codebase branch, generate diff reports |
```

**Update Architecture section** — add a "Three-Repo Model" subsection:

```markdown
### Three-Repo Model
- **Codebase** (wp-content/) — source code, gitignores docs/
- **Docs** (themes/foreign-policy-2017/docs/) — nested repo, branch-mirrored
- **Plugin** (standalone) — installed separately, one version for all team members
```

### B14. Modify: `plugin.json`

Bump version to reflect the architectural update.

```json
{
  "name": "fp-docs",
  "version": "2.1.0",
  "description": "Documentation management system for the Foreign Policy WordPress codebase. Three-repo architecture with branch mirroring, 8 engine agents, 19 user commands.",
  "author": {
    "name": "FP Dev Team"
  }
}
```

---

## Workstream C: Documentation Content Repo Prep

### C1. Create `docs/diffs/.gitkeep`

Ensure the diffs directory exists in the docs repo even when empty.

```bash
touch docs/diffs/.gitkeep
git -C docs/ add diffs/.gitkeep
git -C docs/ commit -m "Add diffs directory for branch diff reports"
```

### C2. Remove System Files from Docs Repo

After the plugin is working, these files should be removed from the docs repo since they now live in the plugin:

**Remove from docs repo** (they've been migrated to the plugin):
- `docs/claude-code-docs-system/docs-system.md`
- `docs/claude-code-docs-system/docs-standards.md`
- `docs/claude-code-docs-system/docs-system-config.md`
- `docs/claude-code-docs-system/docs-verbosity-engine.md`
- `docs/claude-code-docs-system/docs-commands-list.md`
- `docs/claude-code-docs-system/instructions/` (entire directory)
- `docs/claude-code-docs-system/update-plans/` (archive or remove)

**Keep in docs repo**:
- `docs/claude-code-docs-system/PROJECT-INDEX.md` (engines read it here)
- `docs/changelog.md`
- `docs/needs-revision-tracker.md`
- `docs/FLAGGED CONCERNS/`
- `docs/About.md`
- All content files (00-23 sections, appendices)

**Decision point**: Keep `docs-prompts.md` and `docs-management.md`? These are 1.0 command references. Suggest removing `docs-management.md` (replaced by plugin README) and archiving `docs-prompts.md` to an appendix.

### C3. Remove Old Skills from Codebase

After plugin is confirmed working:

```bash
# Remove old 1.0 skills from codebase repo
rm -rf .claude/skills/docs-*/
rm -rf .claude/skills/fp-sc/

# Remove old skill source templates
rm -rf themes/foreign-policy-2017/docs/claude-code-config/
```

---

## File Change Summary

### New Files (4)

| File | Location | Purpose |
|------|----------|---------|
| `scripts/branch-sync-check.sh` | Plugin | SessionStart branch mismatch detection |
| `scripts/docs-commit.sh` | Plugin | Utility for committing to docs repo |
| `skills/sync/SKILL.md` | Plugin | `/fp-docs:sync` branch management skill |
| `framework/modules/git-sync-rules.md` | Plugin | Branch mirroring rules, diff report format |

### Modified Files (14)

| File | Change |
|------|--------|
| `hooks/hooks.json` | Add branch-sync-check to SessionStart |
| `framework/config/project-config.md` | Add repo URLs, git paths, branch strategy |
| `agents/docs-system.md` | Add sync operation, git awareness, examples |
| `agents/docs-modify.md` | Add Stage 8 docs commit, git awareness |
| `agents/docs-validate.md` | Add git awareness section |
| `agents/docs-citations.md` | Add git awareness, Stage 8 commit |
| `agents/docs-api-refs.md` | Add git awareness, Stage 8 commit |
| `agents/docs-locals.md` | Add git awareness, Stage 8 commit |
| `agents/docs-verbosity.md` | Add git awareness section |
| `agents/docs-index.md` | Add git awareness, Stage 8 commit |
| `skills/setup/SKILL.md` | Expand with docs repo init + gitignore check |
| `skills/docs-mod-pipeline/SKILL.md` | Add Stage 8 to pipeline definition |
| `framework/manifest.md` | Add sync command, git module, update hooks table |
| `README.md` | Three-repo install flow, sync command |
| `.claude-plugin/plugin.json` | Version bump to 2.1.0 |

### Total: 4 new + 15 modified = 19 file operations

---

## Execution Order

### Phase 1: Repo Initialization (Workstream A) — DO FIRST

Sequential — each step depends on the previous:

1. **A1**: Move plugin to `cc-plugins/fp-docs/`
2. **A2**: Init plugin git repo, push to `github.com/tomkyser/fp-docs`
3. **A3**: Init docs git repo at `themes/foreign-policy-2017/docs/`, push to `github.com/tomkyser/docs-foreignpolicy-com`
4. **A4**: Add gitignore entry in codebase repo
5. **A5**: Verify plugin loads from new location

### Phase 2: Plugin Updates (Workstream B) — PARALLEL where noted

Can be done in parallel batches:

**Batch 1** (foundation — do first):
- B1: `git-sync-rules.md` (new module)
- B6: `project-config.md` (add repo config)

**Batch 2** (scripts — depends on B1):
- B2: `branch-sync-check.sh` (new script)
- B4: `docs-commit.sh` (new script)
- B5: `hooks.json` (add new hook)

**Batch 3** (engine updates — depends on B1, can run in parallel):
- B7: `docs-system.md` (add sync operation)
- B8: `docs-modify.md` (add Stage 8)
- B9: All 6 other engines (add git awareness)
- B11: `docs-mod-pipeline` (add Stage 8)

**Batch 4** (skill + manifest — depends on B7):
- B3: `skills/sync/SKILL.md` (new skill)
- B10: `skills/setup/SKILL.md` (expand)
- B12: `manifest.md` (update)

**Batch 5** (README + version — last):
- B13: `README.md`
- B14: `plugin.json` version bump

### Phase 3: Cleanup (Workstream C) — AFTER validation

Only after confirming the plugin works from its new location with branch sync:

1. C1: Create diffs/.gitkeep in docs repo
2. C2: Remove system files from docs repo
3. C3: Remove old skills from codebase repo

---

## Validation Checklist

### After Phase 1 (Repos)
- [ ] Plugin loads: `claude --plugin-dir "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs"`
- [ ] All 18 `/fp-docs:*` commands visible in `/help`
- [ ] Docs repo: `git -C themes/foreign-policy-2017/docs/ status` shows clean
- [ ] Codebase repo: docs/ no longer shows in `git status`
- [ ] Plugin repo: `git -C "/Users/tom.kyser/FP LOCAL DEV/cc-plugins/fp-docs" log` shows initial commit

### After Phase 2 (Plugin Updates)
- [ ] SessionStart detects branch mismatch and warns
- [ ] SessionStart does NOT warn when branches match
- [ ] `/fp-docs:sync` creates docs branch matching codebase branch
- [ ] `/fp-docs:sync` generates diff report at `docs/diffs/{timestamp}_{branch}.md`
- [ ] `/fp-docs:revise` commits changes to docs repo after pipeline
- [ ] `/fp-docs:setup` detects docs repo, checks gitignore, reports three-repo health
- [ ] `/fp-docs:sync merge` merges docs feature branch to master
- [ ] All engines show git awareness in their system prompts

### After Phase 3 (Cleanup)
- [ ] No system files remain in docs repo (except PROJECT-INDEX.md)
- [ ] No old 1.0 skills remain in `.claude/skills/`
- [ ] `docs/diffs/` directory exists in docs repo
- [ ] Plugin README has correct three-repo install instructions

---

## Team Onboarding Instructions (to include in README)

```markdown
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
```
