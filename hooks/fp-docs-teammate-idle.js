#!/usr/bin/env node
'use strict';

/**
 * TeammateIdle hook: check teammate pipeline completion during orchestration.
 *
 * Delegates to handleTeammateIdleCheck from lib/hooks.cjs.
 * Category B hook: exit code + stderr warnings.
 *
 * Exit 0 = teammate output looks correct
 * Exit 2 = warnings detected (missing delegation markers)
 */

const { handleTeammateIdleCheck } = require('../lib/hooks.cjs');

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
    // If stdin parse fails, pass (fail open)
    process.exit(0);
  }

  try {
    const result = handleTeammateIdleCheck(input);
    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        process.stderr.write(w + '\n');
      }
      process.exit(result.exitCode);
    }
    process.exit(0);
  } catch {
    // Fail open on unexpected error
    process.exit(0);
  }
}

main().catch(() => {
  process.exit(0);
});
