import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { requireFromApp } from "./project.mjs";

const SKIP_REASON = "no selector in the check map: confirm the route does not render it";

const visible = (node) => node.visible !== false;

const frameOf = (figmaFile, frameId) => {
  for (const entry of Object.values(figmaFile.nodes ?? {})) {
    const found = findNode(entry.document, frameId);
    if (found) return found;
  }
  throw new Error(`frame ${frameId} is not in the figma file`);
};

function findNode(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function* descendants(node) {
  for (const child of node.children ?? []) {
    yield child;
    yield* descendants(child);
  }
}

const hugText = (node) => node.type === "TEXT" && node.style?.textAutoResize === "WIDTH_AND_HEIGHT";

function axisOf(frame, prev, next) {
  if (frame.layoutMode === "HORIZONTAL") return "x";
  if (frame.layoutMode === "VERTICAL") return "y";
  const a = prev.absoluteBoundingBox;
  const b = next.absoluteBoundingBox;
  return a && b && b.x >= a.x + a.width && b.y < a.y + a.height ? "x" : "y";
}

export function buildManifest({ figmaFile, frameId, map, url, fileKey, figmaFilePath }) {
  const frame = frameOf(figmaFile, frameId);
  const selectorOf = new Map();
  for (const [selector, nodeId] of Object.entries(map)) {
    if (!selectorOf.has(nodeId)) selectorOf.set(nodeId, selector);
  }
  const warnings = [];
  const children = (frame.children ?? []).filter(visible);
  const sections = children.filter((child) => selectorOf.has(child.id));
  const skip = children
    .filter((child) => !selectorOf.has(child.id))
    .map((child) => ({ nodeId: child.id, reason: SKIP_REASON }));
  for (const item of skip) {
    warnings.push(`skipped ${item.nodeId}: ${SKIP_REASON}`);
  }

  const end = (node) => ({ selector: selectorOf.get(node.id), nodeId: node.id });
  const seams = [];
  for (let index = 0; index + 1 < children.length; index += 1) {
    const [prev, next] = [children[index], children[index + 1]];
    if (!selectorOf.has(prev.id) || !selectorOf.has(next.id)) continue;
    seams.push({
      name: `${prev.name} to ${next.name}`,
      axis: axisOf(frame, prev, next),
      prev: end(prev),
      next: end(next),
    });
  }

  const inSeam = new Set(seams.flatMap((seam) => [seam.prev.nodeId, seam.next.nodeId]));
  const origins = [];
  for (const section of sections) {
    const block = [...descendants(section)].find(
      (node) => visible(node) && selectorOf.has(node.id) && !hugText(node),
    );
    if (block) {
      origins.push({ name: block.name, ...end(block) });
    } else if (!inSeam.has(section.id)) {
      origins.push({ name: section.name, ...end(section) });
    }
  }
  if (origins.length === 0 && sections.length > 0) {
    origins.push({ name: sections[0].name, ...end(sections[0]) });
    warnings.push(`no mapped block inside a section: ${sections[0].id} is the origin`);
  }

  return {
    manifest: {
      fileKey,
      frameId,
      url,
      ...(figmaFilePath ? { figmaFile: figmaFilePath } : {}),
      seams,
      origins,
      skip,
    },
    warnings,
  };
}

const FLAGS = ["--figma-file", "--frame", "--check", "--map", "--url", "--file-key", "--out"];

function parseInitArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--init") continue;
    if (!FLAGS.includes(arg)) {
      throw new Error(`layout-proof --init: unknown flag ${arg}`);
    }
    values[arg] = argv[++index];
  }
  const missing = FLAGS.filter((flag) => !values[flag]);
  if (missing.length > 0) {
    throw new Error(`layout-proof --init needs ${missing.join(", ")}`);
  }
  return values;
}

export function runInit(argv) {
  const args = parseInitArgs(argv);
  const YAML = requireFromApp("yaml");
  const check = YAML.parse(readFileSync(resolve(args["--check"]), "utf8"));
  const map = check?.map?.[args["--map"]];
  if (!map || typeof map !== "object") {
    throw new Error(`layout-proof --init: ${args["--check"]} has no map.${args["--map"]}`);
  }
  const out = resolve(args["--out"]);
  const figmaPath = resolve(args["--figma-file"]);
  const { manifest, warnings } = buildManifest({
    figmaFile: JSON.parse(readFileSync(figmaPath, "utf8")),
    frameId: args["--frame"],
    map,
    url: args["--url"],
    fileKey: args["--file-key"],
    figmaFilePath: relative(dirname(out), figmaPath),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const warning of warnings) {
    console.error(`layout-proof --init: ${warning}`);
  }
  console.log(
    `layout-proof --init: ${out} (${manifest.seams.length} seams, ${manifest.origins.length} origins, ${manifest.skip.length} skip)`,
  );
}
