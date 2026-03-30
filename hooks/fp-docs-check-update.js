#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook: spawn background update check if cache is stale.
 *
 * Delegates to handleUpdateCheck from lib/hooks.cjs.
 * This hook ONLY spawns the background check process.
 * Update nudge is displayed by the user-level statusline hook (fp-docs-statusline.js).
 *
 * Output: JSON with hookSpecificOutput to stdout (always empty additionalContext).
 */

const { handleUpdateCheck } = require('../lib/hooks.cjs');

async function main() {
  let input = {};
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf-8').trim();
    if (raw) {
      input = JSON.parse(raw);
    }
  } catch {
    // If stdin parse fails, proceed with empty input
  }

  try {
    handleUpdateCheck(input);
  } catch {
    // Silent failure -- non-critical
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '',
    },
  }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '',
    },
  }));
});
