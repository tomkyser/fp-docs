#!/usr/bin/env node
'use strict';

/**
 * TaskCompleted hook: verify task outputs during orchestration.
 *
 * Delegates to handleTaskCompletedCheck from lib/hooks.cjs.
 * Category B hook: exit code + stderr warnings.
 *
 * Exit 0 = task output looks correct
 * Exit 2 = warnings detected (missing file modifications, hallucination markers, etc.)
 */

const { handleTaskCompletedCheck } = require('../lib/hooks.cjs');

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
    const result = handleTaskCompletedCheck(input);
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
