#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { answerHelp } from "./cli-help.mjs";
import { watchConsole } from "./console-watch.mjs";
import { documentOverflow } from "./overflow-lib.mjs";
import { describeElements, manifestSelectors, selectorHints, selectorReport } from "./manifest-check.mjs";
import { gotoReady } from "./ready-wait.mjs";
import { APP, ARTIFACTS, OVERFLOW_WIDTHS, requireFromApp, targetOrigin } from "./project.mjs";
import { recordEntry, recordableOrigin } from "./receipt.mjs";
import { runInit } from "./manifest-init.mjs";
import { holdRunSlot } from "./run-slot.mjs";
import { textBandNote, textBandOf, textBoxChecks } from "./text-band.mjs";

answerHelp(`Usage: layout-proof.mjs [--check-manifest] <proof.json ...> | --dir <folder>
       layout-proof.mjs --init --figma-file <nodes.json> --frame <id> --check <Block.figma.check.yml> --map <desktop|tablet|mobile> --url <route> --file-key <key> --out <proof.json>

--init writes a manifest and exits: no browser, no slot, no receipt entry. Frame children that the check map's map.<frame> maps to a selector become seams (adjacent pairs) and origins (the first mapped block inside a section that is not hug-width text); a child with no selector is skipped with a reason and listed on stderr. The generated manifest passes --check-manifest when the selectors resolve to one element each; run it next.

--check-manifest loads the url, resolves every selector of the manifest (seams, origins, state.hover, state.scroll) and reports each one that matches zero elements or, for a seam or origin, more than one: "selector <sel> matched <n> elements" with the closest DOM candidates (class prefix of the selector, Figma node name, edit distance) and a unique class to use. It measures nothing, writes no notes.md and records no receipt entry. Exits 1 when any selector does not resolve. Figma node names come from figmaFile or the token; without them candidates use the class prefix only. Run it before the first measuring run and after every manifest edit.

Compares live element boxes against Figma boxes for one or many manifests. Exits 1 when any delta is over its band.
Bands: every non-TEXT box keeps 1px. A TEXT-backed box (the Figma node is a TEXT) is compared by line count (exact), height (1px), leading edge per Figma text-align (left edge for left, right edge for right, centre for center; 1px) and trailing width (max(2px, 1% of the Figma width)). Do not nudge letter-spacing or font-size to close a sub-band width gap on text; a wrong line count, height or leading edge still FAILs. notes.md lists "Text bands" with the band used for each text node.
The manifest is generated from the Figma tree under every seam and origin: children to depth 3, every TEXT node and every auto-layout frame, matched to DOM children by order (counts must agree). Nodes that the manifest names are not generated again; use skip to drop a generated node, with a reason. notes.md prints coverage as "mapped N/M nodes".
Writes <run>/layout-proof/<name>/notes.md (VERIFY_OUT overrides the folder; VERIFY_RUN_ID names the run).
Needs FIGMA_API_KEY or PUBLIC_FIGMA_TOKEN. VERIFY_BASE_URL=<origin> proves against the dev server or Storybook; only a run on the verify origin is recorded in the receipt, and on a *_section branch also a run on the dev origin (astro dev on this checkout's dev port). Every child of the frame must sit in a seam, an origin, or a skip. A DOM child with no Figma counterpart fails at any depth (svg internals and TEXT content are not children); a Figma IMAGE fill needs img, picture or a background-image, and a Figma VECTOR needs svg or img.

Manifest (proof.json):
  fileKey          string   Figma file key
  frameId          string   Figma node id of the frame, e.g. "1:2"
  url              string   product route or Storybook iframe URL (never src/pages/ui/ fixtures)
  viewportWidth    number   optional; when set it must equal the frame width
  state            optional, driven before measuring: { scroll?: "<selector> <top|bottom> <offset>" (sets the viewport so that edge sits offset px below its top; replaces the frame alignment), hover?: selector, open?: "<role>/<name>" (clicked) }
  viewportHeight   number   optional, default: frame height
  seams[]          at least 1: { name?, axis: "x"|"y", prev: { selector, nodeId }, next: { selector, nodeId } }
  origins[]        at least 1: { name?, selector, nodeId }
  skip[]           optional: { nodeId, reason }
  reason           optional: why the manifest changed after a FAIL; the receipt accepts the new manifest only with it
  figmaFile        optional: saved /v1/files/:key/nodes JSON, relative to proof.json; replaces the API and the token

FAIL classes. <...> marks a value. Setup FAILs stop that manifest with "layout-proof FAIL: <message>" (exit 1, no notes.md, no receipt entry). Measured FAILs are bullets under FAIL in notes.md and record a fail verdict; the fix is always in the markup or the manifest, never a looser number.
Manifest and setup:
  state.<key> is not a state; use scroll, hover or open       state takes only scroll, hover and open
  state.scroll "<value>" must be "<selector> <top|bottom> <offset>"   rewrite the value in that form
  state.open "<value>" must be "<role>/<name>"                rewrite the value in that form
  proof.json needs fileKey, frameId, url                      add the missing keys
  url <url> is a src/pages/ui/ fixture; measure the Storybook story iframe or a product route (layout-proof.md)   change url
  proof.json needs at least one seam and one origin           add one of each
  seam "<name>" needs prev/next selector and nodeId           fill both ends of the seam
  seam "<name>" uses the frame id; use the child node         point prev/next at a child of the frame
  origin "<name>" needs selector and nodeId                   fill both
  origin "<name>" uses the frame id; use the block's own node   point it at the block inside the frame
  each skip needs nodeId and reason                           add the reason, or drop the skip
  viewport width <w> differs from frame width <f>; drop viewportWidth or prove at the frame width   fix or drop viewportWidth
  frame children not in a seam, origin, or skip: <id name; ...>   add a seam end, an origin or a skip for each listed node
  set FIGMA_API_KEY or PUBLIC_FIGMA_TOKEN, or figmaFile in proof.json   export a token or save the nodes JSON
  Figma API <status>                                          bad token, file key or node id
  Figma node <id> has no absoluteBoundingBox                  the node is not a visible layer; pick another
  <url> HTTP <status>                                         start the server (control up) or fix the route
  selector <sel> matched <n> elements                         seams and origins need exactly one match; run --check-manifest
  --dir needs a path / --dir <path>: no proof.json / proof-*.json manifests / unknown flag <flag> / pass proof.json path(s) or --dir <folder>   fix the command line
Measured:
  <name> <kind>: figma <a> live <b>                           delta over the band (kinds: x, right, center, width, height, rel-x, rel-y, seam-x, seam-y, padding, inset, lines, overflow); change the CSS of that box to the Figma value
  <selector> has no in-flow box                               the element is display:contents with no in-flow child, or all children are absolute or hidden; select a real box
  <label> left <x> is off the column lines                    an origin inside the grid starts off a column line; snap it
  <label> width <w> is not whole columns                      an origin inside the grid is not a whole number of columns wide
  <name> [<id>] children: figma <n>, DOM <m>                  the DOM child count differs from the Figma children; add or remove wrappers, or skip a node with a reason
  <name> [<id>] is position:<value> but its Figma parent <name> uses auto layout   use flow layout; absolute only where Figma marks the node absolute
  <name> [<id>] is a Figma <VECTOR|IMAGE> but its DOM element is <<tag>>   a VECTOR needs svg or img; an IMAGE needs img, picture or a background-image
  <id> padding-bottom <n>: no selector matches the node box   a node with padding needs a selector whose box equals the Figma box
  frame <edge> inset <n> is on skipped <id>                   the node that sets the frame inset is skipped; unskip it
  frame <edge> inset <n>: no selector matches <id>            map the node that sets the frame inset
  frame bottom inset <n>: nothing after <selector>            the frame has a bottom inset but the page ends at that element
  <text>: Figma text absent from the DOM under <selector>     the copy differs from Figma or sits outside the mapped element
  <text>: <n> matches with different line counts              the same copy wraps differently in its copies; align them
  <text> text overflow: scroll=<w> client=<w>                 text wider than its box; widen the box or fix the wrapping
  <selector> shows markup <token> on screen                   remove literal tags, braces or entities from the visible copy
  overflow <width>: scroll=<w> client=<w>                     the page scrolls sideways at that width; find the wide element
  overflow <width>: HTTP <status>                             the route failed at that width
  overflow <width>: <error>                                   console or navigation error at that width
  pageerror: / console: lines                                 the page logged an error; fix it, it is also a FAIL here

Example proof.json:
  {
    "fileKey": "AbC123xyz",
    "frameId": "1:2",
    "url": "/services/",
    "viewportWidth": 1440,
    "seams": [
      {
        "name": "hero to intro",
        "axis": "y",
        "prev": { "selector": ".hero", "nodeId": "1:10" },
        "next": { "selector": ".intro", "nodeId": "1:11" }
      }
    ],
    "origins": [{ "name": "title", "selector": ".intro__title", "nodeId": "1:12" }]
  }

Examples:
  node .agents/skills/verify-ui/scripts/layout-proof.mjs .cursor/fstack/artifacts/services/proof.json
  node .agents/skills/verify-ui/scripts/layout-proof.mjs --dir .cursor/fstack/artifacts/services/manifests
`);

if (process.argv.includes("--init")) {
  try {
    runInit(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  process.exit(0);
}

const { chromium } = requireFromApp("playwright");

const CHECK_FLAG = "--check-manifest";
const EPS = 1;
const GENERATED_DEPTH = 3;
const MARKUP_ON_SCREEN = /&lt;|<[^<>\n]*>?|\{/g;

function readGrid() {
  const count = Number.parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--grid-columns"),
    10,
  );
  if (!(count > 0)) {
    return null;
  }
  const measure = (property) => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;width:var(${property})`;
    document.body.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  return {
    count,
    offset: measure("--offset-x"),
    colWidth: measure("--grid-column-width"),
    gap: measure("--grid-gap"),
  };
}

function onGridLine(grid, x) {
  return Array.from({ length: grid.count }, (_, index) => grid.offset + index * (grid.colWidth + grid.gap)).some(
    (line) => Math.abs(x - line) <= EPS,
  );
}

function isInsideGrid(grid, rect) {
  const right = grid.offset + grid.count * grid.colWidth + (grid.count - 1) * grid.gap;
  return rect.left >= grid.offset - EPS && rect.right <= right + EPS;
}

function isWholeColumns(grid, width) {
  return Array.from({ length: grid.count }, (_, index) => index + 1).some(
    (columns) => Math.abs(width - (columns * grid.colWidth + (columns - 1) * grid.gap)) <= EPS,
  );
}

function mapSubtrees({ anchors, skipIds, explicitIds, depthLimit }) {
  const HIDDEN_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "TEMPLATE", "TITLE"]);
  const describe = (el) => `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ""}`;
  const domChildren = (el) => {
    if (el.tagName === "svg") return [];
    const out = [];
    for (const child of el.children) {
      if (HIDDEN_TAGS.has(child.tagName)) continue;
      const display = getComputedStyle(child).display;
      if (display === "none") continue;
      if (display === "contents") {
        out.push(...domChildren(child));
        continue;
      }
      out.push(child);
    }
    return out;
  };
  const figmaChildren = (node) =>
    (node.children ?? []).filter((child) => child.visible !== false && !skipIds.includes(child.id));
  const inScope = (node, depth) =>
    depth <= depthLimit || node.type === "TEXT" || (node.layoutMode ?? "NONE") !== "NONE";
  const pairs = [];
  const scope = [];
  const mismatches = [];
  const visited = new Set();
  const walk = (figma, el, depth) => {
    if (figma.type === "TEXT" || visited.has(el)) {
      return;
    }
    visited.add(el);
    const figmaKids = figmaChildren(figma);
    const domKids = domChildren(el);
    if (figmaKids.length !== domKids.length) {
      mismatches.push({
        nodeId: figma.id,
        name: figma.name,
        figma: figmaKids.length,
        dom: domKids.length,
        domTags: domKids.map(describe),
      });
      for (const child of figmaKids) {
        if (inScope(child, depth + 1)) {
          scope.push({ nodeId: child.id, mapped: explicitIds.includes(child.id) });
        }
      }
      return;
    }
    figmaKids.forEach((child, index) => {
      const target = domKids[index];
      if (inScope(child, depth + 1)) {
        if (!explicitIds.includes(child.id)) {
          const serial = pairs.length;
          target.setAttribute("data-lp-gen", String(serial));
          pairs.push({
            nodeId: child.id,
            name: child.name,
            parentNodeId: figma.id,
            selector: `[data-lp-gen="${serial}"]`,
          });
        }
        scope.push({ nodeId: child.id, mapped: true });
      }
      walk(child, target, depth + 1);
    });
  };
  for (const anchor of anchors) {
    const el = document.querySelector(anchor.selector);
    if (el && anchor.figma) {
      walk(anchor.figma, el, 0);
    }
  }
  return { pairs, scope, mismatches };
}

function loadEnvFile(file) {
  if (!existsSync(file)) {
    return;
  }
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function fail(message) {
  throw new Error(`layout-proof FAIL: ${message}`);
}

function parseScroll(value) {
  const match = /^(.+)\s+(top|bottom)\s+(-?\d+(?:\.\d+)?)$/.exec(value);
  if (!match) {
    fail(`state.scroll "${value}" must be "<selector> <top|bottom> <offset>"`);
  }
  return { selector: match[1], edge: match[2], offset: Number(match[3]) };
}

function parseOpen(value) {
  const slash = value.indexOf("/");
  if (slash < 1) {
    fail(`state.open "${value}" must be "<role>/<name>"`);
  }
  return { role: value.slice(0, slash), name: value.slice(slash + 1) };
}

function mediaKind(figma) {
  if (figma.type === "VECTOR") return "vector";
  if ((figma.fills ?? []).some((fill) => fill.type === "IMAGE" && fill.visible !== false)) return "image";
  return null;
}

function mediaOf(el) {
  const holds = (selector) => el.matches(selector) || el.querySelector(selector) !== null;
  return {
    tag: el.tagName.toLowerCase(),
    vector: holds("svg, img"),
    image: holds("img, picture") || getComputedStyle(el).backgroundImage !== "none",
  };
}

function isAutoLayout(node) {
  return (node.layoutMode ?? "NONE") !== "NONE";
}

function indexNodes(payload) {
  const nodes = { ...(payload.nodes ?? {}) };
  const visit = (node) => {
    if (!node?.id) {
      return;
    }
    nodes[node.id] ??= { document: node };
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const entry of Object.values(payload.nodes ?? {})) {
    visit(entry?.document);
  }
  return nodes;
}

function readFigmaFile(manifestPath, file) {
  return JSON.parse(readFileSync(resolve(dirname(manifestPath), file), "utf8"));
}

async function fetchFigmaNodes(fileKey, ids) {
  const token = process.env.FIGMA_API_KEY || process.env.PUBLIC_FIGMA_TOKEN;
  if (!token) {
    fail("set FIGMA_API_KEY or PUBLIC_FIGMA_TOKEN, or figmaFile in proof.json");
  }
  const endpoint = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`;
  const response = await fetch(endpoint, { headers: { "X-Figma-Token": token } });
  if (!response.ok) {
    fail(`Figma API ${response.status}`);
  }
  return indexNodes(await response.json());
}

function boxOf(nodes, nodeId) {
  const entry = nodes[nodeId];
  const box = entry?.document?.absoluteBoundingBox;
  if (!box) {
    fail(`Figma node ${nodeId} has no absoluteBoundingBox`);
  }
  return box;
}

function paddingOf(nodes, nodeId) {
  const doc = nodes[nodeId]?.document;
  const sides = ["Top", "Right", "Bottom", "Left"];
  if (
    !doc ||
    !sides.some((side) => typeof doc[`padding${side}`] === "number")
  ) {
    return null;
  }
  return {
    top: doc.paddingTop ?? 0,
    right: doc.paddingRight ?? 0,
    bottom: doc.paddingBottom ?? 0,
    left: doc.paddingLeft ?? 0,
  };
}

function frameInsets(frameBox, kids) {
  const boxes = kids.map((kid) => kid.absoluteBoundingBox);
  return {
    top: Math.min(...boxes.map((box) => box.y)) - frameBox.y,
    left: Math.min(...boxes.map((box) => box.x)) - frameBox.x,
    bottom:
      frameBox.y +
      frameBox.height -
      Math.max(...boxes.map((box) => box.y + box.height)),
    right:
      frameBox.x +
      frameBox.width -
      Math.max(...boxes.map((box) => box.x + box.width)),
  };
}

function extremeChild(kids, pickMax, edgeValue) {
  return kids.reduce((best, kid) => {
    const box = kid.absoluteBoundingBox;
    const value = edgeValue(box);
    const bestValue = edgeValue(best.absoluteBoundingBox);
    if (pickMax ? value > bestValue : value < bestValue) {
      return kid;
    }
    return best;
  });
}

loadEnvFile(join(APP, ".env"));

function outStem(manifestPath) {
  const resolved = resolve(manifestPath);
  const base = basename(resolved);
  if (base === "proof.json" || base === "proof") {
    return basename(dirname(resolved)) || "proof";
  }
  return base.replace(/\.json$/i, "");
}

function resolveOutDir(manifestPath, runId, batched) {
  const stem = outStem(manifestPath);
  if (process.env.VERIFY_OUT) {
    return batched ? join(process.env.VERIFY_OUT, stem) : process.env.VERIFY_OUT;
  }
  const root = join(ARTIFACTS, runId, "layout-proof");
  return batched ? join(root, stem) : root;
}

function collectManifestPaths(argv) {
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      const dir = argv[++i];
      if (!dir) {
        fail("--dir needs a path");
      }
      const abs = resolve(dir);
      const found = [];
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const nested = join(abs, entry.name, "proof.json");
          if (existsSync(nested)) {
            found.push(nested);
          }
          continue;
        }
        if (entry.name === "proof.json" || /^proof-.+\.json$/i.test(entry.name)) {
          found.push(join(abs, entry.name));
        }
      }
      found.sort();
      if (found.length === 0) {
        fail(`--dir ${abs}: no proof.json / proof-*.json manifests`);
      }
      paths.push(...found);
      continue;
    }
    if (arg.startsWith("-")) {
      fail(`unknown flag ${arg}`);
    }
    paths.push(resolve(arg));
  }
  return paths;
}

function readManifest(manifestPath) {
  const manifest = JSON.parse(readFileSync(resolve(manifestPath), "utf8"));
  const { fileKey, frameId, seams = [], origins = [], skip = [] } = manifest;
  const reason = typeof manifest.reason === "string" && manifest.reason.trim() ? manifest.reason.trim() : null;
  const state = manifest.state ?? {};
  for (const key of Object.keys(state)) {
    if (!["scroll", "hover", "open"].includes(key)) {
      fail(`state.${key} is not a state; use scroll, hover or open`);
    }
  }
  const driven = {
    scroll: state.scroll && parseScroll(state.scroll),
    hover: state.hover,
    open: state.open && parseOpen(state.open),
  };
  const url = manifest.url && new URL(manifest.url, targetOrigin()).href;
  if (!fileKey || !frameId || !url) {
    fail("proof.json needs fileKey, frameId, url");
  }
  {
    const proofPath = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (proofPath === "/ui" || proofPath.startsWith("/ui/")) {
      fail(
        `url ${url} is a src/pages/ui/ fixture; measure the Storybook story iframe or a product route (layout-proof.md)`,
      );
    }
  }
  if (seams.length < 1 || origins.length < 1) {
    fail("proof.json needs at least one seam and one origin");
  }

  const referenced = new Set();
  for (const seam of seams) {
    for (const end of [seam.prev, seam.next]) {
      if (!end?.selector || !end?.nodeId) {
        fail(`seam "${seam.name ?? ""}" needs prev/next selector and nodeId`);
      }
      if (end.nodeId === frameId) {
        fail(`seam "${seam.name ?? ""}" uses the frame id; use the child node`);
      }
      referenced.add(end.nodeId);
    }
  }
  for (const origin of origins) {
    if (!origin.selector || !origin.nodeId) {
      fail(`origin "${origin.name ?? ""}" needs selector and nodeId`);
    }
    if (origin.nodeId === frameId) {
      fail(
        `origin "${origin.name ?? ""}" uses the frame id; use the block's own node`,
      );
    }
    referenced.add(origin.nodeId);
  }
  for (const item of skip) {
    if (!item.nodeId || !item.reason?.trim()) {
      fail("each skip needs nodeId and reason");
    }
    referenced.add(item.nodeId);
  }

  return { manifest, fileKey, frameId, seams, origins, skip, reason, driven, url, referenced };
}

async function loadNodes(manifestPath, { manifest, fileKey, frameId, referenced }) {
  return manifest.figmaFile
    ? indexNodes(readFigmaFile(manifestPath, manifest.figmaFile))
    : await fetchFigmaNodes(fileKey, [frameId, ...referenced]);
}

async function checkOne(manifestPath, { browser }) {
  const read = readManifest(manifestPath);
  const { manifest, frameId, seams, origins, driven, url } = read;
  let nodes = null;
  let namesNote = "Figma names: from the manifest";
  try {
    nodes = await loadNodes(manifestPath, read);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    namesNote = `Figma names unavailable (${message.replace(/^layout-proof FAIL: /, "")}); candidates use the class prefix only`;
  }
  const frameWidth = nodes?.[frameId]?.document?.absoluteBoundingBox?.width;
  const context = await browser.newContext({
    viewport: { width: Math.round(manifest.viewportWidth ?? frameWidth ?? 1440), height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const lines = [`check-manifest: ${resolve(manifestPath)}`, `url: ${url}`, namesNote];
  let bad = 0;
  const refs = manifestSelectors({ seams, origins, driven });
  try {
    const page = await context.newPage();
    const nav = await gotoReady(page, url, { timeout: 60_000 });
    if (!nav || !nav.ok()) {
      fail(`${url} HTTP ${nav?.status() ?? "no response"}`);
    }
    for (const ref of refs) {
      const figmaName = ref.nodeId ? nodes?.[ref.nodeId]?.document?.name : undefined;
      let count;
      try {
        count = await page.locator(ref.selector).count();
      } catch (error) {
        bad += 1;
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        lines.push(`selector ${ref.selector} is not a valid selector (${ref.role}): ${message}`);
        continue;
      }
      if (ref.one ? count === 1 : count >= 1) {
        continue;
      }
      bad += 1;
      const hints = selectorHints(ref.selector, figmaName);
      const scan = (target, filter) =>
        target.evaluateAll(describeElements, { filter, prefixes: hints.prefixes, key: hints.key });
      const items = count === 0 ? await scan(page.locator("*"), true) : await scan(page.locator(ref.selector), false);
      lines.push(...selectorReport({ ref, count, items, figmaName }));
    }
  } finally {
    await context.close();
  }
  lines.push(
    bad === 0
      ? `check-manifest OK: ${refs.length} selectors resolve`
      : `check-manifest FAIL: ${bad} of ${refs.length} selectors do not resolve`,
  );
  console.log(lines.join("\n"));
  return { ok: bad === 0 };
}

async function proveOne(manifestPath, { browser, outDir }) {
  const read = readManifest(manifestPath);
  const { manifest, frameId, seams, origins, skip, reason, driven, url, referenced } = read;
  const nodes = await loadNodes(manifestPath, read);

  const frame = boxOf(nodes, frameId);
  if (manifest.viewportWidth != null && Math.round(manifest.viewportWidth) !== Math.round(frame.width)) {
    fail(
      `viewport width ${manifest.viewportWidth} differs from frame width ${frame.width}; drop viewportWidth or prove at the frame width`,
    );
  }
  const children = nodes[frameId]?.document?.children ?? [];
  const missingChildren = children.filter(
    (child) => child.id && !referenced.has(child.id),
  );
  if (missingChildren.length > 0) {
    const lines = missingChildren
      .map((child) => `${child.id} ${child.name ?? ""}`)
      .join("; ");
    fail(`frame children not in a seam, origin, or skip: ${lines}`);
  }

  const rows = [];
  const misses = [];

  const textBands = [];

  function recordText(label, kindPrefix, doc, want, live) {
    const band = textBandOf(doc);
    textBands.push(textBandNote(label, band, EPS));
    for (const check of textBoxChecks(band, EPS, kindPrefix, want, live)) {
      record(label, check.kind, check.figma, check.live, check.eps);
    }
  }

  function record(name, kind, figma, live, eps = EPS) {
    const delta = Math.abs(live - figma);
    const ok = delta <= eps;
    rows.push({ name, kind, figma, live, delta, ok });
    if (!ok) {
      misses.push(
        `${name} ${kind}: figma ${figma.toFixed(1)} live ${live.toFixed(1)}`,
      );
    }
  }

  function figmaLineCount(doc, box) {
    const style = doc.style ?? {};
    const line =
      style.lineHeightPx > 0
        ? style.lineHeightPx
        : style.fontSize > 0
          ? style.fontSize * 1.2
          : box.height;
    if (!(line > 0)) {
      return 1;
    }
    return Math.max(1, Math.round(box.height / line));
  }

  function collectText(node, ancestorId, skipSet, selectorByNode, out) {
    if (!node || node.visible === false) {
      return;
    }
    if (skipSet.has(node.id)) {
      return;
    }
    const next = selectorByNode.has(node.id) ? node.id : ancestorId;
    if (
      node.type === "TEXT" &&
      node.characters &&
      node.absoluteBoundingBox &&
      next
    ) {
      out.push({
        characters: node.characters,
        lines: figmaLineCount(node, node.absoluteBoundingBox),
        ancestorId: next,
      });
    }
    for (const child of node.children ?? []) {
      collectText(child, next, skipSet, selectorByNode, out);
    }
  }

  function markOverflow(width, report) {
    const delta = Math.max(0, report.scrollW - report.clientW);
    const ok = delta <= EPS;
    rows.push({
      name: `page @${width}`,
      kind: "overflow",
      figma: report.clientW,
      live: report.scrollW,
      delta,
      ok,
    });
    if (!ok) {
      misses.push(
        `overflow ${width}: scroll=${report.scrollW} client=${report.clientW}`,
      );
    }
  }

  const viewportWidth = Math.round(frame.width);
  const viewportHeight = Math.round(manifest.viewportHeight ?? frame.height);
  mkdirSync(outDir, { recursive: true });

  let textChecked = 0;
  let textAbsent = 0;
  let textAmbiguous = 0;
  let coverage = { mapped: 0, total: 0 };

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const consoleErrors = watchConsole(page);

  try {
    const nav = await gotoReady(page, url, { timeout: 60_000 });
    if (!nav || !nav.ok()) {
      fail(`${url} HTTP ${nav?.status() ?? "no response"}`);
    }
    const frameSelectors = [
      ...seams.flatMap((seam) => [seam.prev.selector, seam.next.selector]),
      ...origins.map((origin) => origin.selector),
    ];

    async function openSettle(target, { scroll, hover, open } = {}) {
      if (scroll) {
        await target.locator(scroll.selector).first().evaluate((element, { edge, offset }) => {
          const rect = element.getBoundingClientRect();
          window.scrollBy(0, (edge === "top" ? rect.top : rect.bottom) - offset);
        }, scroll);
      } else {
        await target.evaluate((selectors) => {
          const found = selectors
            .map((selector) => document.querySelector(selector))
            .filter((node) => node instanceof Element);
          if (found.length === 0) return;
          let ancestor = found[0];
          while (ancestor && !found.every((node) => ancestor.contains(node))) {
            ancestor = ancestor.parentElement;
          }
          if (!ancestor) return;
          const top = ancestor.getBoundingClientRect().top;
          if (Math.abs(top) > 1) window.scrollBy(0, top);
        }, frameSelectors);
      }

      const hash = new URL(url).hash;
      if (hash.length > 1) {
        await target.waitForFunction((id) => {
          const dialog = document.getElementById(id);
          return dialog instanceof HTMLDialogElement && dialog.open;
        }, hash.slice(1));
      }
      if (hover) {
        await target.locator(hover).first().hover();
      }
      if (open) {
        await target.getByRole(open.role, { name: open.name, exact: true }).first().click();
      }
      await target.evaluate(async () => {
        await document.fonts.ready;
        const animations = document.getAnimations().filter((animation) => {
          const timing = animation.effect?.getTiming?.();
          return timing?.iterations !== Infinity;
        });
        await Promise.allSettled(
          animations.map((animation) => animation.finished),
        );
      });
    }

    await openSettle(page, driven);

    async function rectOf(selector) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count !== 1) {
        fail(`selector ${selector} matched ${count} elements`);
      }
      const box = await locator.first().evaluate((element) => {
        function flowBoxes(el, out) {
          for (const child of el.children) {
            const childStyle = getComputedStyle(child);
            if (childStyle.display === "contents") {
              flowBoxes(child, out);
              continue;
            }
            const outOfFlow =
              childStyle.position === "fixed" ||
              childStyle.position === "absolute";
            const rect = child.getBoundingClientRect();
            const hidden = rect.width === 0 && rect.height === 0;
            if (outOfFlow || hidden) {
              continue;
            }
            out.push(rect);
          }
        }

        const style = getComputedStyle(element);
        if (style.display === "contents") {
          const boxes = [];
          flowBoxes(element, boxes);
          if (boxes.length === 0) {
            return null;
          }
          const left = Math.min(...boxes.map((rect) => rect.left));
          const right = Math.max(...boxes.map((rect) => rect.right));
          const top = Math.min(...boxes.map((rect) => rect.top));
          const bottom = Math.max(...boxes.map((rect) => rect.bottom));
          return { left, right, top, bottom, width: right - left };
        }
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
        };
      });
      if (!box) {
        misses.push(`${selector} has no in-flow box`);
        return null;
      }
      return box;
    }

    for (const seam of seams) {
      const axis = seam.axis === "x" ? "x" : "y";
      const prevBox = boxOf(nodes, seam.prev.nodeId);
      const nextBox = boxOf(nodes, seam.next.nodeId);
      const prevRect = await rectOf(seam.prev.selector);
      const nextRect = await rectOf(seam.next.selector);
      if (!prevRect || !nextRect) {
        continue;
      }
      const label = seam.name || `${seam.prev.selector} → ${seam.next.selector}`;
      if (axis === "x") {
        record(
          label,
          "seam-x",
          nextBox.x - (prevBox.x + prevBox.width),
          nextRect.left - prevRect.right,
        );
      } else {
        record(
          label,
          "seam-y",
          nextBox.y - (prevBox.y + prevBox.height),
          nextRect.top - prevRect.bottom,
        );
      }
    }

    for (const origin of origins) {
      const nodeBox = boxOf(nodes, origin.nodeId);
      const rect = await rectOf(origin.selector);
      if (!rect) {
        continue;
      }
      const label = origin.name || origin.selector;
      const figmaX = nodeBox.x - frame.x;
      const doc = nodes[origin.nodeId].document;
      if (doc.type === "TEXT") {
        recordText(
          label,
          "",
          doc,
          { left: figmaX, width: nodeBox.width },
          { left: rect.left, width: rect.width },
        );
        record(label, "height", nodeBox.height, rect.bottom - rect.top);
        continue;
      }
      record(label, "x", figmaX, rect.left);
      record(label, "width", nodeBox.width, rect.width);
      record(label, "right", figmaX + nodeBox.width, rect.right);
    }

    const grid = await page.evaluate(readGrid);
    if (grid) {
      for (const origin of origins) {
        const rect = await rectOf(origin.selector);
        if (!rect || !isInsideGrid(grid, rect)) {
          continue;
        }
        const label = origin.name || origin.selector;
        if (!onGridLine(grid, rect.left)) {
          misses.push(`${label} left ${rect.left.toFixed(1)} is off the column lines`);
        }
        if (!isWholeColumns(grid, rect.width)) {
          misses.push(`${label} width ${rect.width.toFixed(1)} is not whole columns`);
        }
      }
    }

    const skipped = new Set(skip.map((item) => item.nodeId));
    const mapped = [];
    for (const seam of seams) {
      for (const end of [seam.prev, seam.next]) {
        mapped.push({
          name: end.selector,
          selector: end.selector,
          nodeId: end.nodeId,
        });
      }
    }
    for (const origin of origins) {
      mapped.push({
        name: origin.name || origin.selector,
        selector: origin.selector,
        nodeId: origin.nodeId,
      });
    }

    const explicitIds = [...new Set(mapped.map((entry) => entry.nodeId))];
    const generation = await page.evaluate(mapSubtrees, {
      anchors: explicitIds.map((nodeId) => ({
        selector: mapped.find((entry) => entry.nodeId === nodeId).selector,
        figma: nodes[nodeId]?.document,
      })),
      skipIds: [...skipped],
      explicitIds,
      depthLimit: GENERATED_DEPTH,
    });
    const coverageMap = new Map(explicitIds.map((nodeId) => [nodeId, true]));
    for (const item of generation.scope) {
      coverageMap.set(item.nodeId, (coverageMap.get(item.nodeId) ?? false) || item.mapped);
    }
    coverage = {
      mapped: [...coverageMap.values()].filter(Boolean).length,
      total: coverageMap.size,
    };
    const generated = [];
    for (const pair of generation.pairs) {
      if (mapped.some((entry) => entry.nodeId === pair.nodeId)) {
        continue;
      }
      mapped.push({ name: pair.name, selector: pair.selector, nodeId: pair.nodeId });
      generated.push(pair);
    }
    for (const item of generation.mismatches) {
      const extra = item.domTags.length > 0 ? ` (${item.domTags.join(", ")})` : "";
      misses.push(
        `${item.name} [${item.nodeId}] children: figma ${item.figma}, DOM ${item.dom}${extra}`,
      );
    }
    const parentOf = new Map();
    const indexParents = (node) => {
      for (const child of node.children ?? []) {
        parentOf.set(child.id, node);
        indexParents(child);
      }
    };
    indexParents(nodes[frameId].document);
    const pinChecked = new Set();
    for (const entry of mapped) {
      const figma = nodes[entry.nodeId]?.document;
      const parent = parentOf.get(entry.nodeId);
      if (pinChecked.has(entry.nodeId) || !figma || !parent || !isAutoLayout(parent)) {
        continue;
      }
      pinChecked.add(entry.nodeId);
      if (figma.layoutPositioning === "ABSOLUTE") {
        continue;
      }
      const locator = page.locator(entry.selector);
      if ((await locator.count()) !== 1) {
        continue;
      }
      const position = await locator.evaluate((el) => getComputedStyle(el).position);
      if (position === "absolute" || position === "fixed") {
        misses.push(
          `${entry.name} [${entry.nodeId}] is position:${position} but its Figma parent ${parent.name} uses auto layout`,
        );
      }
    }
    const mediaChecked = new Set();
    for (const entry of mapped) {
      const figma = nodes[entry.nodeId]?.document;
      const kind = figma && mediaKind(figma);
      if (!kind || mediaChecked.has(entry.nodeId)) {
        continue;
      }
      mediaChecked.add(entry.nodeId);
      const locator = page.locator(entry.selector);
      if ((await locator.count()) !== 1) {
        continue;
      }
      const media = await locator.evaluate(mediaOf);
      if (!media[kind]) {
        misses.push(
          `${entry.name} [${entry.nodeId}] is a Figma ${kind === "vector" ? "VECTOR" : "IMAGE"} but its DOM element is <${media.tag}>`,
        );
      }
    }
    for (const pair of generated) {
      const parent = mapped.find((entry) => entry.nodeId === pair.parentNodeId);
      const rect = await rectOf(pair.selector);
      const parentRect = await rectOf(parent.selector);
      if (!rect || !parentRect) {
        continue;
      }
      const figmaBox = boxOf(nodes, pair.nodeId);
      const parentBox = boxOf(nodes, pair.parentNodeId);
      const label = `${pair.name} [${pair.nodeId}]`;
      const doc = nodes[pair.nodeId].document;
      if (doc.type === "TEXT") {
        recordText(
          label,
          "rel-",
          doc,
          { left: figmaBox.x - parentBox.x, width: figmaBox.width },
          { left: rect.left - parentRect.left, width: rect.width },
        );
      } else {
        record(label, "width", figmaBox.width, rect.width);
        record(label, "rel-x", figmaBox.x - parentBox.x, rect.left - parentRect.left);
      }
      record(label, "height", figmaBox.height, rect.bottom - rect.top);
      record(label, "rel-y", figmaBox.y - parentBox.y, rect.top - parentRect.top);
    }

    async function matchesNode(selector, nodeBox) {
      const rect = await rectOf(selector);
      if (!rect) {
        return null;
      }
      const figmaX = nodeBox.x - frame.x;
      const sameBox =
        Math.abs(rect.width - nodeBox.width) <= EPS &&
        Math.abs(rect.left - figmaX) <= EPS;
      return sameBox ? rect : null;
    }

    async function paddingPx(selector) {
      return page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          if (style.display === "contents") {
            return null;
          }
          return {
            top: Number.parseFloat(style.paddingTop),
            right: Number.parseFloat(style.paddingRight),
            bottom: Number.parseFloat(style.paddingBottom),
            left: Number.parseFloat(style.paddingLeft),
          };
        });
    }

    async function gapAfter(selector) {
      return page
        .locator(selector)
        .first()
        .evaluate((element) => {
          function flowEdge(el, edge) {
            const style = getComputedStyle(el);
            if (style.display === "contents") {
              let value = null;
              for (const child of el.children) {
                const childValue = flowEdge(child, edge);
                if (childValue == null) {
                  continue;
                }
                value =
                  value == null
                    ? childValue
                    : edge === "top"
                      ? Math.min(value, childValue)
                      : Math.max(value, childValue);
              }
              return value;
            }
            const rect = el.getBoundingClientRect();
            const hidden = rect.width === 0 && rect.height === 0;
            const outOfFlow =
              style.position === "fixed" || style.position === "absolute";
            if (hidden || outOfFlow) {
              return null;
            }
            return edge === "top" ? rect.top : rect.bottom;
          }

          const bottom = flowEdge(element, "bottom");
          if (bottom == null) {
            return null;
          }
          let current = element;
          while (current && current !== document.documentElement) {
            let next = current.nextElementSibling;
            while (next) {
              const top = flowEdge(next, "top");
              if (top != null) {
                return top - bottom;
              }
              next = next.nextElementSibling;
            }
            current = current.parentElement;
          }
          return null;
        });
    }

    const seenNodes = new Set();
    for (const item of mapped) {
      if (seenNodes.has(item.nodeId) || skipped.has(item.nodeId)) {
        continue;
      }
      seenNodes.add(item.nodeId);
      const pad = paddingOf(nodes, item.nodeId);
      if (!pad) {
        continue;
      }
      const nodeBox = boxOf(nodes, item.nodeId);
      const selectors = [
        ...new Set(
          mapped
            .filter((entry) => entry.nodeId === item.nodeId)
            .map((entry) => entry.selector),
        ),
      ];
      const matched = [];
      for (const selector of selectors) {
        const rect = await matchesNode(selector, nodeBox);
        if (rect) {
          matched.push(selector);
        }
      }
      if (matched.length === 0) {
        misses.push(
          `${item.nodeId} padding-bottom ${pad.bottom}: no selector matches the node box`,
        );
        continue;
      }
      for (const selector of matched) {
        const live = await paddingPx(selector);
        if (!live) {
          continue;
        }
        for (const side of ["top", "right", "bottom", "left"]) {
          record(`${selector} padding-${side}`, "padding", pad[side], live[side]);
        }
      }
    }

    const frameKids = children.filter(
      (child) => child.absoluteBoundingBox && child.visible !== false,
    );
    if (frameKids.length > 0) {
      const insets = frameInsets(frame, frameKids);
      const edges = {
        top: extremeChild(frameKids, false, (box) => box.y),
        left: extremeChild(frameKids, false, (box) => box.x),
        bottom: extremeChild(frameKids, true, (box) => box.y + box.height),
        right: extremeChild(frameKids, true, (box) => box.x + box.width),
      };
      for (const edge of ["top", "right", "bottom", "left"]) {
        if (insets[edge] <= EPS) {
          continue;
        }
        const child = edges[edge];
        if (skipped.has(child.id)) {
          misses.push(
            `frame ${edge} inset ${insets[edge].toFixed(1)} is on skipped ${child.id}`,
          );
          continue;
        }
        const selectors = [
          ...new Set(
            mapped
              .filter((entry) => entry.nodeId === child.id)
              .map((entry) => entry.selector),
          ),
        ];
        let matched = null;
        for (const selector of selectors) {
          const rect = await matchesNode(selector, child.absoluteBoundingBox);
          if (rect) {
            matched = { selector, rect };
            break;
          }
        }
        if (!matched) {
          misses.push(
            `frame ${edge} inset ${insets[edge].toFixed(1)}: no selector matches ${child.id}`,
          );
          continue;
        }
        if (edge === "bottom") {
          const live = await gapAfter(matched.selector);
          if (live == null) {
            misses.push(
              `frame bottom inset ${insets.bottom.toFixed(1)}: nothing after ${matched.selector}`,
            );
          } else {
            record(
              `frame bottom after ${matched.selector}`,
              "inset",
              insets.bottom,
              live,
            );
          }
        } else if (edge === "top") {
          record(
            `frame top before ${matched.selector}`,
            "inset",
            insets.top,
            matched.rect.top,
          );
        } else if (edge === "left") {
          record(
            `frame left before ${matched.selector}`,
            "inset",
            insets.left,
            matched.rect.left,
          );
        } else {
          record(
            `frame right after ${matched.selector}`,
            "inset",
            insets.right,
            viewportWidth - matched.rect.right,
          );
        }
      }
    }

    const selectorByNode = new Map();
    for (const item of mapped) {
      if (!selectorByNode.has(item.nodeId)) {
        selectorByNode.set(item.nodeId, item.selector);
      }
    }
    const texts = [];
    collectText(nodes[frameId]?.document, null, skipped, selectorByNode, texts);
    for (const text of texts) {
      const selector = selectorByNode.get(text.ancestorId);
      const want = text.characters.replace(/\s+/g, " ").trim();
      if (!selector || want.length < 2) {
        continue;
      }
      const label = want.slice(0, 40).replace(/\|/g, "/").replace(/\n/g, " ");
      const visible = page.locator(selector).locator("visible=true");
      if ((await visible.count()) < 1) {
        textAbsent += 1;
        misses.push(`${label}: Figma text absent from the DOM under ${selector}`);
        continue;
      }
      const live = await visible.first().evaluate((root, expected) => {
        const norm = (value) => value.replace(/\s+/g, " ").trim();
        const hits = [];
        const visit = (el) => {
          if (!(el instanceof Element)) {
            return;
          }
          if (norm(el.innerText || "") === expected) {
            hits.push(el);
          }
          for (const child of el.children) {
            visit(child);
          }
        };
        visit(root);
        const innermost = hits.filter(
          (el) =>
            ![...el.querySelectorAll("*")].some((child) => hits.includes(child)),
        );
        if (innermost.length === 0 || innermost.length > 4) {
          return { hits: innermost.length, lines: 0, overflow: false };
        }
        const counts = innermost.map((el) => {
          const tops = new Set();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) {
              continue;
            }
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) {
              if (rect.width > 0 && rect.height > 0) {
                tops.add(Math.round(rect.top));
              }
            }
          }
          return {
            lines: tops.size || 1,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        });
        const lines = counts[0].lines;
        const differ = counts.some((item) => item.lines !== lines);
        const overflow = counts.some(
          (item) => item.scrollWidth > item.clientWidth + 1,
        );
        return {
          hits: innermost.length,
          lines: differ ? -1 : lines,
          overflow,
          scrollWidth: Math.max(...counts.map((item) => item.scrollWidth)),
          clientWidth: counts[0].clientWidth,
        };
      }, want);
      if (live.hits === 0) {
        textAbsent += 1;
        misses.push(`${label}: Figma text absent from the DOM under ${selector}`);
        continue;
      }
      if (live.hits > 4) {
        textAmbiguous += 1;
        continue;
      }
      textChecked += 1;
      if (live.lines < 0) {
        misses.push(`${label}: ${live.hits} matches with different line counts`);
        continue;
      }
      record(label, "lines", text.lines, live.lines, 0);
      if (live.overflow) {
        misses.push(
          `${label} text overflow: scroll=${live.scrollWidth} client=${live.clientWidth}`,
        );
      }
    }

    const figmaText = texts.map((text) => text.characters).join("\n");
    for (const selector of new Set(mapped.map((entry) => entry.selector))) {
      const shown = await page.locator(selector).first().evaluate((el) => el.innerText ?? "");
      for (const token of new Set(shown.match(MARKUP_ON_SCREEN) ?? [])) {
        if (!figmaText.includes(token)) {
          misses.push(`${selector} shows markup ${token} on screen`);
        }
      }
    }

    markOverflow(viewportWidth, await documentOverflow(page));
    for (const width of OVERFLOW_WIDTHS) {
      if (width === viewportWidth) {
        continue;
      }
      const extra = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      try {
        const extraPage = await extra.newPage();
        const extraErrors = watchConsole(extraPage);
        const extraNav = await gotoReady(extraPage, url, { timeout: 60_000 });
        if (!extraNav || !extraNav.ok()) {
          misses.push(
            `overflow ${width}: HTTP ${extraNav?.status() ?? "no response"}`,
          );
          continue;
        }
        await openSettle(extraPage);
        markOverflow(width, await documentOverflow(extraPage));
        for (const error of extraErrors) {
          misses.push(`overflow ${width}: ${error}`);
        }
      } catch (error) {
        misses.push(
          `overflow ${width}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await extra.close();
      }
    }

    await page.screenshot({ path: join(outDir, "screenshot.png") });
  } finally {
    await context.close();
  }

  for (const error of consoleErrors) {
    misses.push(error);
  }

  const table = [
    `| pair | kind | figma | live | Δ |`,
    `| --- | --- | --- | --- | --- |`,
    ...rows.map(
      (row) =>
        `| ${row.name} | ${row.kind} | ${row.figma.toFixed(1)} | ${row.live.toFixed(1)} | ${row.delta.toFixed(1)} |`,
    ),
  ];

  const notes = [
    `# Layout proof`,
    "",
    `- url: ${url}`,
    `- frame: ${frameId}`,
    `- viewport: ${viewportWidth}×${viewportHeight}`,
    `- text: ${textChecked} checked, ${textAbsent} absent, ${textAmbiguous} ambiguous`,
    `- coverage: mapped ${coverage.mapped}/${coverage.total} nodes`,
    ...(reason ? [`- reason: ${reason}`] : []),
    "",
    ...table,
    "",
    ...(textBands.length ? ["Text bands:", ...textBands, ""] : []),
    misses.length
      ? `FAIL\n\n${misses.map((line) => `- ${line}`).join("\n")}\n`
      : "PASS\n",
  ].join("\n");

  writeFileSync(join(outDir, "notes.md"), notes);
  console.log(notes);
  console.log(`notes: ${join(outDir, "notes.md")}`);

  return {
    ok: misses.length === 0,
    outDir,
    notesPath: join(outDir, "notes.md"),
    entry: {
      route: manifest.url,
      viewport: viewportWidth,
      frameId,
      manifestHash: createHash("sha256").update(readFileSync(resolve(manifestPath))).digest("hex"),
      skipCount: skip.length,
      coverage,
      ...(reason ? { reason } : {}),
    },
  };
}

async function checkAll(manifests) {
  const browser = await chromium.launch({ headless: true, channel: "chromium" });
  let failed = false;
  try {
    for (const manifestPath of manifests) {
      try {
        const result = await checkOne(manifestPath, { browser });
        failed ||= !result.ok;
      } catch (error) {
        console.log(error instanceof Error ? error.message : String(error));
        failed = true;
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) {
    process.exit(1);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const manifests = collectManifestPaths(argv.filter((arg) => arg !== CHECK_FLAG));
  if (manifests.length === 0) {
    fail("pass proof.json path(s) or --dir <folder>");
  }
  await holdRunSlot("layout-proof");
  if (argv.includes(CHECK_FLAG)) {
    await checkAll(manifests);
    return;
  }
  const runId =
    process.env.VERIFY_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-");
  const batched = manifests.length > 1;
  const browser = await chromium.launch({ headless: true, channel: "chromium" });
  const results = [];
  try {
    for (const manifestPath of manifests) {
      const outDir = resolveOutDir(manifestPath, runId, batched);
      console.error(`layout-proof: ${manifestPath}`);
      try {
        const result = await proveOne(manifestPath, { browser, outDir });
        results.push({ manifestPath, ...result });
        console.error(
          `layout-proof: ${outStem(manifestPath)} ${result.ok ? "PASS" : "FAIL"} → ${result.notesPath}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`layout-proof: ${outStem(manifestPath)} FAIL → ${message}`);
        results.push({ manifestPath, ok: false, error: message });
      }
    }
  } finally {
    await browser.close();
  }
  if (batched) {
    console.log(
      results
        .map((result) => {
          const status = result.ok ? "PASS" : "FAIL";
          const detail = result.notesPath ?? result.error ?? "";
          return [outStem(result.manifestPath), status, detail].join("\t");
        })
        .join("\n"),
    );
  }
  const failed = results.some((result) => !result.ok);
  const origin = recordableOrigin(targetOrigin());
  if (origin) {
    for (const result of results) {
      if (!result.entry) continue;
      recordEntry({
        kind: "layout-proof",
        origin,
        ...result.entry,
        verdict: result.ok ? "pass" : "fail",
        artifacts: [result.notesPath],
      });
    }
  }
  if (failed) {
    process.exit(1);
  }
}

await main();
