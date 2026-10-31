# Figma assets via Framelink MCP

## Target path (workspace)

```text
<workspace>/<images-dir>/<category>/<filename>
```

`<images-dir>` is the project's static image folder and `<icons-dir>` its icon folder (`figma-design-to-code` override, Assets), both relative to the repo root.

- **Category**: kebab-case from context (`news`, `gallery`, …).
- **Filename**: kebab-case + `.png` / `.svg` / `.webp` / `.gif`.
- **Scope**: only assets for the frame/node you implement.
- **Code URL**: the public URL prefix of `<images-dir>` (override) + `/<category>/<filename>`.

## Glyphs already in the icon set

Before `download_figma_images` for a small monochrome mark (chevron, arrow, close, search, cart, heart, and the same kind of glyph):

```bash
ls <icons-dir>
```

**Done when** each such mark is either the project's icon component (`project.md`, Shared UI) or a download whose notes name the filenames compared and why none matched. The icon name is the filename without `.svg` by default (`chevron-down.svg` → `name="chevron-down"`). A match uses that icon. A new file goes to `<images-dir>/<category>/` only after the list shows no match.

## `download_figma_images`

Server: the rung that served this node (`figma-design-to-code`, Figma MCP). A REST rung has no `download_figma_images` call.

```json
{
  "fileKey": "<fileKey>",
  "localPath": "<worktree>/<images-dir>/<category>",
  "pngScale": 2,
  "nodes": [
    {
      "nodeId": "249:1242",
      "fileName": "hero.png"
    }
  ]
}
```

- `pngScale` defaults to `2` — keep `2` for retina raster exports.
- Use `gifRef` instead of `imageRef` when Figma data has animated GIF.
- `<worktree>` is the absolute `<workspace>` (`git rev-parse --show-toplevel`); a linked worktree lives under `~/.cursor/worktrees/<worktree>/`. An absolute `localPath` lands in the same place on every Framelink server. Still run the post-download ritual.

## CRITICAL: `imageRef` vs full node render

Figma media nodes often stack fills, e.g. `rgba(227,227,227,0.2)` + `IMAGE` + `#FFFFFF`. What you download depends on the args:

| Mode | Args | Result |
| ---- | ---- | ------ |
| **Node render** (default for product/card media) | `nodeId` + `fileName` only — **no** `imageRef`, **no** crop | PNG of the whole layer: background fills + image composite (e.g. light gray `#f9f9f9`) |
| **Raw image fill** | `imageRef` present | Only the photo asset — often pure white studio bg, **loses** the frame gray/white fills |
| **Cropped fill** | `imageRef` + `needsCropping` / `cropTransform` / `filenameSuffix` | Cropped photo — same problem, plus wrong framing |

**Rule:** if the mockup shows a tinted / gray / colored plate under the photo (fills besides `IMAGE` on the same node or parent media frame) → download **node render** (`nodeId` only). Do **not** pass `imageRef` or crop params.

**Use `imageRef` only when** the design needs the raw photo alone (transparent product cutout, separate CSS background, or fills are irrelevant).

After download, spot-check a corner pixel (or open the file): near-white `#f9f9f9` / gray ≠ pure `#ffffff` when the mockup has a gray plate. If you get pure white and the mockup is gray — you used `imageRef`; re-download as node render.

**Do not** “fix” a bad download by switching to `imageRef` without crop — that makes white worse. Re-export the **node**.

## CRITICAL: MCP writes under `$HOME`

Framelink resolves a relative `localPath` from the **MCP server root**, not the git workspace, and the root differs per server: `$HOME` for the user server, the project root for the project server. The same `.cursor/worktrees/<worktree>/…` lands in the worktree on the first and in the main checkout (`<project>/.cursor/worktrees/…`) on the second. Pass an absolute `localPath` into the checkout you work in; in a linked worktree that is `~/.cursor/worktrees/<worktree>/…` spelled out.

`<workspace>` in the ritual below is the root of the current worktree (`git rev-parse --show-toplevel`). A repo-relative `localPath: "<images-dir>/news"` lands in `~/<images-dir>/news/` (wrong for the repo). A `localPath` such as `Sites/plenum/<images-dir>/news` lands in the main checkout: it dirties the tree that `accept.mjs` merges into. In a worktree session the `guard-main-checkout` hook refuses both and prints the corrected `localPath`.

### After every download — 3-step ritual

```bash
ls -la "<workspace>/<images-dir>/<category>/"
```

If empty / missing:

```bash
mkdir -p "<workspace>/<images-dir>/<category>"
cp -v "$HOME/<images-dir>/<category>"/* \
  "<workspace>/<images-dir>/<category>/"
ls -la "<workspace>/<images-dir>/<category>/"
```

Do **not** finish the task until `ls` shows files in the workspace.
