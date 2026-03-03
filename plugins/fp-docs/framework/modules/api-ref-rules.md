# API Reference Pipeline Algorithm

Execute these steps during Pipeline Stage 3 (API References).
All format rules, column definitions, provenance values, and scope tables are in your preloaded docs-mod-api-refs module.

## API Reference Table Generation

### Step 1: Identify Source File
Use the source-to-docs mapping from your preloaded docs-mod-project module.
Resolve the source file(s) for the doc being generated/updated.

### Step 2: Extract Functions
- **PHP helpers**: Grep for `function {name}(` inside the namespace
- **PHP classes**: Grep for `public function` and `public static function`
- **JS modules**: Grep for `export function`, `export const`, `export default`
Exclude private/internal helpers unless called by other documented code.

### Step 3: Extract Details Per Function

| Detail | Source |
|--------|--------|
| Name | Function declaration |
| Parameters | Signature + PHPDoc @param |
| Return type | Signature + PHPDoc @return |
| Description | PHPDoc @description, first line of docblock, or authored from behavior |
| Provenance | PHPDoc if from docblock, Verified if hand-written from source reading |

### Step 4: Build Table
Build the API Reference table following column definitions from your preloaded docs-mod-api-refs module.
Rows ordered by source file line number (declaration order), not alphabetically.

### Step 5: Handle Complex Parameters
For functions with 4+ parameters: list the first 2-3 primary params in the Params column, add "See citation." for the full list.

## Update Logic

When updating an existing API Reference table:
1. Read current table rows and source file
2. For each source function: check if a matching row exists
3. New functions → add row at correct position (by line number)
4. Removed functions → delete row
5. Changed signatures → update Params, Return columns; change Src to `Verified`
