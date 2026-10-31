# Layout proof

The pass is `layout-proof.mjs` exit 0 (`scripts/layout-proof.mjs` in the `verify-ui` skill). The script reads Figma boxes from the API (or a saved `figmaFile`) and live boxes from the page.

## When

After SCSS for a block that has a Figma frame. One manifest per frame (desktop and each adaptive frame). A breakpoint mixin with no frame still gets a pass at that viewport, using the nearest wider frame's node ids.

## Proof surface

One URL. Two hosts:

1. **Story.** The block has a `*.stories.*` file. Proof that story's canvas: `<url>/iframe.html?id=<id>&viewMode=story`. `<url>` comes from `control up storybook --stories "<story glob>"` (the `verify-ui` skill). The id is the story title plus the export name, lowercased, `/` and spaces turned into `-`, joined by `--` (`shared/ui/Button` + `Fill` → `shared-ui-button--fill`). A second `up` on a healthy server is a no-op. Measure the component root inside the iframe. `layout: centered` in the Storybook preview shifts that root off the viewport origin; the shift is the canvas. Seams, padding, and the component's own width are the proof.
2. **Site.** The block is already on a product route, or this task mounts it on one. The URL is that route on this chat's verify origin (`control doctor` prints it). First time: `control launch` (the `verify-ui` skill). After a SCSS or markup edit on that route: `control relaunch` so the build matches — `--skip-build` only when doctor is still green and sources did not change. A page section on a `*_section` branch proves on the dev origin instead: `control up dev --path /<page>/` prints the `url`, and `VERIFY_BASE_URL=<url>` points the proof at it. While iterating a red proof, re-run only that manifest; batch every in-scope manifest once at Done (`verify-ui` iterate vs Done).

A route whose only job is to give proof a page is not a surface. `src/pages/ui/` is not one — `pnpm lint:pages` fails if that folder exists, and `layout-proof.mjs` rejects a `/ui/` URL. Token: `FIGMA_API_KEY` or `PUBLIC_FIGMA_TOKEN` in the app's `.env` (location: override).

## Manifest

Start it with `--init` when the block has a check map (below); otherwise write `proof.json` next to the run artifacts. The canonical example is [proof.example.json](proof.example.json) (the only copy; a page fan-out pack points at it, and `layout-proof.mjs --check-manifest` passes it on the fixture page it targets). Copy its shape and replace the values. `nodeId` is that block's own Figma node. The frame id is only `frameId`. For a full-page CMS/legal layout, `frameId` is the **outer page frame** (viewport-width artboard); chrome siblings go in `skip`. An inner content group as `frameId` picks the wrong viewport width. A nested block measured against the page frame fails: widths differ, and the script rejects a seam or origin whose `nodeId` is the frame.

```json
{
  "fileKey": "<fileKey>",
  "frameId": "322:5667",
  "url": "<verify origin>/projects/",
  "seams": [
    {
      "name": "hero → list",
      "axis": "y",
      "prev": { "selector": ".hero", "nodeId": "322:1" },
      "next": { "selector": ".project-list", "nodeId": "322:2" }
    }
  ],
  "origins": [
    { "name": "copy", "selector": ".hero__copy", "nodeId": "322:3" }
  ],
  "skip": [{ "nodeId": "322:9", "reason": "page chrome, not a section" }]
}
```

- **Seam** — one pair of adjacent frame children that became DOM sections. `axis: "y"` is the column gap outside the two border boxes. `axis: "x"` is a row gap. Padding inside a box does not change the seam: the script also compares every mapped node's Figma `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` to that selector's computed padding, and the frame's leftover inset (frame edge to the nearest child) to the live gap after that child. A selector that does not match the padded node's box fails the run. One CSS property from a seam is not the padding check.
- **Origin** — `x`, width, and right edge of a placed block (title column, media, toolbar). A reused section keeps its own flex; those inner gaps can match while `x` is the donor page.
- **skip** — a Figma node that is not rendered on the page (chrome, overlay, hidden variant). It is removed from the child list before counts and pairs are compared, so a skipped node that the DOM does render fails as an unmapped child. `reason` is required. A section that is in the DOM is a seam or an origin.

Every direct child of the frame is in a seam, an origin, or `skip`. At least one seam and one origin.

- **viewportWidth** (optional) — when set, it must equal the frame width, or the run fails before anything is measured. `viewportHeight` defaults to the frame height.
- **figmaFile** (optional) — a saved `/v1/files/:key/nodes` JSON, relative to `proof.json`. It replaces the API and the token, so offline fixtures need no key.
- **state** (optional) — driven before anything is measured:
  - `scroll: "<selector> <top|bottom> <offset>"` sets the viewport so that the selector's top or bottom edge sits `offset` px below the viewport top. It replaces the frame alignment, so the Figma frame is what the viewport shows at that scroll. A scrub needs one manifest for its start frame and one for its end frame.
  - `hover: "<selector>"` hovers the element.
  - `open: "<role>/<name>"` clicks `getByRole(role, { name })`.
  Unknown keys and malformed values fail.

**Generated nodes.** The Figma tree under every seam and origin is walked to depth 3, plus every TEXT node and every auto-layout frame at any depth. Generated nodes are matched to DOM children by position, and the child counts must agree or the parent fails. A DOM child with no Figma counterpart fails at any depth; `svg` internals and TEXT content are not children. Each generated node is measured for width, height, and its offset from its parent (`rel-x`, `rel-y`). A node the manifest already names is not generated again, so the manifest is an overlay on the generated base. `notes.md` prints `coverage: mapped N/M nodes`.

**Pins.** A mapped node whose DOM element is `position: absolute` or `fixed`, while its Figma parent uses auto layout and the node is not `ABSOLUTE` in Figma, fails.

**Identity.** A Figma `VECTOR` must be drawn by an `svg` or `img`. A Figma `IMAGE` fill must be drawn by an `img`, `picture`, or a `background-image`. Which file is shown is not compared.

**Grid.** When the page sets `--grid-columns`, an origin's left edge must sit on a column line (`--offset-x` plus a column and gap step) and its width must be whole columns plus gaps, within 1px. An origin that reaches past the grid span (a full-bleed band) is exempt. Pages without the property skip this check.

**Text bands.** A box whose Figma node is TEXT is compared by line count (exact), height (1px), leading edge per Figma `textAlignHorizontal` (left edge for left, right edge for right, centre for center; 1px) and trailing width (`max(2px, 1%)` of the Figma width). Every other box keeps 1px. A width gap inside the band passes: do not tune `letter-spacing` or `font-size` to close it. `notes.md` prints a `Text bands:` list with the band used per text node.

## Start from a generated manifest

```bash
node <verify-ui skill>/scripts/layout-proof.mjs --init --figma-file figma-desktop.json --frame <frameId> --check <Block>.figma.check.yml --map desktop --url /<page>/ --file-key <fileKey> --out proof-desktop.json
```

`--init` reads `map.<frame>` of the check file (selector → nodeId; see [figma-snapshot.md](figma-snapshot.md)) and needs no browser, no slot and no token. Adjacent frame children that have a selector become seams. The first mapped block inside each section that is not hug-width text becomes an origin. A child with no selector goes to `skip` with a reason and is listed on stderr: keep it only when the route does not render it. Run `--check-manifest` next.

## Typical FAILs

| FAIL | Cause | Fix |
| --- | --- | --- |
| `seam/origin "<name>" uses the frame id` | the nodeId is `frameId` | point at the section or block node inside the frame |
| `frame children not in a seam, origin, or skip` | a child has no entry, often a `visible: false` variant | add it as a seam end, an origin, or a `skip` with a reason |
| `<name> [<id>] children: figma <n>, DOM <m>` | a wrapper element, or a node Figma hides | match the Figma child count in the markup, or `skip` the hidden node with a reason |
| `<id> padding-<edge> <n>: no selector matches the node box` | the padding sits on another element than the padded Figma node (card wrapper versus its body) | map a selector whose box equals the padded node and put the padding there |
| width or `rel-x` FAIL on a title origin | hug-width text has no fixed width to compare | make the block that holds it the origin; the generated text bands cover the text |
| `selector <sel> matched <n> elements` | a repeated class or a positional selector | give the element a unique modifier class from the `--check-manifest` list |
| `<name> is position:absolute but its Figma parent uses auto layout` | a pin where Figma lays out in flow | use flow layout, unless Figma marks the node absolute |

## Run

```bash
node <verify-ui skill>/scripts/layout-proof.mjs proof.json
node <verify-ui skill>/scripts/layout-proof.mjs proof-desktop.json proof-laptop.json proof-mobile.json
node <verify-ui skill>/scripts/layout-proof.mjs --dir .cursor/fstack/artifacts/<feature>/layout-proof
```

One Chromium for the whole invocation: pass several `proof.json` paths, or `--dir` (flat `*.json`, or one level of subfolders each containing `proof.json`). Iterate: only the red manifest. Done: one batch covering every in-scope frame.

The script sets the viewport to the frame width and the frame height, writes `notes.md` and `screenshot.png` under the verify artifacts directory (`<run-id>/layout-proof/`, plus a stem subfolder when batched), and exits 1 when any box `|live − figma|` is over its band (1px; text bands above), a text line count differs, Figma text is absent from the DOM, a markup-looking string is on screen, a pin, identity, unmapped-child, grid, or state check fails, the page `scrollWidth` exceeds `clientWidth` at the frame width or mid-band (`overflowWidths` in `.cursor/fstack/config.json`), or the page prints a console error. `notes.md` lists those rows, including `text: N checked, N absent, N ambiguous` and `coverage`. Fonts are awaited (`document.fonts.ready`) and the device pixel ratio is pinned to 1. A `display: contents` node is measured as the union of its in-flow children; padding on that element is not a box, so the script skips it. A url with a hash waits until that `dialog` is open and finite animations have finished. A popup frame measured while the sheet is still off-screen fails.

Text comes from Figma TEXT nodes under a mapped selector. Figma text that is not in the DOM under its selector **fails** (`Figma text absent from the DOM`). If the copy is deliberately not on the page, the TEXT node goes in `skip` with a reason. A string matching more than four elements is counted `ambiguous` and not checked. Matched text fails when the visual line count differs or the element's `scrollWidth` exceeds its `clientWidth`. Lines are counted on the innermost element that holds the string, from the top edges of its text-node rects, so padding and inline icons do not add lines.

Markup-looking strings fail. Any mapped element whose on-screen text contains `<`, `&lt;`, or `{` fails unless the same token is in the Figma text (`shows markup <br/> on screen`).

**Done when:** every in-scope manifest's `layout-proof.mjs` exits 0 (prefer one batch call), and the closing message quotes that exit (e.g. `layout-proof … exit 0` plus the artifact path). Fix SCSS, `relaunch`, re-run the red manifest until exit 0; batch all frames at Done. The project's style lint is clean in the same Done turn (`verify-ui`). Read `notes.md` before writing another measurement script.

**Not Done:** a hand-written box table, a one-off Playwright script, a screenshot, browser CDP/`getBoundingClientRect` notes, the developer's dev server, or a new `src/pages/ui/` route. The story iframe and this run's verify origin are the two hosts.
