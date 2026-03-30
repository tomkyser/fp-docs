# CJS Implementation Spec -- Round 2 New Modules

> Implementation specification for Kai (Engineer).
> Created: 2026-03-30 (Round 2, Phase 1)
> References: scope-assessment.md, tracker-doc.md

This document specifies the CJS modules, fp-tools.cjs routes, and config.json additions needed for the dynamic delegation infrastructure.

---

## Module 1: `lib/scope-assess.cjs`

### Exports

```js
module.exports = {
  assess,        // Main assessment function
  cmdScopeAssess // CLI handler for fp-tools.cjs
};
```

### `assess(command, arguments)` -> assessmentResult

Core function. Returns the scope assessment JSON defined in `scope-assessment.md`.

**Implementation steps:**

1. Call `buildCommonContext(command)` from `init.cjs` (reuse, don't duplicate)
2. Call `getFeatureFlags()` from `init.cjs`
3. If `scope_assess.enabled` is false or command type is read/admin/meta: return default light payload
4. Parse `arguments` for explicit file paths (regex: paths ending in `.md`, `.php`, `/`)
5. For each explicit path: call `source-map.cjs` `lookup()` or `reverseLookup()` to resolve targets
6. For `auto-update`: run `git diff --name-only` against docs root, filter through source-map
7. For `auto-revise`: count pending items in needs-revision-tracker.md
8. Count files, count sections (unique section prefixes like `02-`, `06-`), set flags
9. Apply tier thresholds from config to determine complexity
10. Compute `researcherCount` based on complexity and target count
11. If `researcherCount > 1`: partition targets across researchers (round-robin by section)
12. Set `trackerRequired` based on complexity >= `auto_create_threshold`
13. Return assessment payload

**Dependencies:** `init.cjs`, `source-map.cjs`, `config.cjs`, `core.cjs`, `paths.cjs`

### `cmdScopeAssess(args)` -> void (outputs JSON)

CLI handler. Parses `[command, ...arguments]` from args, calls `assess()`, outputs JSON via `core.output()`.

### Error handling

- All errors return a default light payload. Never throw. Never block.
- Log warnings via `core.error()` for diagnostic visibility.

---

## Module 2: `lib/tracker.cjs`

### Exports

```js
module.exports = {
  create,       // Create new tracker
  update,       // Update a phase
  read,         // Read full tracker
  summary,      // Condensed summary
  close,        // Close tracker
  addIssue,     // Append issue
  addNote,      // Append note
  list,         // List trackers
  prune,        // Prune old trackers
  cmdTracker    // CLI handler for fp-tools.cjs
};
```

### Storage pattern

Follow the exact same pattern as `plans.cjs`:
- Storage dir: `{docs-root}/.fp-docs/trackers/`
- ID generation: `tracker-` + 8-char hex (like `plan-` prefix in plans.cjs)
- Atomic writes: write to `.tmp`, rename (same as `atomicWrite` in plans.cjs)
- Auto-prune: retention-based, configurable

### Function signatures

```js
function create({ operation, complexity, targets }) -> { id, path }
function update(trackerId, { phase, agent, status, result }) -> { ok: true }
function read(trackerId) -> trackerObject | null
function summary(trackerId) -> summaryObject | null
function close(trackerId, status) -> { ok: true }
function addIssue(trackerId, { phase, severity, message, target }) -> { ok: true }
function addNote(trackerId, note) -> { ok: true }
function list(filter) -> [summaryObject, ...]
function prune(days) -> { pruned: N }
```

### `cmdTracker(args)` -> void

CLI handler. Subcommand dispatch:
- `create --operation X --targets JSON --complexity Y` -> calls `create()`, outputs `{ id, path }`
- `update ID --phase X --agent Y --status Z [--content JSON]` -> calls `update()`
- `read ID` -> calls `read()`, outputs full tracker
- `summary ID` -> calls `summary()`, outputs condensed view
- `close ID --status X` -> calls `close()`
- `add-issue ID --phase X --severity Y --message Z [--target T]` -> calls `addIssue()`
- `add-note ID --note TEXT` -> calls `addNote()`
- `list [--status X]` -> calls `list()`
- `prune [--days N]` -> calls `prune()`

All output via `core.output()` (JSON).

### Notes for implementation

- Reuse `ensureDir`, `atomicWrite` patterns from `plans.cjs` -- consider extracting a shared `lib/storage.cjs` if duplication is excessive (judgment call)
- The `summary()` function must produce a small JSON payload (under 500 chars typical) for agent prompt injection
- `update()` must read-modify-write atomically (read tracker, update phase, atomic write back)
- `prune()` should prune by `closed` timestamp, not `created`. Active trackers are never pruned.

---

## fp-tools.cjs Route Additions

Add two new route blocks in `fp-tools.cjs`:

```js
// In the command dispatch section:
case 'scope-assess':
  require('./lib/scope-assess.cjs').cmdScopeAssess(remainingArgs);
  break;

case 'tracker':
  require('./lib/tracker.cjs').cmdTracker(remainingArgs);
  break;
```

---

## config.json Additions

Add to the `system` section:

```json
{
  "system": {
    "scope_assess": {
      "enabled": true,
      "heavy_threshold_files": 5,
      "heavy_threshold_sections": 3,
      "standard_threshold_files": 2,
      "standard_threshold_sources": 3,
      "max_researchers": 3
    },
    "tracker": {
      "enabled": true,
      "auto_create_threshold": "standard",
      "retention_days": 30,
      "max_trackers": 200
    }
  }
}
```

---

## Test Strategy

### scope-assess.cjs tests

1. **Light assessment**: Single file target returns complexity=light, researcherCount=1, trackerRequired=false
2. **Standard assessment**: 3 file targets returns complexity=standard, researcherCount=1, trackerRequired=true
3. **Heavy assessment**: 6+ file targets returns complexity=heavy, researcherCount>1
4. **Auto-update path**: Mocked git diff output correctly maps through source-map
5. **Skip conditions**: read-op command returns default light; disabled config returns default light
6. **Error resilience**: Bad source-map lookup returns default light (no throw)
7. **Researcher partitioning**: 6 targets across 2 researchers -> 3 targets each

### tracker.cjs tests

1. **CRUD lifecycle**: create -> update (each phase) -> close -> read shows complete history
2. **Summary condensation**: Full tracker produces summary under 500 chars
3. **Issue tracking**: addIssue appends; issues survive subsequent updates
4. **Prune logic**: Completed trackers older than threshold are pruned; active trackers are never pruned
5. **Atomic writes**: Concurrent-safe (write-tmp-rename pattern)
6. **Graceful no-op**: When enabled=false, all calls return success without writing files

---

## Implementation Order

1. `lib/tracker.cjs` -- standalone, no dependencies on scope-assess
2. `lib/scope-assess.cjs` -- depends on source-map.cjs, config.cjs, optionally creates trackers
3. `fp-tools.cjs` route additions -- wire both into CLI
4. `config.json` additions -- add the two new config sections
5. Tests for both modules
