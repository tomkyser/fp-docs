# Scope Assessment Pattern

> Design document for the scope assessment workflow step.
> Created: 2026-03-30 (Round 2, Phase 1)
> Status: Pattern spec for CJS implementation

---

## Purpose

Scope assessment is a new workflow step that runs **before research**. It quickly evaluates the task scale to determine:

1. How many researcher agents to spawn (1-N)
2. Estimated complexity tier (low / medium / high)
3. Whether a tracker doc should be created
4. Initial file targets and source-map lookups

This replaces the current pattern where every write operation spawns exactly 1 researcher regardless of task size.

---

## Position in Workflow

```
Current:  init → research(1) → plan → write → review → finalize
New:      init → scope-assess → research(1-N) → plan → write → review → finalize
```

The scope assessment step is **not an agent spawn**. It is a CLI call that returns a JSON payload with delegation parameters. The workflow reads the payload and uses it to configure subsequent agent spawns.

---

## CJS Interface: `lib/scope-assess.cjs`

### CLI Surface

```
fp-tools scope-assess <command> <arguments> [--json]
```

### Input

The scope-assess module receives:
- `command`: The fp-docs command name (e.g., `revise`, `add`, `auto-update`)
- `arguments`: The raw user arguments string
- Init context (loaded internally via `init.cjs` helpers)

### Output (JSON)

```json
{
  "complexity": "low | medium | high",
  "researcherCount": 1,
  "targets": [
    {
      "docPath": "docs/06-helpers/posts.md",
      "sourcePaths": ["helpers/posts.php"],
      "scope": "single-file"
    }
  ],
  "trackerRequired": false,
  "estimatedFiles": 1,
  "estimatedSections": 1,
  "flags": {
    "multiFile": false,
    "crossSection": false,
    "newDoc": false,
    "batchMode": false
  },
  "delegationPlan": {
    "researchers": [
      {
        "id": 0,
        "targets": [{"docPath": "...", "sourcePaths": ["..."]}]
      }
    ]
  }
}
```

### Complexity Tiers

| Tier | Criteria | Researcher Count | Tracker |
|------|----------|-----------------|---------|
| **low** | 1 doc, 1-2 source files, single section | 1 | No |
| **medium** | 2-4 docs, or 1 doc with 3+ source files, or cross-section | 1 | Yes |
| **high** | 5+ docs, batch operation, or scope covers 3+ sections | 2-N (capped at `orchestration.max_concurrent_subagents`) | Yes |

### Assessment Algorithm

1. Parse `arguments` to extract explicit targets (file paths, section references, descriptions)
2. If targets are explicit paths: look up via `source-map.cjs` to get doc-to-source mappings, count files
3. If targets are descriptive (natural language): estimate by keyword matching against source-map entries
4. For `auto-update`: count git-changed files via `git diff --name-only` filtered through source-map
5. For `auto-revise`: count items in needs-revision-tracker.md
6. For `parallel`: always high (batch mode flag)
7. Apply tier thresholds to determine complexity and researcher count
8. If `researcherCount > 1`: partition targets across researchers (each gets a disjoint subset)
9. If `complexity >= medium`: set `trackerRequired: true`

### Configuration (in config.json under `system.scope_assess`)

```json
{
  "scope_assess": {
    "enabled": true,
    "high_threshold_files": 5,
    "high_threshold_sections": 3,
    "medium_threshold_files": 2,
    "medium_threshold_sources": 3,
    "max_researchers": 3
  }
}
```

### Skip Conditions

Scope assessment is skipped (returns a default low payload) when:
- `--no-research` flag is set (no researchers will be spawned anyway)
- `scope_assess.enabled` is false in config
- Command type is `read`, `admin`, or `meta` (these don't need dynamic delegation)
- Command is `do` or `help` (meta commands with no doc targets)

---

## Workflow Integration

### How the workflow uses the scope-assess output

```xml
<step name="scope-assess">
## 2. Scope Assessment
Skip if `--no-research` flag is set or read-only operation.

```bash
SCOPE=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" scope-assess {command} "$ARGUMENTS" --json)
```
Parse JSON for: complexity, researcherCount, targets, trackerRequired, delegationPlan.

If trackerRequired:
```bash
TRACKER=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" tracker create --operation {command} --targets '{targets-json}' --complexity {complexity})
```
Extract tracker_id and tracker file path.
</step>

<step name="research">
## 3. Research Phase (Dynamic)
Skip if `--no-research` flag is set.

For each researcher in delegationPlan.researchers:
```bash
RESEARCHER_MODEL=$(node "${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs" resolve-model fp-docs-researcher --raw)
```
Spawn researcher agent with its assigned target subset:
```
Agent(
  prompt="Analyze source code for {command} operation.
    Targets: {researcher.targets}
    Tracker: {tracker-file-path or 'none'}
    ...
    If tracker exists, update it with your findings:
    node ${CLAUDE_PLUGIN_ROOT}/fp-tools.cjs tracker update {tracker_id} --phase research --agent researcher-{id} --content '{findings}'",
  agent="fp-docs-researcher",
  model="${RESEARCHER_MODEL}"
)
```

If researcherCount == 1: spawn synchronously, extract analysis.
If researcherCount > 1: spawn all in parallel, collect all analyses, merge.
</step>
```

### Merging multiple researcher results

When N > 1 researchers run in parallel, their analyses are stored as separate analysis files via `plans.cjs save-analysis`. The planner agent receives all analysis file paths and merges them into a unified execution plan.

---

## Error Handling

- If source-map lookup fails for a target: include it in targets with `sourcePaths: []` and let the researcher agent discover the mapping
- If scope-assess CLI fails entirely: fall back to default low payload (1 researcher, no tracker) -- never block the workflow
- If git diff fails for auto-update: fall back to medium complexity with no specific targets

---

## Relationship to Other Modules

| Module | Interaction |
|--------|-------------|
| `init.cjs` | scope-assess reuses `buildCommonContext()` and `getFeatureFlags()` from init |
| `source-map.cjs` | scope-assess calls `lookup()` and `reverseLookup()` for target resolution |
| `plans.cjs` | Researchers save analysis files via plans; planner reads them |
| `tracker.cjs` | scope-assess creates the tracker if required; all agents update it |
| `config.cjs` | scope-assess reads threshold config values |
