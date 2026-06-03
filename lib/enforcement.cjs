'use strict';
/**
 * Enforcement -- runtime enforcement logic for delegation architecture.
 *
 * Provides detection, parsing, and validation functions consumed by:
 * - hooks.cjs (PreToolUse git-write blocking, SubagentStop validation)
 * - pipeline.cjs (stage gate validation)
 *
 * Separated from hooks.cjs for testability and single-responsibility.
 * Zero external dependencies -- Node.js built-ins only.
 */

const { STAGE_AUTHORITY_MAP } = require('./agent-map.cjs');

// ── Git-Write Detection (D-01, D-03) ────────────────────────────────────────

/**
 * Regex matching fp-tools.cjs git ... invocations.
 * These are CJS-mediated git commands that are authorized (D-03 exemption).
 */
const CJS_GIT_PATTERN = /fp-tools\.cjs\s+git\b/;

/**
 * Regex matching raw git write subcommands, allowing optional flags before
 * the subcommand (e.g., `git -C /path commit`, `git --no-pager push`).
 *
 * Covers: commit, push, tag, merge, rebase, checkout, reset, clean, rm, mv,
 * stash pop/drop/apply/clear, cherry-pick, revert, am, pull.
 */
const GIT_WRITE_PATTERN = /\bgit\s+(?:(?:-C\s+\S+|--no-pager|--git-dir=\S+)\s+)*(commit|push|tag|merge|rebase|checkout|reset|clean|rm|mv|stash\s+(?:pop|drop|apply|clear)|cherry-pick|revert|am|pull)\b/;

/**
 * Check whether a command string is a CJS-mediated git invocation.
 *
 * @param {string} command - Command string to test
 * @returns {boolean} true if command matches fp-tools.cjs git pattern
 */
function isCjsMediatedGit(command) {
  if (!command || typeof command !== 'string') return false;
  return CJS_GIT_PATTERN.test(command);
}

/**
 * Determine whether a command is a blocked raw git-write operation.
 *
 * CJS-mediated git commands (via fp-tools.cjs) are always allowed (D-03).
 * Raw git write subcommands are blocked; read-only git commands pass through.
 *
 * @param {string} command - Command string to evaluate
 * @returns {{ blocked: boolean, reason: string }}
 */
function isGitWriteCommand(command) {
  if (!command || typeof command !== 'string') {
    return { blocked: false, reason: 'allowed' };
  }

  // D-03 exemption: CJS-mediated git is always authorized
  if (isCjsMediatedGit(command)) {
    return { blocked: false, reason: 'CJS-mediated git allowed' };
  }

  // Check for raw git write subcommands
  if (GIT_WRITE_PATTERN.test(command)) {
    return {
      blocked: true,
      reason: 'Blocked: raw git-write command "' + command.slice(0, 100) + '" -- use fp-tools.cjs git for authorized git operations',
    };
  }

  return { blocked: false, reason: 'allowed' };
}

// ── Delegation Result Parsing (D-10, D-12) ──────────────────────────────────

/**
 * Parse a delegation result text block for structural compliance,
 * enforcement stage data, and completion markers.
 *
 * @param {string} text - Raw delegation result text
 * @returns {{
 *   hasStructure: boolean,
 *   filesModified: string[],
 *   enforcementStages: object,
 *   completionMarker: string|null,
 *   issues: string[],
 *   violations: Array<{ check: string, expected: string, found: string }>
 * }}
 */
function parseDelegationResult(text) {
  const result = {
    hasStructure: false,
    filesModified: [],
    enforcementStages: {},
    completionMarker: null,
    issues: [],
    violations: [],
  };

  if (!text || typeof text !== 'string') {
    result.violations.push({
      check: 'delegation_structure',
      expected: '## Delegation Result with Files Modified and Enforcement Stages sections',
      found: 'empty or non-string input',
    });
    result.violations.push({
      check: 'completion_marker',
      expected: 'Delegation complete: [verbosity: ...] [citations: ...] [api-refs: ...]',
      found: 'no completion marker',
    });
    return result;
  }

  // Check required sections
  const hasDelegationResult = /## Delegation Result/.test(text);
  const hasFilesModified = /### Files Modified/.test(text);
  const hasEnforcementStages = /### Enforcement Stages/.test(text);

  result.hasStructure = hasDelegationResult && hasFilesModified && hasEnforcementStages;

  if (!result.hasStructure) {
    result.violations.push({
      check: 'delegation_structure',
      expected: '## Delegation Result with Files Modified and Enforcement Stages sections',
      found: 'missing required sections',
    });
  }

  // Parse files modified: lines matching "- {path}: {description}" after ### Files Modified
  const filesSection = text.split('### Files Modified')[1];
  if (filesSection) {
    const nextSection = filesSection.split(/^###\s/m)[0];
    const fileLines = nextSection.split('\n');
    for (const line of fileLines) {
      const match = line.match(/^- (.+?):/);
      if (match) {
        result.filesModified.push(match[1].trim());
      }
    }
  }

  // Parse enforcement stages
  const stageRegex = /- (Verbosity|Citations|API Refs): (PASS|FAIL|SKIPPED|N\/A)/gi;
  let stageMatch;
  while ((stageMatch = stageRegex.exec(text)) !== null) {
    result.enforcementStages[stageMatch[1].toLowerCase()] = stageMatch[2].toUpperCase();
  }

  // Parse completion marker
  const completionMatch = text.match(/Delegation complete: (.+)/);
  if (completionMatch) {
    result.completionMarker = completionMatch[1].trim();
  } else {
    result.violations.push({
      check: 'completion_marker',
      expected: 'Delegation complete: [verbosity: ...] [citations: ...] [api-refs: ...]',
      found: 'no completion marker',
    });
  }

  // Parse issues section
  const issuesSection = text.split('### Issues')[1];
  if (issuesSection) {
    const nextSection = issuesSection.split(/^###?\s/m)[0];
    const issueLines = nextSection.split('\n');
    for (const line of issueLines) {
      const trimmed = line.replace(/^-\s*/, '').trim();
      if (trimmed.length > 0) {
        result.issues.push(trimmed);
      }
    }
  }

  return result;
}

// ── Stage Authority Verification (D-11) ─────────────────────────────────────
// STAGE_AUTHORITY_MAP imported from lib/agent-map.cjs (canonical source of truth)

/**
 * Verify that an agent type is authorized for the given pipeline phase.
 *
 * @param {string} agentType - Agent identifier (e.g., 'fp-docs-modifier', 'fp-docs-validator')
 * @param {string} expectedPhase - Pipeline phase (e.g., 'write', 'review', 'finalize')
 * @returns {{ valid: boolean, violation?: string }}
 */
function verifyStageAuthority(agentType, expectedPhase) {
  const authorizedPhase = STAGE_AUTHORITY_MAP[agentType];

  if (authorizedPhase === undefined) {
    return {
      valid: false,
      violation: 'Unknown agent type for authority check: ' + agentType,
    };
  }

  if (authorizedPhase !== expectedPhase) {
    return {
      valid: false,
      violation: 'Stage authority mismatch: agent ' + agentType + ' (authorized for: ' + authorizedPhase + ') executed ' + expectedPhase + ' phase work',
    };
  }

  return { valid: true };
}

// ── Stage Output Validation (D-08) ──────────────────────────────────────────

/**
 * Validate the output of a specific pipeline stage for expected markers.
 *
 * Stages 1-5 are agent-driven and require output marker validation.
 * Stages 6-8 are CJS-deterministic and validated by pipeline.cjs directly.
 *
 * @param {number} stageId - Pipeline stage number (1-8)
 * @param {{ lastMessage: string, targetFiles?: string[] }} context - Stage execution context
 * @returns {{ valid: boolean, violations: Array<{ check: string, expected: string, found: string }> }}
 */
function validateStageOutput(stageId, context) {
  const violations = [];
  const lastMessage = (context && context.lastMessage) || '';

  switch (stageId) {
    case 1: // Verbosity
      if (!/verbosity.*(?:pass|complete|enforced)/i.test(lastMessage)) {
        violations.push({
          check: 'stage_1_completion',
          expected: 'verbosity enforcement completion marker',
          found: 'no verbosity completion indicator in output',
        });
      }
      break;

    case 2: // Citations
      if (!/citations?.*(?:pass|complete|generated|verified|updated)/i.test(lastMessage)) {
        violations.push({
          check: 'stage_2_completion',
          expected: 'citation enforcement completion marker',
          found: 'no citation completion indicator in output',
        });
      }
      break;

    case 3: // API Refs
      if (!/api.?ref.*(?:pass|complete|generated|N\/A|skipped)/i.test(lastMessage)) {
        violations.push({
          check: 'stage_3_completion',
          expected: 'API reference enforcement completion marker',
          found: 'no API reference completion indicator in output',
        });
      }
      break;

    case 4: // Sanity Check
      if (/HALLUCINATION/i.test(lastMessage)) {
        violations.push({
          check: 'stage_4_hallucination',
          expected: 'no HALLUCINATION markers',
          found: 'HALLUCINATION detected in sanity check output',
        });
      }
      if (!/confidence:\s*(HIGH|MEDIUM|LOW)/i.test(lastMessage)) {
        violations.push({
          check: 'stage_4_confidence',
          expected: 'confidence marker (HIGH|MEDIUM|LOW)',
          found: 'no confidence marker in sanity check output',
        });
      }
      break;

    case 5: // Verification
      if (!/verification.*(?:complete|checklist|10.?point|pass)/i.test(lastMessage)) {
        violations.push({
          check: 'stage_5_completion',
          expected: 'verification checklist completion marker',
          found: 'no verification completion indicator in output',
        });
      }
      break;

    // Stages 6-8: CJS-deterministic, validated by pipeline.cjs directly
    case 6:
    case 7:
    case 8:
      break;

    default:
      violations.push({
        check: 'unknown_stage',
        expected: 'stage ID 1-8',
        found: 'stage ' + stageId,
      });
      break;
  }

  return { valid: violations.length === 0, violations };
}

module.exports = {
  isGitWriteCommand,
  isCjsMediatedGit,
  parseDelegationResult,
  verifyStageAuthority,
  validateStageOutput,
  STAGE_AUTHORITY_MAP,
};
