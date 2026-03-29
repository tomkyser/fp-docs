#!/usr/bin/env node
'use strict';

/**
 * fp-tools -- CLI entry point for fp-docs plugin utilities.
 *
 * Per D-07, this is the CLI-first interface: engines invoke `node fp-tools.cjs <command>`
 * for structured data access. All lib modules are also require()-able for tests.
 *
 * Day-one command surface (per D-05):
 *   version    - Plugin version from plugin.json
 *   help       - List all available commands with descriptions
 *   paths      - Three-repo path resolution (plugin-root, codebase-root, docs-root, all)
 *   config     - Config queries (get, section, dump)
 *   route      - Routing table (lookup, table, validate)
 *   health     - System health checks (check, diagnose)
 *   security   - Security utilities (check, validate-path)
 *   source-map - Source-to-doc mapping management (lookup, reverse-lookup, unmapped, generate, dump)
 *   state      - Operation state management (log, last, pipeline, get, dump)
 *   remediate  - Remediation plan management (save, load, list, update)
 *   git        - Three-repo git operations (sync-check, commit, remote-check, watermark, branches)
 *   hooks      - Hook handler dispatch (run <event> [matcher])
 *   locals-cli - Ephemeral WP-CLI lifecycle (setup, teardown)
 *   pipeline   - Pipeline sequencing (init, next, run-stage, status, reset)
 *   drift      - Drift detection and staleness tracking (analyze, status, clear, add-signal, list)
 *   update     - Version checking and self-update (check, status, run)
 *   plans      - Execution plan management (save, load, list, update, prune, save-analysis, load-analysis)
 *
 * Output protocol:
 *   Default: JSON to stdout
 *   --raw:   Bare value for piping
 *
 * Zero external dependencies -- Node.js built-ins only (D-15).
 */

const path = require('path');
const { output, error, safeReadFile, safeJsonParse } = require('./lib/core.cjs');
const paths = require('./lib/paths.cjs');
const security = require('./lib/security.cjs');
const config = require('./lib/config.cjs');
const routing = require('./lib/routing.cjs');
const health = require('./lib/health.cjs');
const state = require('./lib/state.cjs');
const git = require('./lib/git.cjs');

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // Extract --raw flag
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];

  if (!command) {
    error('Usage: fp-tools <command> [subcommand] [args] [--raw]\nRun fp-tools help for available commands');
  }

  switch (command) {
    case 'version': {
      const pluginRoot = paths.getPluginRoot();
      const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
      const content = safeReadFile(pluginJsonPath);
      if (!content) {
        error('Could not read plugin.json');
      }
      const parsed = safeJsonParse(content);
      if (!parsed.ok) {
        error(`Could not parse plugin.json: ${parsed.error}`);
      }
      const version = parsed.data.version;
      output({ version }, raw, version);
      break;
    }

    case 'help': {
      routing.cmdHelp(args[1], raw);
      break;
    }

    case 'paths': {
      const subcommand = args[1];
      if (!subcommand) {
        error('Usage: fp-tools paths <plugin-root|codebase-root|docs-root|all>');
      }

      switch (subcommand) {
        case 'plugin-root': {
          const pluginRoot = paths.getPluginRoot();
          output({ path: pluginRoot }, raw, pluginRoot);
          break;
        }
        case 'codebase-root': {
          const codebaseRoot = paths.getCodebaseRoot();
          output({ path: codebaseRoot }, raw, codebaseRoot);
          break;
        }
        case 'docs-root': {
          const codebaseRoot = paths.getCodebaseRoot();
          const docsRoot = paths.getDocsRoot(codebaseRoot);
          output(docsRoot, raw, docsRoot.path);
          break;
        }
        case 'all': {
          const allPaths = paths.getAllPaths();
          output(allPaths, raw, JSON.stringify(allPaths, null, 2));
          break;
        }
        default:
          error(`Unknown paths subcommand: ${subcommand}. Use: plugin-root, codebase-root, docs-root, all`);
      }
      break;
    }

    case 'config': {
      config.cmdConfig(args[1], args.slice(2), raw);
      break;
    }

    case 'route': {
      routing.cmdRoute(args[1], args.slice(2), raw);
      break;
    }

    case 'health': {
      health.cmdHealth(args[1], args.slice(2), raw);
      break;
    }

    case 'security': {
      const subcommand = args[1];
      if (!subcommand) {
        error('Usage: fp-tools security <check|validate-path> [args]');
      }

      switch (subcommand) {
        case 'check': {
          const text = args.slice(2).join(' ');
          if (!text) {
            error('Usage: fp-tools security check <text>');
          }
          const result = security.scanForInjection(text);
          output(result, raw, result.safe ? 'safe' : `unsafe: ${result.matches.length} matches`);
          break;
        }
        case 'validate-path': {
          const filePath = args[2];
          if (!filePath) {
            error('Usage: fp-tools security validate-path <path>');
          }
          const pluginRoot = paths.getPluginRoot();
          const result = security.validatePath(filePath, pluginRoot);
          output(result, raw, result.safe ? 'safe' : `unsafe: ${result.error}`);
          break;
        }
        default:
          error(`Unknown security subcommand: ${subcommand}. Use: check, validate-path`);
      }
      break;
    }

    case 'state': {
      state.cmdState(args[1], args.slice(2), raw);
      break;
    }

    case 'remediate': {
      state.cmdRemediate(args[1], args.slice(2), raw);
      break;
    }

    case 'git': {
      git.cmdGit(args[1], args.slice(2), raw);
      break;
    }

    case 'hooks': {
      let stdinData = '';
      try {
        if (!process.stdin.isTTY) {
          stdinData = require('fs').readFileSync(0, 'utf-8');
        }
      } catch {
        stdinData = '{}';
      }
      const parsed = safeJsonParse(stdinData);
      const hookInput = parsed.ok ? parsed.data : {};
      const hooks = require('./lib/hooks.cjs');
      hooks.cmdHooks(args[1], args.slice(2), raw, hookInput);
      break;
    }

    case 'locals-cli': {
      const localsCli = require('./lib/locals-cli.cjs');
      localsCli.cmdLocalsCli(args[1], args.slice(2), raw);
      break;
    }

    case 'pipeline': {
      const pipeline = require('./lib/pipeline.cjs');
      pipeline.cmdPipeline(args[1], args.slice(2), raw);
      break;
    }

    case 'drift': {
      const drift = require('./lib/drift.cjs');
      drift.cmdDrift(args[1], args.slice(2), raw);
      break;
    }

    case 'source-map': {
      const sourceMap = require('./lib/source-map.cjs');
      sourceMap.cmdSourceMap(args[1], args.slice(2), raw);
      break;
    }

    case 'update': {
      const update = require('./lib/update.cjs');
      update.cmdUpdate(args[1], args.slice(2), raw);
      break;
    }

    case 'plans': {
      const plans = require('./lib/plans.cjs');
      plans.cmdPlans(args[1], args.slice(2), raw);
      break;
    }

    default:
      error(`Unknown command: ${command}. Run fp-tools help for available commands`);
  }
}

main();
