# Validation Rules

Complete 10-point verification checklist and sanity-check algorithm. Loaded on-demand by engines during pipeline execution.

## 10-Point Verification Checklist

### Check 1: File Existence
Read `docs/About.md`. Extract every relative markdown link. Verify each linked file exists on disk. Report missing files.

### Check 2: Orphan Check
List all `.md` files in `docs/` recursively. Confirm each is linked from `docs/About.md` or its parent `_index.md`. Exceptions: `docs-management.md`, `changelog.md`, `needs-revision-tracker.md`, `docs/claude-code-docs-system/`, `docs/claude-code-config/`.

### Check 3: Index Completeness
Find every `_index.md`. For each, list all `.md` siblings and confirm each is linked.

### Check 4: Appendix Spot-Check
If operation touched code registering hooks/shortcodes/REST/constants/deps/ACF/features, verify corresponding appendix was updated. Skip if standalone verify.

### Check 5: Link Validation
Validate all relative markdown links in modified docs resolve to real files.

### Check 6: Changelog Check
Confirm `docs/changelog.md` has an entry for today's date. Skip if standalone verify.

### Check 7: Citation Format Validation
Parse `> **Citation**` blocks. Verify format: `> **Citation** · \`{file}\` · \`{symbol}\` · L{start}–{end}`. Verify file paths exist. Verify symbols exist in files. Report FORMAT, MISSING, or BROKEN issues.

### Check 8: API Reference Provenance
For doc types requiring API Reference: verify section exists, every row has valid `Src` value, Ref Source legend is present. Report MISSING or INVALID.

### Check 9: Locals Contracts Completeness
For `docs/05-components/` docs: verify `## Locals Contracts` section exists, every `.php` file in corresponding `components/` dir has an entry, `_locals-shapes.md` is linked.

### Check 10: Verbosity Compliance
Select 3 docs from scope. Count source functions vs API Reference rows. Scan for banned phrases. Flag gaps exceeding tolerance.

## Report Format

```
## Verification Report — YYYY-MM-DD
### Check N: [Name]
[PASS | FAIL | SKIP — details]
---
**Overall: [PASS | FAIL]**
```

Run ALL 10 checks — do not stop at first failure. Report every issue. Do NOT modify files.

## Sanity-Check Algorithm

### Zero-Tolerance Principle
Every factual claim must be verifiable against source code. Unverified claims silently accepted = same as errors.

### Classification System

| Classification | Meaning |
|---------------|---------|
| VERIFIED | Claim exactly matches source code |
| MISMATCH | Claim contradicts source code |
| HALLUCINATION | Claim has no basis in source code |
| UNVERIFIED | Claim cannot be confirmed after deep investigation |
| CONTRADICTION | Claim conflicts with another doc |

### Deep Verification Steps (for UNVERIFIABLE claims)
1. Trace call chain — read calling and called functions
2. Check related files — imports, shared hooks, trait definitions
3. Search codebase — Grep/Glob for identifiers
4. Reclassify: VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED

### Confidence Levels
- **HIGH**: Every claim VERIFIED, no issues
- **LOW**: One or more HALLUCINATION, MISMATCH, UNVERIFIED, or CONTRADICTION

### Required Actions for LOW Confidence
- HALLUCINATION → remove fabricated claim
- MISMATCH → correct to match source
- UNVERIFIED → find proof or tag `[NEEDS INVESTIGATION]`
- CONTRADICTION → resolve conflict between docs
