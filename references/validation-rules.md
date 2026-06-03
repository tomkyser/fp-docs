# Validation Module

Defines the verification checklist and sanity-check algorithm used to validate documentation accuracy.

## 10-Point Verification Checklist

Run ALL 10 checks. Report results for each individually, then give an overall PASS or FAIL.

### Check 1: File Existence
Read `docs/README.md`. Extract every relative markdown link. Verify each linked file exists on disk.

### Check 2: Orphan Check
List all `.md` files in `docs/` recursively. Confirm each is linked from either `docs/README.md` or its parent `_index.md`. Exceptions: `docs-management.md`, `changelog.md`, `needs-revision-tracker.md`, `PROJECT-INDEX.md`, everything inside `docs/claude-code-config/`.

### Check 3: Index Completeness
Find every `_index.md`. For each, list all `.md` siblings and confirm each is linked from the `_index.md`.

### Check 4: Appendix Spot-Check
If operation touched code registering hooks/shortcodes/REST/constants/deps/ACF/features, verify corresponding appendix was updated. Skip if standalone verify.

### Check 5: Link Validation
Validate all relative markdown links in modified docs resolve to real files.

### Check 6: Changelog Check
Confirm `.fp-docs-branch/changelog.md` has an entry for today's date. Skip if standalone verify.

### Check 7: Citation Format Validation
Parse all `> **Citation**` blocks. Verify marker format matches: `> **Citation** · \`{file}\` · \`{symbol}\` · L{start}–{end}`. Verify cited file paths exist. Verify cited symbols exist in cited files.

### Check 8: API Reference Provenance Validation
For doc types requiring API Reference: verify `## API Reference` section exists, every row has valid `Src` value (`PHPDoc`, `Verified`, or `Authored`), and Ref Source legend blockquote is present.

### Check 9: Locals Contracts Completeness
For component docs in `docs/05-components/`: verify `## Locals Contracts` section exists, every `.php` file in corresponding `components/` dir has an entry, `_locals-shapes.md` exists and is linked.

### Check 10: Verbosity Compliance
Select 3 doc files from scope. For each: count source functions, count API Reference rows, compare. Scan for banned phrases. Flag gaps exceeding tolerance.

## Report Format

```
## Verification Report — YYYY-MM-DD

### Check 1: File Existence
[PASS | FAIL — details]
...
### Check 10: Verbosity Compliance
[PASS | FAIL | SKIP — details]

---
**Overall: [PASS | FAIL]**
```

Rules: Run ALL 10 checks. Report every issue. Do NOT modify files during verification.

## Sanity-Check Algorithm

### Zero-Tolerance Principle

Every factual claim in documentation must be verifiable against source code. Unverified claims silently accepted as "probably correct" are treated the same as errors.

### Steps

1. **Identify Changes**: List all modified doc files. Map each to source files.

2. **Cross-Reference Source Code**: For each modified doc:
   - If doc has citations: use as evidence anchors. Verify excerpts match current source.
   - Compare every factual claim against source: function signatures, hook names/priorities, file paths, meta keys, REST routes, shortcode attributes, defaults, constants.
   - Classify each claim: **VERIFIED**, **MISMATCH**, **HALLUCINATION**, **UNVERIFIABLE**

3. **Deep Verification** (for UNVERIFIABLE claims):
   - Trace call chains, check related files, search codebase
   - Reclassify as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED

4. **Cross-Reference Related Docs**: Check for contradictions between modified doc and siblings/linked docs.

5. **Complexity Assessment**: Recommend multi-agent review if changes touch >5 docs or span >3 sections.

6. **Report**: Sanity Check Report with scope, issues (HALLUCINATION, MISMATCH, UNVERIFIED, CONTRADICTION), confidence (HIGH/LOW), required actions.

### Confidence Levels

- **HIGH**: Every factual claim is VERIFIED — no issues found
- **LOW**: One or more claims are HALLUCINATION, MISMATCH, UNVERIFIED, or CONTRADICTION

If LOW: calling instruction MUST resolve all issues before proceeding. For UNVERIFIED claims that cannot be resolved, tag with `[NEEDS INVESTIGATION]`.
