# Verbosity Enforcement Rules

Complete algorithm for enforcing documentation completeness. Loaded on-demand by engines during pipeline execution.

## Scope Manifest Generation

Before any doc-modifying operation, build a scope manifest:

1. Read the source file(s) for the doc being generated/updated
2. Count every enumerable item:
   - Public functions/methods (count and list every name)
   - Parameters across all functions (total count)
   - Hooks registered (count and list)
   - Constants defined (count and list)
   - Enumerables detected (arrays, switch cases, if/elseif chains)
3. Record the scope manifest in working memory:

```markdown
## Scope Manifest: {doc_file_path}

**Source file(s)**: {source_file_path(s)}

| Category | Count | Items |
|----------|-------|-------|
| Public functions | N | name1, name2, name3, ... (ALL names) |
| Parameters (total) | N | (sum across all functions) |
| Hooks registered | N | hook_name_1, hook_name_2, ... |
| Constants defined | N | CONST_1, CONST_2, ... |
| Enumerables detected | N | description of each |

**Target API Reference rows**: N
**Target parameter count**: N
```

The manifest is a binding contract. If it says 23 functions, output must contain 23.

## Output Coverage Check

After generating documentation content, verify:

1. Count functions documented → compare to manifest target
2. Count API Reference table rows → compare to manifest target
3. Count parameters documented → compare to manifest target
4. For each enumerable in manifest → verify all items appear explicitly

Any shortfall blocks the operation. Fix gaps before proceeding.

## Banned Phrase Detection

Scan output for these phrases (case-insensitive). Any match is a violation:

**Always banned**: "and more", "etc.", "et cetera", "similar to above", "among others", "and so on", "and additional", "the rest"

**Contextually banned** (when avoiding enumeration of knowable items): "various", "remaining", "likewise", "as above", "other similar", "numerous", "several", "a number of"

**Banned regex patterns**:
- `\d+\s+(more|additional|other|remaining|further|extra)\b`
- `see (above|previous|earlier) for (similar|more|details)`
- `(handles?|supports?|includes?|provides?)\s+(various|multiple|many|several|different)\b`
- `\.{3}|…` (ellipsis as list omission)

## Correction Protocol

When a banned phrase or pattern is detected:
1. Identify the source code location defining the enumerable set
2. Read the source to extract all items
3. Rewrite the documentation with the explicit list
4. If items are not determinable from source, use `[NEEDS INVESTIGATION]`

## Gap Tolerance

Configured value: `0` (zero tolerance — every source item MUST be documented).

## Failure Conditions

The verbosity enforcement gate FAILS if:
- Any function in the scope manifest is not documented
- Any API Reference row target is not met
- Any banned phrase is detected and not corrected
- Any enumerable from source is not fully expanded

On failure: fix all gaps, then re-run the check before proceeding to the next pipeline stage.
