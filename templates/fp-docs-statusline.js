#!/usr/bin/env node
// fp-docs statusline hook -- installed by /fp-docs:setup
// Shows update available nudge when fp-docs has a newer version.
// Cache file written by SessionStart background check (lib/hooks.cjs handleUpdateCheck).
//
// Installation:
//   1. Copy to ~/.claude/hooks/fp-docs-statusline.js (done by /fp-docs:setup)
//   2. Add to ~/.claude/settings.json under hooks.Statusline
//   3. Or integrate the cache check into existing gsd-statusline.js
//
// The hook reads .fp-docs/update-cache.json relative to the workspace directory.
// If update_available is true, outputs a colored nudge for the statusline.
// Otherwise outputs nothing (does not interfere with other statusline hooks).

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const dir = data.workspace?.current_dir || process.cwd();

    // Look for fp-docs update cache relative to workspace.
    // The cache is at {codebase-root}/.fp-docs/update-cache.json.
    // Try common locations: workspace dir, or one level up.
    let nudge = '';
    const candidates = [
      path.join(dir, '.fp-docs', 'update-cache.json'),
      path.join(dir, '..', '.fp-docs', 'update-cache.json'),
    ];

    for (const cachePath of candidates) {
      if (fs.existsSync(cachePath)) {
        try {
          const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          if (cache.update_available) {
            nudge = '\x1b[33m\u2B06 /fp-docs:update\x1b[0m \u2502 ';
          }
        } catch {
          // Ignore parse errors -- cache may be mid-write
        }
        break;
      }
    }

    // Output nudge prefix (if any) -- does NOT replace existing statusline,
    // just outputs the fp-docs portion. User can combine with other hooks.
    if (nudge) {
      process.stdout.write(nudge);
    }
  } catch {
    // Silent fail -- don't break statusline on parse errors
  }
});
