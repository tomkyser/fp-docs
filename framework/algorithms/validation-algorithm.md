# Validation Pipeline Algorithm

Execute these steps during Pipeline Stages 4 (Sanity-Check) and 5 (Verify).
All check definitions, classification systems, and report formats are in your preloaded mod-validation module.

## Sanity-Check Execution (Stage 4)

### Step 1: Identify Modified Sections
List all doc sections modified by the primary operation.
Map each to its source file(s) via the project module.

### Step 2: Cross-Reference Source Code
For each modified doc section:
1. If doc has citations: use as evidence anchors — verify excerpts match current source
2. Compare every factual claim against source: function signatures, hook names/priorities, file paths, meta keys, REST routes, shortcode attributes, defaults, constants
3. Classify each claim using the classification system from your preloaded mod-validation module

### Step 3: Deep Verification (for UNVERIFIABLE claims)
1. Trace call chains from the function outward
2. Check related files (parent classes, included files, trait uses)
3. Search codebase with Grep for the specific claim
4. Reclassify as VERIFIED, MISMATCH, HALLUCINATION, or UNVERIFIED

### Step 4: Cross-Reference Related Docs
Check for contradictions between modified doc and siblings/linked docs.
Use the link validation algorithm below for relative path resolution.

### Step 5: Determine Confidence
Apply confidence levels from your preloaded mod-validation module.
If LOW: resolve all issues before proceeding. Tag unresolvable claims with `[NEEDS INVESTIGATION]`.

## Verification Execution (Stage 5)

Run ALL 10 checks from your preloaded mod-validation module.
For each check, report PASS, FAIL (with details), or SKIP (with reason).
Do NOT modify any files during verification — report only.

## Link Validation Algorithm (used by Check 5)

For each relative markdown link `[text](target)`:
1. Extract the link target path
2. Resolve path relative to the containing file's directory
3. Normalize: `../06-helpers/posts.md` from `docs/02-post-types/post.md` resolves to `docs/06-helpers/posts.md`
4. Check if resolved path exists on disk
5. For anchor links (`#section`): verify the file exists; optionally verify heading slug
6. Report broken links with: source file, line number, target path, category

### Broken Link Categories

| Category | Description | Severity |
|----------|-------------|----------|
| MISSING_FILE | Target file does not exist on disk | High |
| WRONG_PATH | Path syntax error or wrong relative depth | High |
| BROKEN_ANCHOR | File exists but anchor heading not found | Medium |
| ORPHANED | File exists but not linked from any _index.md | Low |
