#!/usr/bin/env node
'use strict';

/**
 * SubagentStop hook: validate specialist engine delegation results.
 *
 * Routes to the correct handler from lib/hooks.cjs based on agent_type:
 * - modify / fp-docs-modifier -> handlePostModifyCheck
 * - orchestrate -> handlePostOrchestrateCheck
 * - locals / fp-docs-locals -> handleLocalsCLICleanup
 * - validate / fp-docs-validator, citations / fp-docs-citations,
 *   api-refs / fp-docs-api-refs, researcher / fp-docs-researcher,
 *   planner / fp-docs-planner -> handleSubagentEnforcementCheck
 *
 * Output: JSON with hookSpecificOutput to stdout.
 */

const {
  handlePostModifyCheck,
  handlePostOrchestrateCheck,
  handleLocalsCLICleanup,
  handleSubagentEnforcementCheck,
} = require('../lib/hooks.cjs');

// Map new GSD agent names to their canonical handler names
const AGENT_NAME_MAP = {
  'fp-docs-modifier': 'modify',
  'fp-docs-validator': 'validate',
  'fp-docs-citations': 'citations',
  'fp-docs-api-refs': 'api-refs',
  'fp-docs-locals': 'locals',
  'fp-docs-researcher': 'researcher',
  'fp-docs-planner': 'planner',
  'fp-docs-verbosity': 'verbosity',
  'fp-docs-indexer': 'index',
  'fp-docs-system': 'system',
};

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

  const agentType = input.agent_type || '';
  // Normalize to canonical name for routing
  const canonical = AGENT_NAME_MAP[agentType] || agentType;

  let result;
  try {
    switch (canonical) {
      case 'modify':
        result = handlePostModifyCheck(input);
        break;
      case 'orchestrate':
        result = handlePostOrchestrateCheck(input);
        break;
      case 'locals':
        result = handleLocalsCLICleanup(input);
        break;
      case 'validate':
      case 'citations':
      case 'api-refs':
      case 'researcher':
      case 'planner':
        // Pass canonical name so enforcement check uses correct STAGE_AUTHORITY_MAP key
        result = handleSubagentEnforcementCheck({ ...input, agent_type: canonical });
        break;
      default:
        // Unknown agent type -- pass through to enforcement check
        result = handleSubagentEnforcementCheck({ ...input, agent_type: canonical });
        break;
    }
  } catch {
    result = {
      additionalContext: `SubagentStop check for ${agentType}: handler error (silent failure).`,
    };
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: result.additionalContext || '',
    },
  }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStop',
      additionalContext: '',
    },
  }));
});
