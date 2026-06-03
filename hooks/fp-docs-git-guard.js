#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook: block raw git-write commands from non-orchestrator engines.
 *
 * Delegates to handlePreToolUseBashGitCheck from lib/hooks.cjs.
 *
 * Exit code semantics for PreToolUse:
 *   Exit 0 = allow the tool call to proceed
 *   Exit 2 = BLOCK the tool call, stderr fed to Claude as feedback
 */

const { handlePreToolUseBashGitCheck } = require('../lib/hooks.cjs');

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
    // If stdin parse fails, allow the command (fail open)
    process.exit(0);
  }

  try {
    const result = handlePreToolUseBashGitCheck(input);
    if (!result.allowed) {
      process.stderr.write(result.reason + '\n');
      process.exit(2); // BLOCK
    }
    process.exit(0); // ALLOW
  } catch {
    // Fail open on unexpected error
    process.exit(0);
  }
}

main().catch(() => {
  process.exit(0);
});
