'use strict';

// Tests for lib/enforcement.cjs
// Covers git-write detection (D-01/D-03), delegation result parsing (D-10/D-12),
// stage authority verification (D-11), and stage output validation (D-08).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enforcement = require(path.resolve(__dirname, '..', '..', 'lib', 'enforcement.cjs'));

// ── isGitWriteCommand Tests ──────────────────────────────────────────────────

describe('isGitWriteCommand', () => {
  // Blocked commands (git write operations)
  it('blocks git commit', () => {
    const r = enforcement.isGitWriteCommand('git commit -m "test"');
    assert.equal(r.blocked, true);
    assert.ok(r.reason.includes('Blocked'));
  });

  it('blocks git push', () => {
    const r = enforcement.isGitWriteCommand('git push origin main');
    assert.equal(r.blocked, true);
  });

  it('blocks git tag', () => {
    const r = enforcement.isGitWriteCommand('git tag v1.0.0');
    assert.equal(r.blocked, true);
  });

  it('blocks git merge', () => {
    const r = enforcement.isGitWriteCommand('git merge feature');
    assert.equal(r.blocked, true);
  });

  it('blocks git rebase', () => {
    const r = enforcement.isGitWriteCommand('git rebase main');
    assert.equal(r.blocked, true);
  });

  it('blocks git checkout', () => {
    const r = enforcement.isGitWriteCommand('git checkout main');
    assert.equal(r.blocked, true);
  });

  it('blocks git reset', () => {
    const r = enforcement.isGitWriteCommand('git reset --hard HEAD');
    assert.equal(r.blocked, true);
  });

  it('blocks git clean', () => {
    const r = enforcement.isGitWriteCommand('git clean -fd');
    assert.equal(r.blocked, true);
  });

  it('blocks git cherry-pick', () => {
    const r = enforcement.isGitWriteCommand('git cherry-pick abc123');
    assert.equal(r.blocked, true);
  });

  it('blocks git pull', () => {
    const r = enforcement.isGitWriteCommand('git pull origin main');
    assert.equal(r.blocked, true);
  });

  it('blocks git with -C flag before subcommand (Pitfall 2)', () => {
    const r = enforcement.isGitWriteCommand('git -C /some/path commit -m "test"');
    assert.equal(r.blocked, true);
  });

  it('blocks git with --no-pager flag before subcommand', () => {
    const r = enforcement.isGitWriteCommand('git --no-pager commit -m "test"');
    assert.equal(r.blocked, true);
  });

  it('blocks git revert', () => {
    const r = enforcement.isGitWriteCommand('git revert HEAD');
    assert.equal(r.blocked, true);
  });

  it('blocks git am', () => {
    const r = enforcement.isGitWriteCommand('git am patch.mbox');
    assert.equal(r.blocked, true);
  });

  it('blocks git rm', () => {
    const r = enforcement.isGitWriteCommand('git rm file.txt');
    assert.equal(r.blocked, true);
  });

  it('blocks git mv', () => {
    const r = enforcement.isGitWriteCommand('git mv old.txt new.txt');
    assert.equal(r.blocked, true);
  });

  it('blocks git stash pop', () => {
    const r = enforcement.isGitWriteCommand('git stash pop');
    assert.equal(r.blocked, true);
  });

  it('blocks git stash drop', () => {
    const r = enforcement.isGitWriteCommand('git stash drop');
    assert.equal(r.blocked, true);
  });

  // Allowed commands (read-only git operations)
  it('allows git diff', () => {
    const r = enforcement.isGitWriteCommand('git diff HEAD');
    assert.equal(r.blocked, false);
    assert.equal(r.reason, 'allowed');
  });

  it('allows git log', () => {
    const r = enforcement.isGitWriteCommand('git log --oneline');
    assert.equal(r.blocked, false);
  });

  it('allows git status', () => {
    const r = enforcement.isGitWriteCommand('git status');
    assert.equal(r.blocked, false);
  });

  it('allows git blame', () => {
    const r = enforcement.isGitWriteCommand('git blame file.txt');
    assert.equal(r.blocked, false);
  });

  it('allows git show', () => {
    const r = enforcement.isGitWriteCommand('git show HEAD');
    assert.equal(r.blocked, false);
  });

  it('allows git rev-parse', () => {
    const r = enforcement.isGitWriteCommand('git rev-parse --show-toplevel');
    assert.equal(r.blocked, false);
  });

  it('allows non-git commands', () => {
    const r = enforcement.isGitWriteCommand('echo "not git"');
    assert.equal(r.blocked, false);
  });

  it('allows empty string', () => {
    const r = enforcement.isGitWriteCommand('');
    assert.equal(r.blocked, false);
  });

  it('blocks git with --git-dir flag before subcommand', () => {
    const r = enforcement.isGitWriteCommand('git --git-dir=/path/.git commit -m "test"');
    assert.equal(r.blocked, true);
  });
});

// ── isCjsMediatedGit Tests ──────────────────────────────────────────────────

describe('isCjsMediatedGit', () => {
  it('detects fp-tools.cjs git commit (D-03 exemption)', () => {
    assert.equal(enforcement.isCjsMediatedGit('node fp-tools.cjs git commit'), true);
  });

  it('detects fp-tools.cjs git sync-check', () => {
    assert.equal(enforcement.isCjsMediatedGit('node fp-tools.cjs git sync-check'), true);
  });

  it('returns false for raw git command', () => {
    assert.equal(enforcement.isCjsMediatedGit('git commit -m "test"'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(enforcement.isCjsMediatedGit(''), false);
  });

  it('returns false for null', () => {
    assert.equal(enforcement.isCjsMediatedGit(null), false);
  });
});

// ── parseDelegationResult Tests ─────────────────────────────────────────────

describe('parseDelegationResult', () => {
  const validResult = [
    '## Delegation Result',
    '### Files Modified',
    '- path/to/file.md: updated documentation',
    '- path/to/other.md: added citations',
    '### Enforcement Stages',
    '- Verbosity: PASS',
    '- Citations: PASS',
    '- API Refs: N/A',
    '### Issues',
    '- No issues found',
    '',
    'Delegation complete: [verbosity: PASS] [citations: PASS] [api-refs: N/A]',
  ].join('\n');

  it('parses valid delegation result with hasStructure true', () => {
    const r = enforcement.parseDelegationResult(validResult);
    assert.equal(r.hasStructure, true);
    assert.equal(r.violations.length, 0);
  });

  it('extracts file paths from Files Modified section', () => {
    const r = enforcement.parseDelegationResult(validResult);
    assert.equal(r.filesModified.length, 2);
    assert.ok(r.filesModified.includes('path/to/file.md'));
    assert.ok(r.filesModified.includes('path/to/other.md'));
  });

  it('extracts enforcement stages', () => {
    const r = enforcement.parseDelegationResult(validResult);
    assert.equal(r.enforcementStages.verbosity, 'PASS');
    assert.equal(r.enforcementStages.citations, 'PASS');
    assert.equal(r.enforcementStages['api refs'], 'N/A');
  });

  it('extracts completion marker', () => {
    const r = enforcement.parseDelegationResult(validResult);
    assert.ok(r.completionMarker !== null);
    assert.ok(r.completionMarker.includes('verbosity'));
  });

  it('extracts issues', () => {
    const r = enforcement.parseDelegationResult(validResult);
    assert.ok(r.issues.length > 0);
    assert.ok(r.issues[0].includes('No issues found'));
  });

  it('returns hasStructure false when ## Delegation Result missing', () => {
    const r = enforcement.parseDelegationResult('no structure here');
    assert.equal(r.hasStructure, false);
    assert.ok(r.violations.length > 0);
    assert.ok(r.violations.some(v => v.check === 'delegation_structure'));
  });

  it('detects missing completion marker', () => {
    const noMarker = [
      '## Delegation Result',
      '### Files Modified',
      '- file.md: changed',
      '### Enforcement Stages',
      '- Verbosity: PASS',
      '### Issues',
      '- none',
    ].join('\n');
    const r = enforcement.parseDelegationResult(noMarker);
    assert.ok(r.violations.some(v => v.check === 'completion_marker'));
  });

  it('parses stages with FAIL status', () => {
    const failResult = [
      '## Delegation Result',
      '### Files Modified',
      '- file.md: changed',
      '### Enforcement Stages',
      '- Verbosity: FAIL',
      '- Citations: SKIPPED',
      '- API Refs: PASS',
      '',
      'Delegation complete: [verbosity: FAIL] [citations: SKIPPED] [api-refs: PASS]',
    ].join('\n');
    const r = enforcement.parseDelegationResult(failResult);
    assert.equal(r.enforcementStages.verbosity, 'FAIL');
    assert.equal(r.enforcementStages.citations, 'SKIPPED');
    assert.equal(r.enforcementStages['api refs'], 'PASS');
  });

  it('handles null input gracefully', () => {
    const r = enforcement.parseDelegationResult(null);
    assert.equal(r.hasStructure, false);
    assert.ok(r.violations.length > 0);
  });

  it('handles empty string input', () => {
    const r = enforcement.parseDelegationResult('');
    assert.equal(r.hasStructure, false);
    assert.ok(r.violations.length > 0);
  });
});

// ── verifyStageAuthority Tests ──────────────────────────────────────────────

describe('verifyStageAuthority', () => {
  it('validates modify agent in write phase', () => {
    const r = enforcement.verifyStageAuthority('modify', 'write');
    assert.equal(r.valid, true);
    assert.equal(r.violation, undefined);
  });

  it('validates validate agent in review phase', () => {
    const r = enforcement.verifyStageAuthority('validate', 'review');
    assert.equal(r.valid, true);
  });

  it('validates researcher agent in research phase', () => {
    const r = enforcement.verifyStageAuthority('researcher', 'research');
    assert.equal(r.valid, true);
  });

  it('validates planner agent in plan phase', () => {
    const r = enforcement.verifyStageAuthority('planner', 'plan');
    assert.equal(r.valid, true);
  });

  it('validates orchestrate agent in finalize phase', () => {
    const r = enforcement.verifyStageAuthority('orchestrate', 'finalize');
    assert.equal(r.valid, true);
  });

  it('validates citations agent in write phase', () => {
    const r = enforcement.verifyStageAuthority('citations', 'write');
    assert.equal(r.valid, true);
  });

  it('validates api-refs agent in write phase', () => {
    const r = enforcement.verifyStageAuthority('api-refs', 'write');
    assert.equal(r.valid, true);
  });

  it('validates locals agent in write phase', () => {
    const r = enforcement.verifyStageAuthority('locals', 'write');
    assert.equal(r.valid, true);
  });

  it('rejects modify agent in review phase (mismatch)', () => {
    const r = enforcement.verifyStageAuthority('modify', 'review');
    assert.equal(r.valid, false);
    assert.ok(r.violation.includes('mismatch'));
  });

  it('rejects validate agent in write phase (mismatch)', () => {
    const r = enforcement.verifyStageAuthority('validate', 'write');
    assert.equal(r.valid, false);
    assert.ok(r.violation.includes('mismatch'));
  });

  it('rejects unknown agent type', () => {
    const r = enforcement.verifyStageAuthority('unknown-agent', 'write');
    assert.equal(r.valid, false);
    assert.ok(r.violation.includes('Unknown'));
  });
});

// ── validateStageOutput Tests ───────────────────────────────────────────────

describe('validateStageOutput', () => {
  it('detects HALLUCINATION in stage 4 output', () => {
    const r = enforcement.validateStageOutput(4, { lastMessage: 'HALLUCINATION found in output' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_4_hallucination'));
  });

  it('validates stage 4 with confidence marker and no hallucination', () => {
    const r = enforcement.validateStageOutput(4, { lastMessage: 'Sanity check passed. Confidence: HIGH' });
    assert.equal(r.valid, true);
    assert.equal(r.violations.length, 0);
  });

  it('flags missing confidence marker in stage 4', () => {
    const r = enforcement.validateStageOutput(4, { lastMessage: 'Sanity check passed. No hallucination.' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_4_confidence'));
  });

  it('validates stage 1 with verbosity completion', () => {
    const r = enforcement.validateStageOutput(1, { lastMessage: 'Verbosity enforcement complete.' });
    assert.equal(r.valid, true);
  });

  it('flags missing stage 1 completion', () => {
    const r = enforcement.validateStageOutput(1, { lastMessage: 'Did some work' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_1_completion'));
  });

  it('validates stage 2 with citation completion', () => {
    const r = enforcement.validateStageOutput(2, { lastMessage: 'Citations generated and verified.' });
    assert.equal(r.valid, true);
  });

  it('flags missing stage 2 completion', () => {
    const r = enforcement.validateStageOutput(2, { lastMessage: 'Did some work' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_2_completion'));
  });

  it('validates stage 3 with api-ref completion', () => {
    const r = enforcement.validateStageOutput(3, { lastMessage: 'API Ref generation complete.' });
    assert.equal(r.valid, true);
  });

  it('validates stage 3 with N/A (skipped)', () => {
    const r = enforcement.validateStageOutput(3, { lastMessage: 'API refs: N/A for this doc type' });
    assert.equal(r.valid, true);
  });

  it('flags missing stage 3 completion', () => {
    const r = enforcement.validateStageOutput(3, { lastMessage: 'Did some work' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_3_completion'));
  });

  it('validates stage 5 with verification complete', () => {
    const r = enforcement.validateStageOutput(5, { lastMessage: 'Verification checklist complete: 10-point pass' });
    assert.equal(r.valid, true);
  });

  it('flags missing stage 5 completion', () => {
    const r = enforcement.validateStageOutput(5, { lastMessage: 'Did some work' });
    assert.equal(r.valid, false);
    assert.ok(r.violations.some(v => v.check === 'stage_5_completion'));
  });

  it('always validates stage 6 (deterministic)', () => {
    const r = enforcement.validateStageOutput(6, { lastMessage: '' });
    assert.equal(r.valid, true);
    assert.equal(r.violations.length, 0);
  });

  it('always validates stage 7 (deterministic)', () => {
    const r = enforcement.validateStageOutput(7, { lastMessage: '' });
    assert.equal(r.valid, true);
  });

  it('always validates stage 8 (deterministic)', () => {
    const r = enforcement.validateStageOutput(8, { lastMessage: '' });
    assert.equal(r.valid, true);
  });

  it('handles empty context gracefully', () => {
    const r = enforcement.validateStageOutput(1, {});
    assert.equal(r.valid, false);
  });

  it('handles null context gracefully', () => {
    const r = enforcement.validateStageOutput(1, null);
    assert.equal(r.valid, false);
  });
});

// ── STAGE_AUTHORITY_MAP Tests ───────────────────────────────────────────────

describe('STAGE_AUTHORITY_MAP', () => {
  it('exports the authority map', () => {
    assert.ok(enforcement.STAGE_AUTHORITY_MAP);
    assert.equal(typeof enforcement.STAGE_AUTHORITY_MAP, 'object');
  });

  it('maps all legacy agent names', () => {
    const map = enforcement.STAGE_AUTHORITY_MAP;
    assert.equal(map.researcher, 'research');
    assert.equal(map.planner, 'plan');
    assert.equal(map.modify, 'write');
    assert.equal(map.citations, 'write');
    assert.equal(map['api-refs'], 'write');
    assert.equal(map.locals, 'write');
    assert.equal(map.validate, 'review');
    assert.equal(map.orchestrate, 'finalize');
  });

  it('maps all new fp-docs-* agent names', () => {
    const map = enforcement.STAGE_AUTHORITY_MAP;
    assert.equal(map['fp-docs-researcher'], 'research');
    assert.equal(map['fp-docs-planner'], 'plan');
    assert.equal(map['fp-docs-modifier'], 'write');
    assert.equal(map['fp-docs-citations'], 'write');
    assert.equal(map['fp-docs-api-refs'], 'write');
    assert.equal(map['fp-docs-locals'], 'write');
    assert.equal(map['fp-docs-validator'], 'review');
  });

  it('has exactly 15 entries (7 new fp-docs-* + 8 legacy)', () => {
    assert.equal(Object.keys(enforcement.STAGE_AUTHORITY_MAP).length, 15);
  });
});
