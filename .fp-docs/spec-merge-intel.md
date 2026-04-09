# Implementation Spec: lib/merge-intel.cjs

> Author: Architect
> Date: 2026-04-09
> Status: Implementation-ready
> Depends on: design-wave1-phase1.md (section C)

---

## Module Identity

```
File: lib/merge-intel.cjs
CLI: fp-tools merge-intel <scan|status|history|clear>
Dependencies: core.cjs, paths.cjs, git.cjs (gitExec, getCurrentBranch)
Zero external dependencies -- Node.js built-ins only.
```

## Constants

```javascript
const MERGE_INTEL_DIR = 'merge-intel';
const CANDIDATES_FILE = 'candidates.json';
const HISTORY_FILE = 'history.json';
const MAX_MERGE_LOOKBACK = 20;  // how many merge commits to scan
const MAX_HISTORY_ENTRIES = 100; // auto-prune history
```

## Path Resolution

All merge-intel data lives under `{project_root}/.fp-docs/merge-intel/`:

```javascript
function getMergeIntelDir() {
  const codebaseRoot = getCodebaseRoot();
  if (!codebaseRoot) return null;
  return path.join(codebaseRoot, '.fp-docs', MERGE_INTEL_DIR);
}
```

## Data Schemas

### candidates.json

```json
{
  "version": 1,
  "last_scan": "ISO-8601",
  "codebase_branch": "master",
  "candidates": [
    {
      "codebase_branch": "feature/new-widget",
      "docs_branch": "feature/new-widget",
      "merge_commit": "abc1234def5678...",
      "merge_date": "ISO-8601",
      "docs_last_commit": "def5678abc1234...",
      "docs_last_date": "ISO-8601",
      "codebase_last_date": "ISO-8601",
      "status": "current|stale|conflicted|orphaned",
      "staleness_commits": 0,
      "action": null,
      "action_date": null
    }
  ]
}
```

### history.json

```json
{
  "version": 1,
  "decisions": [
    {
      "codebase_branch": "feature/new-widget",
      "docs_branch": "feature/new-widget",
      "action": "merged|skipped|deferred",
      "was_stale": false,
      "date": "ISO-8601",
      "merge_commit": "full-hash",
      "notes": ""
    }
  ]
}
```

## Exported Functions

### 1. detectMergedBranches(codebaseRoot)

Purpose: Find branches recently merged into the current branch (typically master).

```javascript
/**
 * Detect recently merged branches from git merge commits.
 *
 * Parses `git log --merges --first-parent` output to extract branch names
 * from merge commit subjects. Handles both standard merge subjects and
 * GitHub PR merge subjects.
 *
 * @param {string} codebaseRoot - Absolute path to codebase git root
 * @param {object} [opts]
 * @param {number} [opts.lookback=20] - Number of merge commits to scan
 * @returns {Array<{branch: string, merge_commit: string, merge_date: string}>}
 */
```

Implementation notes:
- Use `gitExec(codebaseRoot, ['log', '--merges', '--first-parent', '-n', String(lookback), '--format=%H|%aI|%s'])` 
- Parse subject patterns:
  - `Merge branch '(.+?)'` -- standard git merge
  - `Merge pull request #\d+ from \S+/(.+)` -- GitHub PR merge
  - `Merge (.+?) into` -- alternative merge format
- Filter out: `master`, `main`, `dev`, `develop` (merging these into themselves is noise)
- Return deduplicated by branch name (keep most recent)

### 2. findMatchingDocsBranches(docsRoot, branches)

Purpose: Check which detected branches have corresponding docs branches.

```javascript
/**
 * Check for docs branches matching detected codebase merge branches.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {Array<{branch: string, merge_commit: string, merge_date: string}>} branches
 * @returns {Array<{branch: string, merge_commit: string, merge_date: string, docs_exists: boolean}>}
 */
```

Implementation notes:
- Use `gitExec(docsRoot, ['branch', '--list', branch])` for each candidate
- Also check remote branches: `gitExec(docsRoot, ['branch', '-r', '--list', 'origin/' + branch])`
- Mark `docs_exists: true` if local or remote branch found
- Only return entries where `docs_exists === true`

### 3. assessStaleness(docsRoot, codebaseRoot, candidates)

Purpose: Determine if each candidate's docs are current or stale.

```javascript
/**
 * Assess staleness of docs branches relative to their codebase merge points.
 *
 * For each candidate:
 * - Gets the last commit date on the docs branch
 * - Gets the last commit date on the codebase branch (before merge)
 * - Compares timestamps to determine current vs stale
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} codebaseRoot - Absolute path to codebase git root  
 * @param {Array<{branch: string, merge_commit: string, merge_date: string}>} candidates
 * @returns {Array<{...candidate, docs_last_commit: string, docs_last_date: string, codebase_last_date: string, status: string, staleness_commits: number}>}
 */
```

Implementation notes:
- Docs last commit: `gitExec(docsRoot, ['log', '-1', '--format=%H|%aI', branch])`
- Codebase last commit before merge: `gitExec(codebaseRoot, ['log', '-1', '--format=%aI', merge_commit + '^2'])` (second parent = merged branch tip)
- If `^2` fails (squash merge, no second parent): use `gitExec(codebaseRoot, ['log', '-1', '--format=%aI', merge_commit + '~1'])` and note as estimated
- Status logic:
  - `docs_last_date >= codebase_last_date` => `"current"` 
  - `docs_last_date < codebase_last_date` => `"stale"`
- Count staleness commits: `gitExec(docsRoot, ['rev-list', '--count', docs_last_commit + '..origin/' + branch])` (if remote exists)

### 4. executeMerge(docsRoot, branch, opts)

Purpose: Merge a single docs branch into the current docs branch (typically master).

```javascript
/**
 * Merge a docs branch into the current docs branch.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} branch - Branch name to merge
 * @param {object} [opts]
 * @param {boolean} [opts.noPush=false] - Skip push after merge
 * @param {boolean} [opts.deleteBranch=true] - Delete branch after successful merge
 * @returns {{ success: boolean, merged: boolean, conflicts: boolean, message: string }}
 */
```

Implementation notes:
- `gitExec(docsRoot, ['merge', branch, '--no-edit'])`
- On conflict: `gitExec(docsRoot, ['merge', '--abort'])`, return `{ success: false, conflicts: true }`
- On success + !noPush: `gitExec(docsRoot, ['push'])`
- On success + deleteBranch: `gitExec(docsRoot, ['branch', '-d', branch])`
- Never force-delete (`-D`). If `-d` fails, branch has unmerged commits -- warn but don't force.

### 5. scanAndReport(docsRoot, codebaseRoot, opts)

Purpose: Full scan pipeline -- detect, match, assess, return structured report.

```javascript
/**
 * Run the complete merge intelligence scan.
 * Called by sync workflow when codebase is on master.
 *
 * @param {string} docsRoot - Absolute path to docs git root
 * @param {string} codebaseRoot - Absolute path to codebase git root
 * @param {object} [opts]
 * @param {boolean} [opts.offline=false] - Skip remote operations
 * @param {number} [opts.lookback=20] - Merge commit lookback count
 * @returns {{ scanned: boolean, candidates: Array, auto_merge: Array, needs_review: Array, errors: Array }}
 */
```

Implementation notes:
- Check current codebase branch is master/main first; if not, return `{ scanned: false, reason: 'not on master' }`
- Run steps 1-3 sequentially
- Partition candidates into `auto_merge` (status=current) and `needs_review` (status=stale/conflicted)
- Save results to candidates.json
- Return structured report for sync workflow to display

### 6. recordDecision(branch, action, wasStale)

Purpose: Record a merge/skip/defer decision in history.json.

```javascript
/**
 * Record a merge intelligence decision in history.
 *
 * @param {string} branch - Branch name
 * @param {string} action - "merged" | "skipped" | "deferred"
 * @param {boolean} wasStale - Whether docs were stale at decision time
 * @param {string} [notes] - Optional notes
 */
```

### 7. loadCandidates() / loadHistory()

Standard load functions matching state.cjs pattern (safeReadFile + safeJsonParse + defaults).

## CLI Handler

```javascript
function cmdMergeIntel(subcommand, args, raw) {
  switch (subcommand) {
    case 'scan':    // Run scanAndReport, output result
    case 'status':  // Load and display current candidates.json
    case 'history': // Load and display history.json (last N, default 10)
    case 'clear':   // Delete candidates.json (not history)
  }
}
```

## fp-tools.cjs Integration

Add to `fp-tools.cjs`:

```javascript
case 'merge-intel': {
  const mergeIntel = require('./lib/merge-intel.cjs');
  mergeIntel.cmdMergeIntel(args[1], args.slice(2), raw);
  break;
}
```

## Sync Workflow Integration

In `workflows/sync.md`, add between step 2 (default sync) and step 3 (merge sync):

```xml
<step name="merge-intelligence" condition="codebase-on-master-and-no-merge-arg">
## 2.5. Merge Intelligence

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" merge-intel scan`
2. Parse result JSON
3. For each `auto_merge` candidate:
   a. Display: "Auto-merging docs from {branch} (docs are current)"
   b. Run: merge via merge-intel module
   c. Record decision
4. For each `needs_review` candidate:
   a. Display: "{branch}: docs last updated {date}, codebase had {N} commits after. Merge anyway? [y/n/inspect]"
   b. If user approves: merge and record
   c. If user skips: record as skipped
   d. If user inspects: show diff summary, re-prompt
5. Report summary: "Merged {N} branches, {M} deferred, {K} skipped"
</step>
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Not on master | Skip scan, return `{ scanned: false }` |
| No merge commits found | Return empty candidates |
| Git command fails for single branch | Skip that branch, continue, add to errors array |
| Merge conflict | Abort merge, mark as conflicted, report to user |
| No docs repo | Error via core.error() |
| Remote unreachable | Use local branches only if --offline, otherwise warn |

## Test Scenarios

1. **No merge commits**: Empty codebase history -> empty scan result
2. **Merge with matching docs branch (current)**: Status = current, auto_merge list populated
3. **Merge with matching docs branch (stale)**: Status = stale, needs_review list populated
4. **Merge with no matching docs branch**: Filtered out (not in candidates)
5. **Squash merge (no ^2 parent)**: Falls back to estimated date, still classifies
6. **Merge conflict during execution**: Abort, mark conflicted, no data loss
7. **Multiple merges, mixed staleness**: Correct partition into auto_merge/needs_review
8. **Not on master**: Scan skipped with reason
9. **History recording**: Decisions persisted and retrievable
10. **History pruning**: At MAX_HISTORY_ENTRIES, oldest entries dropped
