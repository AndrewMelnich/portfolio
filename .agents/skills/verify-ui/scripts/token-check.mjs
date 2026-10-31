#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { answerHelp } from "./cli-help.mjs";
import { gotoReady } from "./ready-wait.mjs";
import { requireFromApp, targetOrigin } from "./project.mjs";
import { holdRunSlot } from "./run-slot.mjs";

answerHelp(`Usage: token-check.mjs --snapshot <Block.figma.yml> --check <Block.figma.check.yml> --url <route|url> [--frame <name>[:<width>] ...] [--tolerance <px>]

Compares every token of <Block>.figma.check.yml with the computed styles of the live page, one Chromium viewport per frame. This is the deterministic token comparison of design-review: no model rounds, no reading of SCSS.
Prints one tab-separated row per token (verdict, frame, key, selector, figma, check, live, note) and a count line. Writes no receipt entry.

Exit codes:
  0  every token is PASS, OVERRIDE or SKIP
  1  at least one FAIL (live differs from the check value) or DRIFT (the check value differs from its Figma "from")
  2  a token was not proved: stale "from", node with no selector, selector that matches nothing, path with no reader, or a bad argument. A mismatch (exit 1) wins when both occur.

Frames: every frame key of the check file (except desktopAlt) unless --frame names some. The viewport width is the number after the colon, else frames.<name>.designedWidth of the snapshot. A section frame is often narrower than the page: pass the page width, e.g. --frame desktop:1920.
--url is a route (opens on the verify origin; VERIFY_BASE_URL overrides the origin) or an absolute URL.

Check file entry: { value, from: "<nodeId>.<path>", selector?, compare?, override?, reason? }
  selector        the element to measure; else map.<frame> is searched for the nodeId in "from"
  override: true  the value is deliberately not the Figma value; it is not measured, reason is required and printed
  compare: skip   the Figma node has no 1:1 element; it is not measured, reason is required and printed

The reader is chosen by the path in "from", never by the key name:
  layout.gap                          row-gap and column-gap ("10px", or "row column")
  layout.padding                      all four sides; a key ending in Top, Right, Bottom or Left checks that side, and the value is one length
  layout.dimensions[.width|.height]   box width and height ("150px 100px", or one length)
  layout.wrap, layout.mode            flex-wrap; row, column, grid or none
  textStyle.fontSize|letterSpacing|lineHeight|fontWeight|fontFamily   (em values are relative to the element font-size)
  fills                               one hex; color on a TEXT node, background-color on any other
  opacity                             computed opacity
A selector that matches several elements must pass on every one. --tolerance is the px band (default 1); the em band is 0.02, opacity 0.02, color 2 per channel. A check value that differs from its Figma value by more than 0.5 is DRIFT; a value in em against a Figma value in px is not compared.

Examples:
  node .agents/skills/verify-ui/scripts/token-check.mjs --snapshot src/Block/Block.figma.yml --check src/Block/Block.figma.check.yml --url /services/
  node .agents/skills/verify-ui/scripts/token-check.mjs --snapshot Block.figma.yml --check Block.figma.check.yml --url /services/ --frame desktop:1920 --frame tablet:768
`);

const { chromium } = requireFromApp("playwright");
const YAML = requireFromApp("yaml");

const EM_BAND = 0.02;
const OPACITY_BAND = 0.02;
const COLOR_BAND = 2;
const DRIFT_BAND = 0.5;
const DEFAULT_TOLERANCE = 1;
const VIEWPORT_HEIGHT = 900;
const SIDES = ["Top", "Right", "Bottom", "Left"];
const NUMBER = /^-?(\d+\.?\d*|\.\d+)(px|em)?$/;
const FLAGS = ["--snapshot", "--check", "--url", "--frame", "--tolerance"];

function fail(message) {
  console.error(`token-check: ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { frames: [], tolerance: DEFAULT_TOLERANCE };
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (!FLAGS.includes(flag)) {
      fail(`unknown argument ${flag}; see --help`);
    }
    if (value === undefined || value.startsWith("--")) {
      fail(`${flag} needs a value`);
    }
    if (flag === "--frame") {
      const [name, width] = value.split(":");
      if (!name || (width !== undefined && !(Number(width) > 0))) {
        fail(`--frame ${value} is not <name> or <name>:<width>`);
      }
      out.frames.push({ name, width: width === undefined ? null : Number(width) });
    } else if (flag === "--tolerance") {
      if (!(Number(value) >= 0)) {
        fail(`--tolerance ${value} is not a number of px`);
      }
      out.tolerance = Number(value);
    } else {
      out[flag.slice(2)] = value;
    }
  }
  for (const required of ["snapshot", "check", "url"]) {
    if (!out[required]) {
      fail(`--${required} is required; see --help`);
    }
  }
  return out;
}

function loadYaml(path) {
  try {
    return YAML.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    return fail(`cannot read ${path}: ${error instanceof Error ? error.message : error}`);
  }
}

function parseLengths(value) {
  if (typeof value === "number") {
    return { nums: [value], unit: "px" };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return typeof value.width === "number" && typeof value.height === "number"
      ? { nums: [value.width, value.height], unit: "px" }
      : null;
  }
  const tokens = typeof value === "string" ? value.trim().split(/\s+/) : [];
  if (tokens.length === 0 || !tokens.every((token) => NUMBER.test(token))) {
    return null;
  }
  const units = new Set(tokens.map((token) => (token.endsWith("em") ? "em" : "px")));
  return units.size === 1 ? { nums: tokens.map(Number.parseFloat), unit: [...units][0] } : null;
}

function expandBox([top, right = top, bottom = top, left = right]) {
  return [top, right, bottom, left];
}

function hexOf(value) {
  const first = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  return typeof first === "string" && /^#[0-9a-f]{6}$/i.test(first) ? first.toUpperCase() : null;
}

function channels(hex) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function hexFromComputed(color) {
  const parts = /^rgba?\(([^)]+)\)$/.exec(color)?.[1].split(/[ ,/]+/).map(Number);
  if (!parts || parts.length < 3 || !parts.every(Number.isFinite) || parts[3] === 0) {
    return null;
  }
  const hex = parts.slice(0, 3).map((channel) => Math.round(channel).toString(16).padStart(2, "0"));
  return `#${hex.join("")}`.toUpperCase();
}

function lengths(pick, live, band, bare = false) {
  return {
    parse: (value) => {
      const list = parseLengths(value);
      const nums = list && pick(list);
      return nums ? { nums, unit: list.unit } : null;
    },
    live: (sample, expected) => ({
      nums: live(sample, expected.unit).map((item, index) => (expected.nums[index] === null ? null : item)),
      unit: expected.unit,
    }),
    band: (expected, tolerance) => band?.(expected.unit) ?? (expected.unit === "em" ? EM_BAND : tolerance),
    same: (expected, other, tolerance) =>
      expected.nums.every(
        (item, index) => item === null || other.nums[index] == null || Math.abs(item - other.nums[index]) <= tolerance,
      ),
    unit: (value) => value.unit,
    show: (value) =>
      value.nums
        .filter((item) => item !== null)
        .map((item) => `${Number(item.toFixed(3))}${bare ? "" : value.unit}`)
        .join(" "),
  };
}

function words(parse, live, same = (expected, other) => expected === other) {
  return { parse, live: (sample) => live(sample), band: () => 0, same, unit: () => null, show: (value) => String(value) };
}

const lowercase = (value) => (typeof value === "string" ? value.toLowerCase() : null);
const single = (list) => (list.nums.length === 1 ? list.nums : null);

function textStyleKind(property) {
  switch (property) {
    case "fontSize":
      return lengths((list) => (list.unit === "px" ? single(list) : null), (s) => [s.fontSize]);
    case "letterSpacing":
      return lengths(single, (s, unit) => [unit === "em" ? s.letterSpacing / s.fontSize : s.letterSpacing]);
    case "lineHeight":
      return lengths(
        single,
        (s, unit) => [s.lineHeight === null ? Number.NaN : unit === "em" ? s.lineHeight / s.fontSize : s.lineHeight],
      );
    case "fontWeight":
      return lengths(single, (s) => [s.fontWeight], () => 0, true);
    default:
      return words(lowercase, (s) => s.fontFamily, (expected, other) => other.includes(expected));
  }
}

function paddingKind(key) {
  const side = SIDES.findIndex((name) => key.endsWith(name));
  const pick = (list) => {
    if (list.nums.length > 4) {
      return null;
    }
    const box = expandBox(list.nums);
    return side >= 0 ? box.map((item, index) => (index === side ? item : null)) : box;
  };
  return lengths(pick, (s) => s.padding);
}

function colorKind(nodeType) {
  return words(hexOf, (s) => hexFromComputed(nodeType === "TEXT" ? s.color : s.backgroundColor), (expected, other) => {
    const live = other && channels(other);
    return live !== null && channels(expected).every((channel, index) => Math.abs(channel - live[index]) <= COLOR_BAND);
  });
}

function kindFor(path, key, nodeType) {
  const textStyle = /^textStyle\.(fontSize|letterSpacing|lineHeight|fontWeight|fontFamily)$/.exec(path)?.[1];
  if (textStyle) {
    return textStyleKind(textStyle);
  }
  const box = (s) => [s.width, s.height];
  switch (path) {
    case "layout.gap":
      return lengths((list) => (list.nums.length <= 2 ? [list.nums[0], list.nums.at(-1)] : null), (s) => [s.rowGap, s.columnGap]);
    case "layout.padding":
      return paddingKind(key);
    case "layout.dimensions":
      return lengths((list) => (list.nums.length === 2 ? list.nums : null), box);
    case "layout.dimensions.width":
      return lengths((list) => (list.nums.length === 1 ? [list.nums[0], null] : null), box);
    case "layout.dimensions.height":
      return lengths((list) => (list.nums.length === 1 ? [null, list.nums[0]] : null), box);
    case "opacity":
      return lengths(single, (s) => [s.opacity], () => OPACITY_BAND, true);
    case "layout.wrap":
      return words(lowercase, (s) => s.flexWrap);
    case "layout.mode":
      return words(lowercase, (s) => s.mode);
    case "fills":
      return colorKind(nodeType);
    default:
      return null;
  }
}

function lookupNode(snapshot, frameName, nodeId) {
  for (const name of [frameName, ...Object.keys(snapshot.frames)]) {
    const frame = snapshot.frames[name];
    const stack = frame?.tree ? [frame.tree] : [];
    while (stack.length) {
      const node = stack.pop();
      if (node.id === nodeId) {
        return { node, globalVars: frame.globalVars ?? {} };
      }
      stack.push(...(node.children ?? []));
    }
  }
  return null;
}

function resolveFrom(snapshot, frameName, from) {
  const match = /^([^.]+)\.(.+)$/.exec(typeof from === "string" ? from : "");
  if (!match) {
    return { reason: `from ${JSON.stringify(from)} is not "<nodeId>.<path>"` };
  }
  const [, nodeId, path] = match;
  const found = lookupNode(snapshot, frameName, nodeId);
  if (!found) {
    return { reason: `stale from: node ${nodeId} is not in the snapshot` };
  }
  const deref = (value) => (typeof value === "string" && found.globalVars[value] !== undefined ? found.globalVars[value] : value);
  let current = found.node;
  for (const part of path.split(".")) {
    current = deref(current);
    current = current !== null && typeof current === "object" ? current[part] : undefined;
  }
  current = deref(current);
  if (current === undefined) {
    return { reason: `stale from: ${path} is missing on node ${nodeId}` };
  }
  return { value: current, path, nodeId, nodeType: found.node.type };
}

function selectorFor(entry, map, nodeId) {
  if (typeof entry.selector === "string" && entry.selector.trim()) {
    return entry.selector.trim();
  }
  return Object.entries(map).find(([, id]) => String(id) === nodeId)?.[0] ?? null;
}

function display(value) {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function judge({ kind, expected, note }, samples, tolerance) {
  const band = kind.band(expected, tolerance);
  let live = null;
  for (const [index, sample] of samples.entries()) {
    live = kind.live(sample, expected);
    if (!kind.same(expected, live, band)) {
      const where = samples.length > 1 ? ` (element ${index + 1} of ${samples.length})` : "";
      return { verdict: "FAIL", live: live && kind.show(live), note: `live differs from check${where}` };
    }
  }
  return { verdict: "PASS", live: kind.show(live), note };
}

function planTokens(snapshot, check, frameName) {
  const map = check.map?.[frameName] ?? {};
  return Object.entries(check[frameName]).map(([key, entry]) => {
    const row = { frame: frameName, key, selector: "—", from: entry?.from, checkValue: entry?.value };
    if (!entry || typeof entry !== "object") {
      return { ...row, verdict: "UNRESOLVED", note: "entry is not a mapping" };
    }
    const waived = entry.override === true ? "override: true" : entry.compare === "skip" ? "compare: skip" : null;
    if (waived) {
      const reason = typeof entry.reason === "string" ? entry.reason.trim().replace(/\s+/g, " ") : "";
      return reason
        ? { ...row, verdict: entry.override === true ? "OVERRIDE" : "SKIP", note: reason }
        : { ...row, verdict: "UNRESOLVED", note: `${waived} needs a reason` };
    }
    const resolved = resolveFrom(snapshot, frameName, entry.from);
    if (resolved.reason) {
      return { ...row, verdict: "UNRESOLVED", note: resolved.reason };
    }
    const kind = kindFor(resolved.path, key, resolved.nodeType);
    if (!kind) {
      return { ...row, verdict: "UNRESOLVED", note: `no reader for ${resolved.path}; add compare: skip with a reason` };
    }
    const expected = kind.parse(entry.value);
    const figma = kind.parse(resolved.value);
    if (expected === null || figma === null) {
      const [which, value] = expected === null ? ["check", entry.value] : ["figma", resolved.value];
      return { ...row, verdict: "UNRESOLVED", note: `${which} value ${JSON.stringify(value)} does not fit ${resolved.path}` };
    }
    const shown = { ...row, figma: kind.show(figma) };
    let note = "";
    if (kind.unit(expected) !== kind.unit(figma)) {
      note = `check ${kind.show(expected)} and figma ${shown.figma} differ in unit; drift not compared`;
    } else if (!kind.same(expected, figma, DRIFT_BAND)) {
      return { ...shown, verdict: "DRIFT", note: `check ${kind.show(expected)} differs from figma ${shown.figma}` };
    }
    const selector = selectorFor(entry, map, resolved.nodeId);
    if (!selector) {
      return { ...shown, verdict: "UNRESOLVED", note: `node ${resolved.nodeId} has no selector; add it to map.${frameName} or set selector:` };
    }
    return { ...shown, selector, kind, expected, note };
  });
}

function readSamples(selectors) {
  const px = (value) => (value === "normal" ? 0 : Number.parseFloat(value));
  const read = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const display = style.display;
    const column = style.flexDirection.startsWith("column");
    return {
      rowGap: px(style.rowGap),
      columnGap: px(style.columnGap),
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px),
      width: rect.width,
      height: rect.height,
      fontSize: px(style.fontSize),
      letterSpacing: px(style.letterSpacing),
      lineHeight: style.lineHeight === "normal" ? null : px(style.lineHeight),
      fontWeight: Number.parseInt(style.fontWeight, 10),
      fontFamily: style.fontFamily.toLowerCase().replace(/["']/g, ""),
      flexWrap: style.flexWrap,
      mode: display.includes("grid") ? "grid" : display.includes("flex") ? (column ? "column" : "row") : "none",
      color: style.color,
      backgroundColor: style.backgroundColor,
      opacity: Number.parseFloat(style.opacity),
    };
  };
  return Object.fromEntries(
    selectors.map((selector) => {
      try {
        return [selector, [...document.querySelectorAll(selector)].map(read)];
      } catch {
        return [selector, null];
      }
    }),
  );
}

async function proveFrame(browser, url, frame, tokens, tolerance) {
  const context = await browser.newContext({
    viewport: { width: frame.width, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const nav = await gotoReady(page, url);
    if (!nav || !nav.ok()) {
      fail(`${url} HTTP ${nav?.status() ?? "no response"}`);
    }
    const selectors = [...new Set(tokens.filter((token) => !token.verdict).map((token) => token.selector))];
    const samples = await page.evaluate(readSamples, selectors);
    return tokens.map((token) => {
      if (token.verdict) return token;
      const found = samples[token.selector];
      if (found === null) return { ...token, verdict: "UNRESOLVED", note: `${token.selector} is not a valid selector` };
      if (found.length === 0) return { ...token, verdict: "UNRESOLVED", note: `selector ${token.selector} matched 0 elements` };
      return { ...token, ...judge(token, found, tolerance) };
    });
  } finally {
    await context.close();
  }
}

function frameWidth(snapshot, requested) {
  const width = requested.width ?? snapshot.frames[requested.name]?.designedWidth;
  if (!(width > 0)) {
    fail(`frame ${requested.name} has no width; pass --frame ${requested.name}:<width>`);
  }
  return { name: requested.name, width: Math.round(width) };
}

function frameList(args, snapshot, check) {
  const hasTokens = (name) => check[name] !== null && typeof check[name] === "object";
  const requested = args.frames.length
    ? args.frames
    : Object.keys(check)
        .filter((name) => !["version", "map", "desktopAlt"].includes(name) && hasTokens(name))
        .map((name) => ({ name, width: null }));
  if (requested.length === 0) {
    fail("the check file has no frame with tokens");
  }
  for (const { name } of requested) {
    if (!hasTokens(name)) {
      fail(`the check file has no frame ${name}`);
    }
  }
  return requested.map((frame) => frameWidth(snapshot, frame));
}

function printRow(row) {
  console.log(
    [
      row.verdict,
      row.frame,
      row.key,
      row.selector,
      `figma ${display(row.figma ?? row.from)}`,
      `check ${display(row.checkValue)}`,
      `live ${row.live ?? "—"}`,
      row.note ?? "",
    ].join("\t"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = loadYaml(args.snapshot);
  const check = loadYaml(args.check);
  if (!snapshot?.frames || !check || typeof check !== "object") {
    fail("the snapshot needs frames and the check file must be a mapping");
  }
  const url = new URL(args.url, targetOrigin()).href;
  const frames = frameList(args, snapshot, check);
  await holdRunSlot("token-check");
  const browser = await chromium.launch({ headless: true, channel: "chromium" });
  const rows = [];
  try {
    for (const frame of frames) {
      rows.push(...(await proveFrame(browser, url, frame, planTokens(snapshot, check, frame.name), args.tolerance)));
    }
  } finally {
    await browser.close();
  }
  rows.forEach(printRow);
  const count = (verdict) => rows.filter((row) => row.verdict === verdict).length;
  console.log(
    `token-check: ${rows.length} tokens, ${count("PASS")} PASS, ${count("FAIL")} FAIL, ${count("DRIFT")} DRIFT, ${count("UNRESOLVED")} UNRESOLVED, ${count("OVERRIDE")} OVERRIDE, ${count("SKIP")} SKIP`,
  );
  if (count("FAIL") + count("DRIFT") > 0) {
    process.exit(1);
  }
  if (count("UNRESOLVED") > 0) {
    process.exit(2);
  }
}

await main();
