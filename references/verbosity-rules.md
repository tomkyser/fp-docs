# Verbosity Module

Defines the anti-compression rules that prevent content truncation, summarization, abbreviation, or omission in documentation output.

## Anti-Compression Directives

### Exhaustive Documentation is Mandatory

Every public function, every parameter, every hook, every return type, every constant, and every registerable element MUST appear in the documentation output. If the source file has 45 public functions, the API Reference table has 45 rows. Partial coverage is a failure state.

### Never Summarize Enumerables

If source code contains a list, array, switch statement, if/elseif chain, or any discrete set of items, you MUST enumerate every single item explicitly.

**Banned phrases** (case-insensitive):
- "and more", "etc.", "et cetera", "similar to above"
- "various" (when avoiding enumeration), "among others", "and so on"
- "remaining", "and additional", "the rest"
- "likewise", "as above" (when skipping repetitive documentation)
- "other similar", "numerous", "several", "a number of" (when avoiding enumeration)

**Banned patterns** (regex):
- `\d+\s+(more|additional|other|remaining|further|extra)\b`
- `see (above|previous|earlier) for (similar|more|details)`
- `(handles?|supports?|includes?|provides?)\s+(various|multiple|many|several|different)\b`
- `\.{3}|…` (ellipsis used as list omission)

### Never Truncate for Brevity

Length is not a concern. Completeness is the only concern. Output size is never a reason to skip content.

### Context Pressure is Not an Excuse

If context window is filling up:
1. STOP generating — do not compress output to fit
2. DELEGATE to an agent (Tier 1), or
3. CHECKPOINT for continuation (Tier 2)

## Scope Manifest Format

```markdown
## Scope Manifest: {doc_file_path}

**Source file(s)**: {source_file_path(s)}
**Generated**: {timestamp}

| Category | Count | Items |
|----------|-------|-------|
| Public functions | 23 | get_foo, set_bar, render_baz, ... (ALL names listed) |
| Parameters (total) | 47 | (sum across all functions) |
| Hooks registered | 3 | fp_after_post, fp_before_render, fp_api_response |
| Constants defined | 2 | FP_MAX_RELATED, FP_CACHE_TTL |
| Enumerables detected | 4 | post_types array (L45), formats switch (L89), ... |

**Target row count for API Reference table**: 23
**Target parameter documentation count**: 47
```

Rules:
- Manifest lists every function name — not just a count
- Manifest is a contract: if it says 23 functions, output must contain 23
- Any shortfall blocks the operation

## Self-Audit Protocol

After generating each documentation section:

1. **Count check**: Compare generated items against scope manifest target
2. **Phrase scan**: Check for banned phrases from the list above
3. **Completeness scan**: Count API Reference rows, documented parameters, enumerable items
4. **If discrepancy found**: Fix current section before advancing

## Context Window Management

| Condition | Strategy |
|-----------|----------|
| >50 functions to document OR >8 doc files | Tier 1: Chunk-and-Delegate |
| Mid-generation context pressure (>75% usage) | Tier 2: Checkpoint-and-Continue |
| Both conditions | Tier 1 first; Tier 2 within agents |
| Under all thresholds | Main thread handles directly |

### Chunk-and-Delegate Thresholds

- Max docs per agent: 8
- Max functions per agent: 50
- Delegation trigger (docs): 8
- Delegation trigger (functions): 50
