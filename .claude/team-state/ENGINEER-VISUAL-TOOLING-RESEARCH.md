# Visual Tooling Research Report — Phase 1
> Engineer: team-engineer | Wave 3: User-Facing Documentation
> Date: 2026-04-09

---

## 1. Playwright MCP — Current State

### Already Configured
The Playwright MCP server is **fully configured** in `fp-docs/.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y", "@playwright/mcp@0.0.68",
        "--ignore-https-errors",
        "--caps", "vision",
        "--config", "${CLAUDE_PLUGIN_ROOT}/playwright-mcp-config.json"
      ]
    }
  }
}
```

**Config** (`playwright-mcp-config.json`):
```json
{
  "browser": {
    "launchOptions": { "args": ["--ignore-certificate-errors"] },
    "contextOptions": { "ignoreHTTPSErrors": true }
  }
}
```

### Self-Signed SSL: SOLVED
Double-layered SSL bypass is already in place:
1. CLI flag: `--ignore-https-errors`
2. Browser launch args: `--ignore-certificate-errors`
3. Context option: `ignoreHTTPSErrors: true`

The live site at `https://foreignpolicy.local/` returns HTTP 200 — confirmed accessible.

### Available MCP Tools
When the Playwright MCP server is active, it provides these tools to Claude Code:

| Category | Tools | Description |
|----------|-------|-------------|
| **Navigation** | `browser_navigate`, back, forward, reload | Open URLs, browser history |
| **Interaction** | click, type, fill, select, hover, drag | Page element manipulation |
| **Capture** | `browser_screenshot` | Viewport or element screenshots |
| **Code Exec** | `browser_run_code` | Execute arbitrary Playwright scripts |
| **State** | save/restore state, cookie management | Persist login sessions |
| **Network** | view requests, mock routes, console | Debug and inspect |
| **Tabs** | create, close, switch tabs | Multi-page workflows |
| **Dialogs** | accept, dismiss | Handle browser prompts |
| **Snapshots** | accessibility, text, full DOM | Page structure introspection |

### Version Note
Currently pinned at `@0.0.68`, latest is `0.0.70`. Minor update available — recommend bumping during Phase 2 implementation.

### Capability Gaps
The `--caps vision` flag enables screenshot capture. Additional optional caps:
- `pdf` — Generate PDF from pages (could be useful for printable user guides)
- `devtools` — DevTools protocol access (not needed for user docs)

**Recommendation**: Add `pdf` cap for Phase 2: `--caps vision,pdf`

---

## 2. Screenshot Capabilities

### Primary Tool: Playwright MCP `browser_screenshot`
- Captures current viewport as PNG
- Works through MCP protocol — Claude Code can invoke directly
- Returns image data that Claude can analyze (vision model)

### Advanced: `browser_run_code` for Custom Captures
For element-level and full-page screenshots, use `browser_run_code` to execute Playwright scripts:

```javascript
// Full-page screenshot
await page.screenshot({ path: 'full-page.png', fullPage: true });

// Element-level screenshot
await page.locator('#main-content').screenshot({ path: 'element.png' });

// Specific viewport size
await page.setViewportSize({ width: 1280, height: 720 });
await page.screenshot({ path: 'viewport.png' });

// With element masking (hide sensitive data)
await page.screenshot({
  path: 'masked.png',
  mask: [page.locator('.user-email'), page.locator('.api-key')]
});
```

### Screenshot Options
| Option | Description | Use Case |
|--------|-------------|----------|
| `fullPage: true` | Entire scrollable page | Long content pages |
| `clip: {x, y, width, height}` | Specific region | UI component docs |
| Element `.screenshot()` | Single element | Widget/button guides |
| `mask: [locators]` | Hide elements | Sensitive data redaction |
| `type: 'jpeg'` | JPEG format | Smaller file size |
| `quality: 80` | Compression | Balance size vs quality |

### Format Recommendations
- **PNG** for UI screenshots (lossless, sharp text)
- **JPEG at quality 80** for full-page captures (smaller files)
- Target resolution: **1280x720** viewport (standard HD, readable in docs)

---

## 3. Screen Recording & Video Capture

### Primary Tool: Playwright Screencast API (v1.59+)
Playwright 1.59.1 is installed locally (`npx playwright --version` confirmed). The new Screencast API is **the recommended approach**.

#### API Surface

```javascript
// Start recording
await page.screencast.start({ path: 'workflow.webm', quality: 80 });

// Add chapter markers for workflow segments
await page.screencast.showChapter('Step 1: Navigate to Dashboard', {
  description: 'Open the WordPress admin panel',
  duration: 2000
});

// Show action annotations (highlights clicked elements)
await page.screencast.showActions({ position: 'top-right', fontSize: 24 });

// Custom overlay (e.g., callout box)
await page.screencast.showOverlay('<div style="...">Click here</div>', {
  duration: 3000
});

// Stop and save
await page.screencast.stop();
```

#### Key Methods
| Method | Purpose | For User Docs |
|--------|---------|---------------|
| `start({path, quality, size})` | Begin recording to WebM | Record entire workflow |
| `showChapter(title, opts)` | Chapter title overlay | Label workflow steps |
| `showActions(opts)` | Highlight interacted elements | Show where to click |
| `showOverlay(html, opts)` | Custom HTML overlay | Callouts, annotations |
| `hideActions()` / `hideOverlays()` | Remove decorations | Clean transitions |
| `stop()` | Finalize recording | Save output |

#### Output Format
- **WebM** (VP8/VP9 codec) — native Playwright output
- Configurable quality (0-100) and frame size
- Annotation overlays baked into the video

### GIF Conversion
For inline doc previews, convert WebM to GIF:

```bash
# Two-pass for optimal quality/size
ffmpeg -y -i workflow.webm -vf palettegen palette.png
ffmpeg -y -i workflow.webm -i palette.png -filter_complex "fps=10,scale=640:-1,paletteuse" workflow.gif
```

**Note**: `ffmpeg` is NOT currently installed on this machine. Needs `brew install ffmpeg` for Phase 2.

### Alternative: Playwright Video Recording (Simpler)
```javascript
const context = await browser.newContext({
  recordVideo: { dir: './videos/', size: { width: 1280, height: 720 } }
});
// ... do actions ...
await context.close(); // Video saved automatically
```
- Simpler but no annotations/chapters
- Good for raw captures, not annotated walkthroughs

### Recommendation
Use **Screencast API** for annotated workflow walkthroughs (primary), **basic video recording** for quick raw captures. GIF conversion for inline previews in Hugo.

---

## 4. Storage & Versioning Strategy

### Recommendation: Git LFS for Binary Assets

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Git LFS** | Pointer files in repo, actual binaries on remote; clean diffs; standard tooling | Requires LFS setup; GitHub LFS bandwidth limits (1GB free) | **RECOMMENDED** |
| **Regular Git** | Simple, no extra setup | Repo bloat, slow clones, every version stored fully | Not viable for video |
| **CDN/External** | Fastest delivery, no repo impact | External dependency, separate auth, URL management | Overkill for private docs |
| **Separate assets repo** | Clean separation | Complex cross-repo references, more repos to manage | Unnecessary complexity |

### LFS Configuration

```bash
# In the docs repo
git lfs install
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.gif"
git lfs track "*.webm"
git lfs track "*.mp4"
```

### Directory Structure (within docs repo)
```
docs/
├── user-guide/                    # User-facing docs (Hugo content)
│   ├── getting-started/
│   │   ├── _index.md
│   │   └── images/               # Co-located with content
│   │       ├── dashboard-overview.png
│   │       └── login-flow.webm
│   ├── content-editing/
│   │   ├── _index.md
│   │   └── images/
│   │       ├── editor-toolbar.png
│   │       └── publish-workflow.gif
│   └── _index.md
└── assets/                        # Shared assets (if needed)
    └── videos/
```

### Size Budget
- Screenshots: ~50-200KB each (PNG, 1280x720)
- GIFs: ~500KB-2MB each (10fps, 640px wide, optimized)
- WebM videos: ~1-5MB each (720p, 80 quality)
- GitHub LFS free tier: 1GB storage, 1GB bandwidth/month
- Estimated initial asset volume: ~50 screenshots + ~10 recordings = ~50MB total

### Hugo Page Bundles
Co-locating images with content using Hugo page bundles is the cleanest approach — each page's images live next to its markdown file, referenced with relative paths.

---

## 5. Hugo Integration

### Images in Hugo Book Theme

**Standard Markdown** (simplest):
```markdown
![Dashboard overview](images/dashboard-overview.png)
```

**Hugo Figure Shortcode** (with caption):
```
{{< figure src="images/dashboard-overview.png" alt="WordPress dashboard" caption="The FP WordPress admin dashboard showing the main navigation" >}}
```

**Figure shortcode parameters**: `src`, `alt`, `caption`, `title`, `link`, `class`, `width`, `height`, `loading` (lazy)

### Video Embedding

**Option A: hugo-video theme component** (recommended):
```
{{< video src="images/publish-workflow" autoplay="true" loop="true" muted="true" >}}
```
- Auto-detects `.mp4` and `.webm` sources
- Uses poster frame if image with same name exists
- Supports `controls`, `autoplay`, `loop`, `muted`

**Option B: Custom shortcode** (more control):
Create `layouts/shortcodes/video.html`:
```html
<figure{{ with .Get "class" }} class="{{ . }}"{{ end }}>
  <video {{ if .Get "autoplay" }}autoplay{{ end }} {{ if .Get "loop" }}loop{{ end }} muted playsinline>
    <source src="{{ .Get "src" }}" type="video/{{ .Get "type" | default "webm" }}">
  </video>
  {{ with .Get "caption" }}<figcaption>{{ . }}</figcaption>{{ end }}
</figure>
```

**Option C: GIF inline** (simplest for short workflows):
```markdown
![Publishing a post](images/publish-workflow.gif)
```

### Hugo Book Theme Notes
- Requires `markup.goldmark.renderer.unsafe=true` for some shortcodes
- Built-in shortcodes: buttons, columns, details, hints, tabs, steps (useful for user docs!)
- Mermaid diagrams built-in (useful for workflow diagrams)
- No built-in video shortcode — need to add one

### Recommended Approach
1. **Screenshots**: Hugo `figure` shortcode with `loading=lazy` for captions
2. **Short workflows** (< 10s): GIF inline with standard markdown image syntax
3. **Long workflows** (> 10s): WebM via custom `video` shortcode with autoplay/loop/muted
4. **Workflow diagrams**: Mermaid (already built-in)

---

## 6. Automated Screenshot Pipeline Design

### Concept: Screenshot Manifest
A JSON manifest defines screenshots to capture for each doc page:

```json
{
  "pages": [
    {
      "doc": "user-guide/getting-started/_index.md",
      "captures": [
        {
          "id": "dashboard-overview",
          "url": "https://foreignpolicy.local/wp-admin/",
          "type": "screenshot",
          "selector": "#wpbody-content",
          "viewport": { "width": 1280, "height": 720 },
          "wait": "networkidle",
          "output": "images/dashboard-overview.png"
        },
        {
          "id": "login-flow",
          "type": "screencast",
          "steps": [
            { "action": "navigate", "url": "https://foreignpolicy.local/wp-login.php" },
            { "action": "chapter", "title": "Enter Credentials" },
            { "action": "fill", "selector": "#user_login", "value": "admin" },
            { "action": "fill", "selector": "#user_pass", "value": "***" },
            { "action": "chapter", "title": "Submit Login" },
            { "action": "click", "selector": "#wp-submit" },
            { "action": "wait", "for": "networkidle" }
          ],
          "output": "images/login-flow.webm"
        }
      ]
    }
  ]
}
```

### Pipeline Execution Flow

```
1. Load manifest
2. Launch Playwright browser (via MCP or direct)
3. Authenticate to WP admin (if needed)
4. For each capture:
   a. Navigate to URL
   b. Wait for load condition
   c. Execute screenshot/screencast
   d. Save to docs repo asset path
   e. Optimize (resize, compress)
5. Convert WebM → GIF where configured
6. Update Hugo frontmatter with asset references
```

### Integration with fp-docs Plugin

Two approaches for Phase 2:

**Approach A: New fp-docs command** (`/fp-docs:capture`)
- Add a `capture` command that reads a manifest and executes captures
- Fits the existing command-workflow-agent pattern
- Agent: `fp-docs-capture` (new specialist agent)
- Uses Playwright MCP tools within Claude Code context

**Approach B: Standalone CJS script** (`lib/capture.cjs`)
- Node.js script that uses Playwright directly (not MCP)
- Run via `node fp-tools.cjs capture run <manifest>`
- More portable, can run outside Claude Code
- Can be integrated as a hook or CI step

**Recommendation**: **Approach A** for Claude-driven doc generation (interactive, smart). **Approach B** as a fallback for batch/CI use.

### Authentication Handling
WP admin screenshots require login. Options:
1. **Cookie persistence**: Playwright MCP's save/restore state tools
2. **Pre-auth script**: Login once, save cookies, reuse across captures
3. **WP application passwords**: Headless API auth (for API-level screenshots)

**Recommendation**: Cookie persistence via Playwright state management. Login once per capture session.

### Staleness Detection
Screenshots become stale when the WP site UI changes. Detection strategies:
1. **Visual diff**: Compare new capture against stored version (pixel diff)
2. **Hash comparison**: SHA256 of screenshot content
3. **Manual trigger**: Re-capture on demand via `/fp-docs:capture`
4. **Git-based**: Track capture timestamps in manifest, flag if older than N days

---

## 7. Key Findings & Recommendations Summary

### What We Have (Ready to Use)
| Capability | Status | Details |
|------------|--------|---------|
| Playwright MCP server | ✅ Configured | `.mcp.json` with SSL bypass, vision cap |
| Browser navigation | ✅ Ready | MCP tools: navigate, click, type, fill |
| Screenshot capture | ✅ Ready | `browser_screenshot` + `browser_run_code` |
| Self-signed SSL | ✅ Solved | Triple-layered bypass in config |
| Live site access | ✅ Verified | `https://foreignpolicy.local/` returns 200 |
| Playwright 1.59.1 | ✅ Installed | Screencast API available |

### What We Need (Phase 2 Implementation)
| Capability | Status | Action Required |
|------------|--------|-----------------|
| Screencast recording | 🔧 API available | Write recording scripts via `browser_run_code` |
| GIF conversion | ❌ Missing dependency | `brew install ffmpeg` |
| Git LFS | 🔧 Not configured | `git lfs install` + track patterns in docs repo |
| Hugo video shortcode | ❌ Not created | Create custom shortcode or add `hugo-video` component |
| Capture manifest | ❌ Not created | Design and implement manifest schema |
| WP admin auth flow | 🔧 Needs design | Cookie persistence strategy |
| Playwright MCP version | ⚠️ Minor update | Bump `0.0.68` → `0.0.70` |
| PDF generation | 🔧 Optional | Add `pdf` to `--caps` flag |

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub LFS bandwidth limits | Can't fetch assets | Monitor usage; CDN fallback if needed |
| WP admin UI changes break screenshots | Stale docs | Staleness detection + re-capture workflow |
| Screencast file sizes too large | Repo bloat | Compress, limit duration, use GIF for short flows |
| Playwright MCP version incompatibility | Tool breakage | Pin version, test before bumping |
| No ffmpeg for GIF conversion | Can't create GIFs | Install as prerequisite; fallback to WebM-only |

### Architecture Decision: MCP vs Direct Playwright
| Factor | MCP (via Claude Code) | Direct (Node.js script) |
|--------|----------------------|------------------------|
| Integration | Native Claude Code tools | Standalone CLI |
| Context | Claude can see/analyze screenshots | File output only |
| Flexibility | Limited to MCP tool surface | Full Playwright API |
| Automation | Interactive, per-session | Scriptable, CI-friendly |
| **Verdict** | **Primary for doc generation** | **Backup for batch/CI** |

---

## 8. Impact on Architect's Work

The following findings should inform the Architect's docs strategy:

1. **Hugo page bundles**: Visual assets should be co-located with content (not centralized). This affects directory structure decisions.
2. **Hugo Book theme shortcodes**: Built-in `steps`, `tabs`, `hints` shortcodes are ideal for user-facing task guides. No need for custom UI components.
3. **Video embedding requires a custom shortcode**: Hugo Book doesn't have built-in video support. Need to add one.
4. **Git LFS is required**: Binary assets can't go in regular git without repo bloat. The docs repo needs LFS configured before any visual content lands.
5. **Mermaid is available**: Workflow diagrams can be rendered natively in Hugo Book — consider using for process flows alongside screenshots.
