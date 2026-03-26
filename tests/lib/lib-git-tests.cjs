'use strict';

// Tests for fp-docs/plugins/fp-docs/lib/git.cjs
// TDD RED phase: Tests written first, then implementation.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const LIB_DIR = path.resolve(__dirname, '..', '..', 'plugins', 'fp-docs', 'lib');

describe('lib/git.cjs', () => {
  it('should be requireable', () => {
    const git = require(path.join(LIB_DIR, 'git.cjs'));
    assert.ok(git);
  });

  it('should export all required functions', () => {
    const git = require(path.join(LIB_DIR, 'git.cjs'));
    const expectedExports = [
      'gitExec', 'checkRemoteAccessible', 'pullLatest', 'pushDocs',
      'getCurrentBranch', 'getBranches', 'syncCheck', 'commitDocs',
      'readWatermark', 'writeWatermark', 'validateWatermark',
      'parseFlags', 'classifyGitError', 'getRecoveryHint', 'makeGitError',
      'cmdGit',
    ];
    for (const name of expectedExports) {
      assert.equal(typeof git[name], 'function', `should export ${name}`);
    }
  });

  // ── Watermark tests ──────────────────────────────────────────────────────

  describe('readWatermark', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should parse valid watermark file into structured object', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const watermarkPath = path.join(tmpDir, '.sync-watermark');
      fs.writeFileSync(watermarkPath, [
        '# fp-docs sync watermark -- do not edit manually',
        '# Records the codebase state that docs were last synced against.',
        'codebase_branch=master',
        'codebase_commit=abc1234def5678',
        'sync_timestamp=2026-03-20T15:30:00.000Z',
        '',
      ].join('\n'));
      const result = git.readWatermark(tmpDir);
      assert.ok(result, 'should return an object');
      assert.equal(result.codebase_branch, 'master');
      assert.equal(result.codebase_commit, 'abc1234def5678');
      assert.equal(result.sync_timestamp, '2026-03-20T15:30:00.000Z');
    });

    it('should return null for missing file', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const result = git.readWatermark('/nonexistent/path/does-not-exist');
      assert.equal(result, null);
    });

    it('should return null for malformed file (missing codebase_commit)', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const malformedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-malformed-'));
      const watermarkPath = path.join(malformedDir, '.sync-watermark');
      fs.writeFileSync(watermarkPath, [
        '# fp-docs sync watermark',
        'codebase_branch=master',
        'sync_timestamp=2026-03-20T15:30:00.000Z',
        '',
      ].join('\n'));
      const result = git.readWatermark(malformedDir);
      assert.equal(result, null);
      fs.rmSync(malformedDir, { recursive: true, force: true });
    });

    it('should ignore comment lines starting with #', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const commentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-comment-'));
      const watermarkPath = path.join(commentDir, '.sync-watermark');
      fs.writeFileSync(watermarkPath, [
        '# This is a comment',
        '# Another comment',
        'codebase_branch=develop',
        'codebase_commit=deadbeef12345678',
        'sync_timestamp=2026-03-20T12:00:00.000Z',
        '',
      ].join('\n'));
      const result = git.readWatermark(commentDir);
      assert.ok(result, 'should return an object');
      assert.equal(result.codebase_branch, 'develop');
      assert.equal(result.codebase_commit, 'deadbeef12345678');
      fs.rmSync(commentDir, { recursive: true, force: true });
    });
  });

  describe('writeWatermark', () => {
    let tmpDir;

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-write-'));
    });

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should create file with shell-parseable key=value format (not JSON)', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      git.writeWatermark(tmpDir, 'master', 'abc1234def5678');
      const content = fs.readFileSync(path.join(tmpDir, '.sync-watermark'), 'utf-8');
      // Must NOT be JSON
      assert.ok(!content.startsWith('{'), 'should not be JSON');
      assert.ok(!content.startsWith('['), 'should not be JSON');
      // Must contain key=value lines
      assert.ok(content.includes('codebase_branch='), 'should contain codebase_branch=');
      assert.ok(content.includes('codebase_commit='), 'should contain codebase_commit=');
      assert.ok(content.includes('sync_timestamp='), 'should contain sync_timestamp=');
    });

    it('should contain codebase_branch=, codebase_commit=, sync_timestamp=', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      git.writeWatermark(tmpDir, 'feature/test', 'feedface99887766');
      const content = fs.readFileSync(path.join(tmpDir, '.sync-watermark'), 'utf-8');
      assert.ok(content.includes('codebase_branch=feature/test'));
      assert.ok(content.includes('codebase_commit=feedface99887766'));
      assert.match(content, /sync_timestamp=\d{4}-\d{2}-\d{2}T/);
    });

    it('should start with "# fp-docs sync watermark"', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      git.writeWatermark(tmpDir, 'master', 'abc123');
      const content = fs.readFileSync(path.join(tmpDir, '.sync-watermark'), 'utf-8');
      assert.ok(content.startsWith('# fp-docs sync watermark'), 'should start with header comment');
    });
  });

  // ── Error classification tests ──────────────────────────────────────────

  describe('classifyGitError', () => {
    it('should return auth_failure for "permission denied"', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      assert.equal(git.classifyGitError('Permission denied (publickey)', 128), 'auth_failure');
    });

    it('should return auth_failure for "could not read from remote"', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      assert.equal(git.classifyGitError('fatal: Could not read from remote repository.', 128), 'auth_failure');
    });

    it('should return unreachable for generic stderr', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      assert.equal(git.classifyGitError('fatal: unable to access remote', 1), 'unreachable');
    });
  });

  // ── Recovery hint tests ──────────────────────────────────────────────────

  describe('getRecoveryHint', () => {
    it('should return string containing --offline for remote operations', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const hint = git.getRecoveryHint('ls-remote', 'connection refused');
      assert.ok(typeof hint === 'string', 'should return a string');
      assert.ok(hint.includes('--offline'), 'should mention --offline flag');
    });
  });

  // ── makeGitError tests ──────────────────────────────────────────────────

  describe('makeGitError', () => {
    it('should return object with type, message, diagnostic, recovery_hint keys (per D-14)', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      const err = git.makeGitError('auth_failure', 'Cannot authenticate', 'SSH key expired', 'Run ssh-add');
      assert.ok('type' in err, 'should have type');
      assert.ok('message' in err, 'should have message');
      assert.ok('diagnostic' in err, 'should have diagnostic');
      assert.ok('recovery_hint' in err, 'should have recovery_hint');
      assert.equal(err.type, 'auth_failure');
      assert.equal(err.message, 'Cannot authenticate');
      assert.equal(err.diagnostic, 'SSH key expired');
      assert.equal(err.recovery_hint, 'Run ssh-add');
    });
  });

  // ── parseFlags tests ──────────────────────────────────────────────────

  describe('parseFlags', () => {
    it('should extract --offline and --no-push, with --offline implying --no-push (per D-13)', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));

      // Default: both false
      const defaults = git.parseFlags([]);
      assert.equal(defaults.offline, false);
      assert.equal(defaults.noPush, false);

      // --no-push only
      const noPushOnly = git.parseFlags(['--no-push']);
      assert.equal(noPushOnly.offline, false);
      assert.equal(noPushOnly.noPush, true);

      // --offline implies --no-push
      const offlineOnly = git.parseFlags(['--offline']);
      assert.equal(offlineOnly.offline, true);
      assert.equal(offlineOnly.noPush, true, '--offline should imply --no-push');

      // Mixed args
      const mixed = git.parseFlags(['some-arg', '--offline', 'another']);
      assert.equal(mixed.offline, true);
      assert.equal(mixed.noPush, true);
    });
  });

  // ── getCurrentBranch integration test ──────────────────────────────────

  describe('getCurrentBranch', () => {
    it('should call git branch --show-current (integration test against real repo)', () => {
      const git = require(path.join(LIB_DIR, 'git.cjs'));
      // The test runs inside the cc-plugins git repo, so this should work
      const repoRoot = path.resolve(__dirname, '..', '..', '..');
      const branch = git.getCurrentBranch(repoRoot);
      // Should return a string (the current branch name)
      assert.ok(typeof branch === 'string', 'should return a string');
      assert.ok(branch.length > 0, 'branch name should not be empty');
    });
  });
});
