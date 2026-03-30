#!/usr/bin/env node
'use strict';

/**
 * SubagentStop hook: validate specialist engine delegation results.
 *
 * Routes to the correct handler from lib/hooks.cjs based on agent_type.
 * Agent name normalization via lib/agent-map.cjs (canonical source of truth).
 *
 * Handler routing:
 * - modify / fp-docs-modifier -> handlePostModifyCheck
 * - orchestrate -> handlePostOrchestrateCheck
 * - locals / fp-docs-locals -> handleLocalsCLICleanup
 * - validate, citations, api-refs, researcher, planner -> handleSubagentEnforcementCheck
 *
 * Output: JSON with hookSpecificOutput to stdout.
 */

const {
  handlePostModifyCheck,
  handlePostOrchestrateCheck,
  handleLocalsCLICleanup,
  handleSubagentEnforcementCheck,
} = require('../lib/hooks.cjs');
const { getCanonicalName } = require('../lib/agent-map.cjs');

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
  // Normalize to canonical name for routing (via shared agent-map.cjs)
  const canonical = getCanonicalName(agentType) || agentType;

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
