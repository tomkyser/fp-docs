# Changelog Rules

Procedure for appending changelog entries after doc-modifying operations.

## File Path

`docs/changelog.md`

## Entry Format

```markdown
### YYYY-MM-DD — [Short Title]

- **Files changed**:
  - `docs/path/to/file.md` (created | modified | removed)
  - `docs/path/to/file2.md` (created | modified | removed)
- **Summary**: [One-line description of what changed and why]
```

## Procedure

1. Read `docs/changelog.md`
2. Check if today's month header (`## YYYY-MM`) exists
   - If exists: add entry under it
   - If not: add new month header, then entry
3. Append entry below the month header (newest first within each month)
4. Validate:
   - Lists EVERY file created, modified, or removed
   - Summary describes WHY, not just WHAT
   - Date is today's date
   - Newest entries at top of each month section

## Rules

- EVERY doc-modifying operation MUST produce a changelog entry
- MUST list every affected file
- MUST include a why-focused summary
- Do NOT modify existing entries — append only
