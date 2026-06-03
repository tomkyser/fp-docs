# Changelog Module

Defines the changelog entry format and update procedure.

## Steps

### 1. Read Changelog

Read `.fp-docs-branch/changelog.md`.

### 2. Determine Month Header

Check if today's month header (`## YYYY-MM`) already exists.
- If it exists, add the new entry under it.
- If it does NOT exist, add a new month header before the entry.

### 3. Append Entry

Add the entry directly below the month header (newest entries at top of each month section):

```markdown
### YYYY-MM-DD — [Short Title]

- **Files changed**:
  - `docs/path/to/file.md` (created | modified | removed)
  - `docs/path/to/file2.md` (created | modified | removed)
- **Summary**: [One-line description of what changed and why]
```

### 4. Validate

- The entry lists EVERY file created, modified, or removed — omit nothing.
- The summary describes WHY the change was made, not just WHAT changed.
  - Good: "Updated post type docs after adding new `template_type` meta key in PR #1234"
  - Bad: "Updated docs"
- The date is today's date.
- Newest entries at the top of each month section.

## Rules

- EVERY operation that changes documentation files MUST result in a changelog entry.
- The entry MUST list every file that was created, modified, or removed.
- The summary MUST describe why the change was made.
- Do NOT modify existing changelog entries — append only.
