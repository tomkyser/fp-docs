#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook: inject manifest, check branch sync, surface drift nudge.
 *
 * Combines three handlers from lib/hooks.cjs:
 * - handleInjectManifest: inject plugin root + manifest into context
 * - handleBranchSyncCheck: branch comparison + remote + watermark
 * - handleDriftNudge: surface pending drift signals
 *
 * Reads stdin JSON, runs all three handlers, merges additionalContext.
 * Output: JSON with hookSpecificOutput to stdout.
 */

const { handleInjectManifest, handleBranchSyncCheck, handleDriftNudge } = require('../lib/hooks.cjs');

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

  const parts = [];
  let stopMessage;

  try {
    // 1. Inject manifest (always runs)
    const manifest = handleInjectManifest(input);
    if (manifest.additionalContext) {
      parts.push(manifest.additionalContext);
    }
  } catch {
    // Silent failure -- non-critical
  }

  try {
    // 2. Branch sync check
    const sync = handleBranchSyncCheck(input);
    if (sync.additionalContext) {
      parts.push(sync.additionalContext);
    }
    if (sync.stopMessage) {
      stopMessage = sync.stopMessage;
    }
  } catch {
    // Silent failure -- non-critical
  }

  try {
    // 3. Drift nudge
    const drift = handleDriftNudge(input);
    if (drift.additionalContext) {
      parts.push(drift.additionalContext);
    }
  } catch {
    // Silent failure -- non-critical
  }

  const result = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: parts.join('\n\n'),
    },
  };

  if (stopMessage) {
    result.hookSpecificOutput.stopMessage = stopMessage;
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch(() => {
  // Silent exit on unexpected error
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '',
    },
  }));
});
