# Verbosity Pipeline Algorithm

Execute these steps during Pipeline Stage 1 (Verbosity Enforcement).
All rule definitions are in your preloaded mod-verbosity module.

## Step 1: Build Scope Manifest

Read the source file(s) for the doc being generated/updated.
Build a scope manifest following the format in your preloaded verbosity module.
The manifest is a binding contract — output MUST match manifest counts.

## Step 2: Generate/Update Documentation

Produce the documentation content following instruction file steps.

## Step 3: Output Coverage Check

After generating content:
1. Count functions documented → compare to manifest target
2. Count API Reference table rows → compare to manifest target
3. Count parameters documented → compare to manifest target
4. For each enumerable in manifest → verify all items appear explicitly
Any shortfall blocks the operation. Fix gaps before proceeding.

## Step 4: Banned Phrase Detection

Scan output for banned phrases and patterns from your preloaded verbosity module.
If detected, apply the correction protocol below.

## Correction Protocol

When a banned phrase or pattern is detected:
1. Identify the source code location defining the enumerable set
2. Read the source to extract all items
3. Rewrite the documentation with the explicit list
4. If items are not determinable from source, use `[NEEDS INVESTIGATION]`

## Gap Tolerance

Configured value: `0` (zero tolerance — every source item MUST be documented).

## Failure Conditions

Pipeline Stage 1 FAILS if:
- Scope manifest count exceeds documented count (missing items)
- Any banned phrase remains in output after correction pass
- Any enumerable is not fully expanded
Fix all failures before proceeding to Stage 2.
