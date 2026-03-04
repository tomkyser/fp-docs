# CI/CD Automation Research: fp-docs in the FP Build Pipeline

> **Date**: 2026-03-03
> **Status**: Research complete — ready for implementation planning
> **Priority**: URGENT — CircleCI deprecation deadline is March 31, 2026

---

## Executive Summary

The Foreign Policy site runs on WPVIP with a CircleCI build pipeline that compiles assets and deploys to GitHub `-built` branches. **WPVIP is deprecating CircleCI on March 31, 2026** — forcing an immediate migration to GitHub Actions regardless of fp-docs automation goals.

This migration is an opportunity. GitHub Actions is the natural home for Claude Code automation thanks to Anthropic's official `claude-code-action` (6k+ stars, v1.0 GA). The recommended approach:

1. **Migrate the existing CircleCI build to GitHub Actions** (required by March 31)
2. **Add fp-docs automation as a separate GitHub Actions workflow** (independent of the build pipeline)
3. **Use Claude Code headless mode** (`claude -p`) with `ANTHROPIC_API_KEY` for doc operations

Estimated cost: ~$0.50–$2.00/day for typical usage. No impact on build/deploy speed — doc operations run in a parallel workflow.

---

## 1. Current Pipeline Analysis

### CircleCI Configuration

**File**: `.circleci/config.yml`
**Docker image**: `foreignpolicy/ubuntu24.04:php8.2-node20`

| Step | Description | Est. Time |
|------|-------------|-----------|
| 1. Checkout | Blobless clone | ~10s |
| 2. Composer cache restore | Theme lib/autoloaded | ~5s |
| 3. Composer install | `--no-dev` | ~15-30s |
| 4. Composer cache save | vendor/ | ~5s |
| 5. Node cache restore | Theme build/ | ~5s |
| 6. npm install | Build dependencies | ~20-40s |
| 7. Node cache save | node_modules/ | ~5s |
| 8. npm run build | Production assets | ~30-60s |
| 9. Add SSH keys | Deploy key fingerprint | ~2s |
| 10. Deploy | WPVIP deploy.sh → `-built` branch | ~30-60s |
| 11. Slack notify | Pass/fail | ~2s |

**Total estimated pipeline time**: 2-4 minutes

### Branch Strategy

| Branch | Triggers Build | Purpose |
|--------|---------------|---------|
| `master` | Yes | Production |
| `develop` | Yes | Development |
| `staging-01` through `staging-05` | Yes | Staging environments |
| `*-compile` | Yes | Force-compile branches |
| `*-built` | Ignored | Deploy targets (prevent loops) |

### WPVIP Deployment Model

The deploy script (`Automattic/vip-go-build/deploy.sh`) does:
1. Creates/updates a `{branch}-built` branch
2. Copies built assets, removes dev files
3. Respects `.deployignore` (controls what deploys)
4. Pushes the `-built` branch to GitHub
5. WPVIP watches `-built` branches and auto-deploys to their infrastructure

**Key constraint**: The build pipeline's only job is producing the `-built` branch. Documentation is NOT part of deployment — it lives in a separate nested git repo.

---

## 2. WPVIP CI/CD Capabilities

### GitHub Actions Support

- **Status**: Primary CI/CD tool, enabled by default on all wpcomvip repos
- **Runners**: Standard-class Linux runners only
- **Constraints**: Tasks must relate to your WPVIP application; unreasonable usage triggers VIP outreach
- **Sample workflow**: [vip-go-build ci-sample.yml](https://github.com/Automattic/vip-go-build/blob/master/.github/workflows/ci-sample.yml)

### CircleCI Deprecation

- **Deadline**: March 31, 2026 (28 days from now)
- **Announcement**: [WPVIP Lobby, Aug 25 2025](https://lobby.vip.wordpress.com/2025/08/25/circleci-travis-ci-deprecation-date-march-31-2026/)
- **Impact**: Existing CircleCI pipelines will stop working after March 31
- **Action required**: Migrate to GitHub Actions before deadline

### `.deployignore` Behavior

- Created from `.gitignore`, controls what deploys to `-built` branches
- `.deployignore` only works with WPVIP's own build system
- Custom CI services (including our CircleCI config) must handle exclusions manually
- The current deploy.sh script handles this automatically

---

## 3. Claude Code in CI/CD

### Headless Mode (`-p` flag)

Claude Code supports non-interactive execution via the `-p` (or `--print`) flag. This is the foundation for CI/CD integration.

```bash
# Basic headless invocation
claude -p "Your prompt here" --allowedTools "Read,Write,Edit,Grep,Glob,Bash"

# With structured output
claude -p "Audit docs against source" --output-format json --max-turns 10

# With custom system prompt
claude -p "Run sanity check on docs/" --append-system-prompt "Follow fp-docs conventions"
```

### Requirements

| Requirement | Details |
|-------------|---------|
| **Runtime** | Node.js 22+ |
| **Claude Code version** | v1.0.32+ |
| **Authentication** | `ANTHROPIC_API_KEY` environment variable |
| **TTY** | Not required (headless mode works without TTY) |
| **Network** | Requires outbound HTTPS to Anthropic API |

### Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| `text` | `--output-format text` | Default, human-readable |
| `json` | `--output-format json` | Structured with metadata (duration, cost, session_id) |
| `stream-json` | `--output-format stream-json` | Real-time streaming events |

### Key CLI Options for CI

| Flag | Purpose |
|------|---------|
| `--max-turns N` | Limit agent iterations (default: 10 in headless) |
| `--allowedTools "..."` | Auto-approve specific tools without prompting |
| `--output-format json` | Machine-parseable output with cost tracking |
| `--append-system-prompt "..."` | Add instructions while keeping defaults |
| `--json-schema '{...}'` | Enforce structured output schema |
| `--continue` / `--resume ID` | Multi-turn sessions |

### Official GitHub Action

Anthropic provides [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action) (6k stars, MIT license):

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: "Your instructions here"
    claude_args: "--max-turns 10 --model claude-sonnet-4-6"
```

Features:
- Intelligent mode detection (interactive vs automation)
- PR/Issue integration with `@claude` mentions
- Progress tracking with visual indicators
- Structured JSON outputs as GitHub Action outputs
- Runs on your own GitHub runner
- Supports CLAUDE.md for project context
- Supports custom MCP server configs

### Cost Estimates

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Typical CI run |
|-------|----------------------|------------------------|----------------|
| Claude Sonnet 4.6 | $3 | $15 | $0.05–$0.20 |
| Claude Opus 4.6 | $15 | $75 | $0.25–$1.00 |

**Estimated daily cost** (based on 5-10 CI runs/day):
- Sonnet for validation/audit: $0.25–$1.00/day
- Opus for doc generation/updates: $1.00–$5.00/day
- **Recommended hybrid**: Sonnet for validation, Opus only for doc writes: $0.50–$2.00/day

---

## 4. Recommended Automations

### Tier 1: High Value, Low Risk (implement first)

#### A. Documentation Drift Detection (on every push)

**What**: Run `fp-docs:audit --depth quick` to detect docs that are stale relative to changed source files.
**When**: On push to `master`, `develop`, or any staging branch.
**Model**: Sonnet (cheap, fast, read-only).
**Cost**: ~$0.05–$0.10 per run.
**Output**: Comment on PR or commit with drift report. No file changes.

```yaml
- name: fp-docs drift detection
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      Run a quick documentation drift audit. Compare the files changed
      in this push against the docs at themes/foreign-policy-2017/docs/.
      Report which docs are likely stale. Read-only — do not modify files.
    claude_args: "--max-turns 5 --model claude-sonnet-4-6 --allowedTools Read,Grep,Glob,Bash"
```

#### B. Documentation Sanity Check (on PR to master)

**What**: Run `fp-docs:sanity-check` on docs touched by the PR.
**When**: On pull request targeting `master`.
**Model**: Sonnet.
**Cost**: ~$0.10–$0.20 per run.
**Output**: PR comment with sanity check results (VERIFIED/MISMATCH/HALLUCINATION).

```yaml
- name: fp-docs sanity check
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      Sanity-check all documentation files in themes/foreign-policy-2017/docs/
      that relate to source files changed in this PR. Cross-reference every
      factual claim against source code. Report results as VERIFIED, MISMATCH,
      or HALLUCINATION. Read-only — do not modify files.
    claude_args: "--max-turns 10 --model claude-sonnet-4-6 --allowedTools Read,Grep,Glob,Bash"
```

#### C. Docs Branch Sync (on branch creation)

**What**: Automatically create/switch docs repo branch to mirror codebase branch.
**When**: On branch creation for any tracked branch.
**Model**: Not needed — this is pure git scripting (no Claude required).
**Cost**: $0 (shell script only).

```yaml
- name: Sync docs branch
  run: |
    BRANCH="${GITHUB_REF_NAME}"
    DOCS_ROOT="themes/foreign-policy-2017/docs"
    if [ -d "$DOCS_ROOT/.git" ]; then
      DOCS_BRANCH=$(git -C "$DOCS_ROOT" branch --show-current)
      if [ "$DOCS_BRANCH" != "$BRANCH" ]; then
        git -C "$DOCS_ROOT" checkout -B "$BRANCH" master 2>/dev/null || \
        git -C "$DOCS_ROOT" checkout "$BRANCH"
      fi
    fi
```

### Tier 2: Medium Value, Medium Risk (implement after Tier 1 is stable)

#### D. Auto-Update Documentation (on merge to master)

**What**: Run `fp-docs:auto-update` to automatically update docs for changed source files.
**When**: On push to `master` (after PR merge).
**Model**: Opus (needs write capability and deep code analysis).
**Cost**: ~$0.50–$1.00 per run.
**Output**: Commits updated docs to the docs repo, pushes to remote.

```yaml
- name: fp-docs auto-update
  uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      Run fp-docs auto-update. Scan git diff from the last commit on master.
      Identify source files that changed and their corresponding docs.
      Update stale documentation to reflect code changes.
      Commit and push to the docs repo.
    claude_args: >-
      --max-turns 30
      --model claude-opus-4-6
      --allowedTools Read,Write,Edit,Grep,Glob,Bash
```

**Risk mitigation**: Start with `--max-turns 15` and a dry-run mode. Review first few runs manually before trusting fully.

#### E. Citation Freshness Check (weekly scheduled)

**What**: Run `fp-docs:citations verify` to detect stale code citations.
**When**: Weekly cron schedule (e.g., Monday 9 AM).
**Model**: Sonnet (read-only verification).
**Cost**: ~$0.20–$0.50 per run (once per week = negligible).
**Output**: Issue or Slack notification with stale citation report.

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9 AM UTC
```

### Tier 3: High Value, Higher Complexity (future consideration)

#### F. Full Pipeline on PR (verify + sanity-check + citations)

**What**: Run the full fp-docs verification suite on docs touched by a PR.
**When**: On PR targeting master or develop.
**Model**: Sonnet for verify/sanity; Opus for citations if updates needed.
**Cost**: ~$0.30–$0.80 per run.
**Complexity**: Needs careful orchestration of multiple fp-docs operations.

#### G. PR Documentation Review with `@claude`

**What**: Enable `@claude` mentions in PRs to ask doc-related questions.
**When**: On demand (user types `@claude` in PR comment).
**Model**: Sonnet or Opus depending on task.
**Cost**: Variable, per-interaction.
**Setup**: Use the claude-code-action interactive mode.

### Operations NOT Recommended for CI

| Operation | Reason |
|-----------|--------|
| `fp-docs:add` (new doc creation) | Requires human judgment on scope, audience, structure |
| `fp-docs:revise` (targeted fixes) | Inherently human-driven ("fix X") |
| `fp-docs:deprecate` | Requires editorial decision |
| `fp-docs:auto-revise` (batch revision) | Too expensive and unpredictable for CI |
| Full verbosity enforcement | High token cost, better as part of manual pipeline |

---

## 5. Implementation Architecture

### Recommended: Two Separate Workflows

The fp-docs automation should be **completely separate** from the build/deploy pipeline. Rationale:

1. Build pipeline must be fast and reliable — doc operations add latency and potential failure points
2. Doc operations don't affect the deployed site
3. Different branch triggers and conditions
4. Different failure handling (doc failure = warning, build failure = blocker)

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│                    (wpcomvip/fp)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Push to master/develop/staging-*                       │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  Workflow 1   │    │  Workflow 2                  │   │
│  │  BUILD+DEPLOY │    │  FP-DOCS AUTOMATION          │   │
│  │  (required)   │    │  (parallel, non-blocking)    │   │
│  │               │    │                              │   │
│  │ ┌──────────┐  │    │ ┌────────────────────────┐   │   │
│  │ │ Checkout │  │    │ │ Checkout               │   │   │
│  │ │ Composer │  │    │ │ Setup Node 22          │   │   │
│  │ │ NPM      │  │    │ │ Install Claude Code    │   │   │
│  │ │ Build    │  │    │ │                        │   │   │
│  │ │ Deploy   │  │    │ │ ┌──────────────────┐   │   │   │
│  │ │ Slack    │  │    │ │ │ Drift Detection  │   │   │   │
│  │ └──────────┘  │    │ │ │ (Sonnet, ~$0.10) │   │   │   │
│  │               │    │ │ └──────────────────┘   │   │   │
│  │  ≈ 3 min      │    │ │ ┌──────────────────┐   │   │   │
│  │               │    │ │ │ Branch Sync      │   │   │   │
│  │               │    │ │ │ (shell, $0)      │   │   │   │
│  │               │    │ │ └──────────────────┘   │   │   │
│  │               │    │ │                        │   │   │
│  │               │    │ │ If master:             │   │   │
│  │               │    │ │ ┌──────────────────┐   │   │   │
│  │               │    │ │ │ Auto-Update Docs │   │   │   │
│  │               │    │ │ │ (Opus, ~$0.75)   │   │   │   │
│  │               │    │ │ └──────────────────┘   │   │   │
│  │               │    │ └────────────────────────┘   │   │
│  │               │    │  ≈ 3-8 min                   │   │
│  └──────────────┘    └──────────────────────────────┘   │
│                                                         │
│  On PR to master:                                       │
│  ┌──────────────────────────────────────┐               │
│  │  Workflow 3: FP-DOCS PR CHECK        │               │
│  │  ┌────────────────────────────┐      │               │
│  │  │ Sanity Check (Sonnet)     │      │               │
│  │  │ → PR comment with results  │      │               │
│  │  └────────────────────────────┘      │               │
│  │  ≈ 2-5 min                           │               │
│  └──────────────────────────────────────┘               │
│                                                         │
│  Weekly (Monday 9 AM):                                  │
│  ┌──────────────────────────────────────┐               │
│  │  Workflow 4: FP-DOCS HEALTH CHECK    │               │
│  │  ┌────────────────────────────┐      │               │
│  │  │ Citation Verify (Sonnet)  │      │               │
│  │  │ → Issue with report        │      │               │
│  │  └────────────────────────────┘      │               │
│  │  ≈ 5-10 min                          │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### Workflow File Structure

```
.github/
  workflows/
    build-deploy.yml          # Workflow 1: Migrated from CircleCI (required)
    fp-docs-push.yml          # Workflow 2: Doc automation on push
    fp-docs-pr-check.yml      # Workflow 3: Doc validation on PR
    fp-docs-health.yml        # Workflow 4: Weekly health check
```

---

## 6. Migration Plan: CircleCI → GitHub Actions

### Phase 1: Migrate Build Pipeline (URGENT — by March 31, 2026)

Convert the existing CircleCI config to a GitHub Actions workflow. This is a 1:1 migration with no fp-docs additions.

```yaml
# .github/workflows/build-deploy.yml
name: Build and Deploy Foreign Policy

on:
  push:
    branches:
      - master
      - develop
      - staging-01
      - staging-02
      - staging-03
      - staging-04
      - staging-05
    branches-ignore:
      - '*-built'
    # Also match *-compile branches:
    # GitHub Actions doesn't support regex like CircleCI, so use path filtering
    # or add specific compile branches as needed

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    container:
      image: foreignpolicy/ubuntu24.04:php8.2-node20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # Composer
      - name: Cache Composer dependencies
        uses: actions/cache@v4
        with:
          path: themes/foreign-policy-2017/lib/autoloaded/vendor
          key: composer-${{ hashFiles('themes/foreign-policy-2017/lib/autoloaded/composer.lock') }}

      - name: Install Composer dependencies
        run: composer install --no-dev
        working-directory: themes/foreign-policy-2017/lib/autoloaded

      # Node
      - name: Cache Node modules
        uses: actions/cache@v4
        with:
          path: themes/foreign-policy-2017/build/node_modules
          key: node-${{ hashFiles('themes/foreign-policy-2017/build/package.json') }}

      - name: Install Node dependencies
        run: npm install
        working-directory: themes/foreign-policy-2017/build

      - name: Build production assets
        run: npm run build --production
        working-directory: themes/foreign-policy-2017/build

      # Deploy
      - name: Deploy to WPVIP
        env:
          GIT_SSH_COMMAND: "ssh -o StrictHostKeyChecking=no"
        run: bash <(curl -s "https://raw.githubusercontent.com/Automattic/vip-go-build/master/deploy.sh")

      # Slack (use official Slack action instead of CircleCI orb)
      - name: Slack notification (success)
        if: success()
        uses: slackapi/slack-github-action@v2
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          webhook-type: incoming-webhook
          payload: |
            {"text": "FP Build & Deploy succeeded on ${{ github.ref_name }}"}

      - name: Slack notification (failure)
        if: failure()
        uses: slackapi/slack-github-action@v2
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
          webhook-type: incoming-webhook
          payload: |
            {"text": "FP Build & Deploy FAILED on ${{ github.ref_name }}"}
```

**Migration notes**:
- SSH key: Add deploy key as a GitHub Actions secret (`SSH_PRIVATE_KEY`) and use `webfactory/ssh-agent` action, or use WPVIP's recommended deploy approach
- Slack: Replace CircleCI orb with `slackapi/slack-github-action@v2`
- Docker image: Can use same custom image via `container:` or switch to standard runners with setup steps
- `*-compile` branches: GitHub Actions uses glob patterns, not regex. Use `branches` list or a `paths` filter

### Phase 2: Add fp-docs Automation (after build migration is stable)

Add the separate doc automation workflows. Start with Tier 1 only.

### Phase 3: Expand Automation (after Tier 1 is proven)

Add Tier 2 operations (auto-update, citation checks).

---

## 7. Prerequisites and Setup Steps

### Secrets Required

| Secret | Where | Purpose |
|--------|-------|---------|
| `ANTHROPIC_API_KEY` | GitHub repo secrets | Claude Code API authentication |
| `SLACK_WEBHOOK_URL` | GitHub repo secrets | Slack notifications (existing) |
| SSH deploy key | GitHub repo secrets | WPVIP deployment (existing) |

### API Key Setup

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to GitHub repo: Settings → Secrets and variables → Actions → New repository secret
3. Name: `ANTHROPIC_API_KEY`
4. The key needs access to Claude Sonnet 4.6 (and Opus 4.6 if using Tier 2)

### CLAUDE.md for CI Context

The existing `CLAUDE.md` in the repo root will be automatically loaded by Claude Code in CI. Ensure it contains fp-docs operational context so Claude understands the documentation system.

### fp-docs Plugin Availability

For Claude Code to run fp-docs operations in CI, one of these must be true:
- The fp-docs plugin is installed in the CI environment (via `--plugin-dir` or marketplace install)
- OR: The fp-docs prompt content is inlined into the Claude Code `--append-system-prompt` or CLAUDE.md
- OR: The CI workflow uses raw `claude -p` prompts that describe the operation without relying on fp-docs plugin infrastructure

**Recommendation**: For Tier 1 (read-only audit/sanity-check), use raw prompts — they're simpler and don't need the plugin installed. For Tier 2 (auto-update with pipeline), the plugin would need to be available in the CI runner.

---

## 8. Cost and Performance Estimates

### Per-Run Costs

| Automation | Model | Tokens (est.) | Cost/Run |
|------------|-------|---------------|----------|
| Drift detection | Sonnet | ~10K in / 2K out | ~$0.06 |
| Sanity check | Sonnet | ~30K in / 5K out | ~$0.17 |
| Citation verify | Sonnet | ~20K in / 3K out | ~$0.10 |
| Auto-update (small) | Opus | ~50K in / 10K out | ~$1.50 |
| Auto-update (large) | Opus | ~100K in / 20K out | ~$3.00 |

### Monthly Cost Projections

| Scenario | Assumptions | Monthly Cost |
|----------|-------------|-------------|
| Tier 1 only | 10 pushes/day × drift detection | ~$18/mo |
| Tier 1 + PR checks | + 5 PRs/week × sanity check | ~$22/mo |
| Tier 1 + Tier 2 | + 3 master merges/week × auto-update | ~$40-60/mo |
| Full suite | All tiers + weekly health + @claude | ~$60-100/mo |

### Pipeline Time Impact

| Automation | Time Added | Impact on Build |
|------------|-----------|----------------|
| Drift detection | 1-3 min | None (parallel workflow) |
| Sanity check | 2-5 min | None (PR workflow) |
| Branch sync | <10s | None (shell script) |
| Auto-update | 3-10 min | None (parallel workflow) |
| Citation verify | 5-10 min | None (scheduled) |

**Zero impact on build/deploy time** — all fp-docs operations run in separate workflows.

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API costs spike unexpectedly | Medium | Medium | Set `--max-turns` limits; use Sonnet by default; add billing alerts |
| Auto-update makes incorrect changes | Medium | High | Start with dry-run; require PR review; limit to master only |
| Claude Code rate limits hit | Low | Medium | Stagger workflows; use concurrency controls |
| CI runner timeout | Low | Low | Set `timeout-minutes` on jobs; use `--max-turns` |
| API key exposure | Low | High | Use GitHub Secrets; never log the key; rotate regularly |
| CircleCI migration breaks deploy | Medium | Critical | Test on staging branches first; keep CircleCI active until GA confirms |
| fp-docs plugin not available in CI | Medium | Medium | Use raw prompts for Tier 1; only install plugin for Tier 2 |
| WPVIP runner limits | Low | Medium | Doc workflows are lightweight; monitor usage |

---

## 10. Decision Matrix

| Factor | CircleCI | GitHub Actions | Recommendation |
|--------|----------|---------------|----------------|
| WPVIP support | Deprecated Mar 31 | Primary, enabled by default | **GitHub Actions** |
| Claude Code integration | Manual setup | Official action (`claude-code-action@v1`) | **GitHub Actions** |
| Existing config | Working, proven | Needs migration | Migration required regardless |
| Slack integration | CircleCI orb | `slackapi/slack-github-action` | Equivalent |
| Caching | CircleCI native | `actions/cache@v4` | Equivalent |
| Docker support | Native | `container:` directive | Equivalent |
| Cost | Included in WPVIP | Included in WPVIP (Standard runners) | Equivalent |
| Branch triggers | Regex support | Glob patterns | CircleCI slightly better, but workable |

**Verdict**: GitHub Actions is the only viable option. CircleCI is being shut down.

---

## 11. Next Steps

### Immediate (this week)

1. [ ] Create `build-deploy.yml` — migrate CircleCI config to GitHub Actions
2. [ ] Test on a staging branch (staging-01)
3. [ ] Add `ANTHROPIC_API_KEY` to GitHub repo secrets
4. [ ] Verify deploy.sh works with GitHub Actions authentication

### Short-term (next 2 weeks)

5. [ ] Deploy GitHub Actions build pipeline to all branches
6. [ ] Decommission CircleCI config before March 31 deadline
7. [ ] Add `fp-docs-push.yml` with drift detection (Tier 1A)
8. [ ] Add `fp-docs-pr-check.yml` with sanity check (Tier 1B)

### Medium-term (month 2)

9. [ ] Monitor costs and accuracy of Tier 1 automations
10. [ ] Add `fp-docs-health.yml` with weekly citation verify (Tier 2E)
11. [ ] Evaluate auto-update results; decide on Tier 2D

### Long-term (month 3+)

12. [ ] Enable `@claude` interactive mode for PR doc questions (Tier 3G)
13. [ ] Full fp-docs verification suite in CI (Tier 3F)
14. [ ] Consider installing fp-docs plugin in CI runner for full pipeline access

---

## Sources

- [WPVIP CI/CD Documentation](https://docs.wpvip.com/code-deployment/default-deployment/build-and-deploy/ci-cd/)
- [WPVIP GitHub Actions](https://docs.wpvip.com/code-deployment/default-deployment/build-and-deploy/github-actions/)
- [CircleCI & Travis CI Deprecation Announcement](https://lobby.vip.wordpress.com/2025/08/25/circleci-travis-ci-deprecation-date-march-31-2026/)
- [Claude Code Headless Mode Docs](https://code.claude.com/docs/en/headless)
- [Claude Code GitHub Actions Docs](https://code.claude.com/docs/en/github-actions)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)
- [WPVIP vip-go-build Deploy Script](https://github.com/Automattic/vip-go-build)
- [SFEIR Claude Code CI/CD Guide](https://institute.sfeir.com/en/claude-code/claude-code-headless-mode-and-ci-cd/cheatsheet/)
- [GitHub: Migrating from CircleCI to GitHub Actions](https://docs.github.com/en/actions/migrating-to-github-actions/manually-migrating-to-github-actions/migrating-from-circleci-to-github-actions)
