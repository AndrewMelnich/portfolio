#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerHelp } from "./cli-help.mjs";
import { isMain, requireFromApp } from "./project.mjs";
import { holdRunSlot } from "./run-slot.mjs";

const sharp = requireFromApp("sharp");

const LABEL_H = 34;
const GAP = 16;
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

const escapeXml = (text) =>
  text.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

const labelSvg = (text, width) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_H}">` +
      `<text x="4" y="24" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#111">${escapeXml(text)}</text>` +
      `</svg>`,
  );

const UNIFORM_STDEV = 4;
const VARIANT_SAMPLE = 96;
const CHANNEL_TOLERANCE = 8;
const MIN_DIFFERING_SHARE = 0.005;

const samplePixels = (path) =>
  sharp(path)
    .resize(VARIANT_SAMPLE, VARIANT_SAMPLE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

const differingShare = (a, b) => {
  const pixels = a.length / 3;
  let differing = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (
      Math.abs(a[i] - b[i]) > CHANNEL_TOLERANCE ||
      Math.abs(a[i + 1] - b[i + 1]) > CHANNEL_TOLERANCE ||
      Math.abs(a[i + 2] - b[i + 2]) > CHANNEL_TOLERANCE
    ) {
      differing += 1;
    }
  }
  return differing / pixels;
};

const referenceProblems = async (panels) => {
  const problems = [];
  for (const panel of panels.filter((item) => item.label === "reference")) {
    const { channels } = await sharp(panel.path).stats();
    const spread = Math.max(...channels.map((channel) => channel.stdev));
    if (spread < UNIFORM_STDEV) {
      problems.push(
        `reference ${panel.path} is near-uniform (pixel stdev ${spread.toFixed(1)}): a blank or black render cannot grade a sheet`,
      );
    }
  }
  return problems;
};

const variantProblems = async (panels) => {
  const problems = [];
  const variants = panels.filter((panel) => panel.label.startsWith("variant"));
  for (let i = 0; i < variants.length; i += 1) {
    for (let j = i + 1; j < variants.length; j += 1) {
      const share = differingShare(
        await samplePixels(variants[i].path),
        await samplePixels(variants[j].path),
      );
      if (share < MIN_DIFFERING_SHARE) {
        problems.push(
          `${variants[i].label} and ${variants[j].label} are near-identical (${(share * 100).toFixed(2)}% of pixels differ): a duplicate variant`,
        );
      }
    }
  }
  return problems;
};

export async function sheetProblems(panels, { figma = false } = {}) {
  const missingReference =
    figma && !panels.some((panel) => panel.label === "reference")
      ? ["--figma sheet: a reference panel is required (reference=<Figma export>)"]
      : [];
  return [
    ...missingReference,
    ...(await referenceProblems(panels)),
    ...(await variantProblems(panels)),
  ];
}

export async function composeSheet(
  panels,
  { out, height = 420, columns = panels.length },
) {
  const tiles = await Promise.all(
    panels.map(async ({ label, path, buffer }) => {
      const image = sharp(buffer ?? path).resize({
        height,
        width: height * 2.5,
        fit: "inside",
      });
      const { data, info } = await image
        .png()
        .toBuffer({ resolveWithObject: true });
      return {
        label,
        data,
        width: Math.max(info.width, label.length * 11 + 8),
      };
    }),
  );

  const rows = [];
  for (let i = 0; i < tiles.length; i += columns)
    rows.push(tiles.slice(i, i + columns));
  const rowWidth = (row) =>
    row.reduce((sum, t) => sum + t.width, 0) + GAP * (row.length + 1);
  const width = Math.max(...rows.map(rowWidth));
  const rowH = LABEL_H + height + GAP;
  const sheetH = rows.length * rowH + GAP;

  const layers = [];
  rows.forEach((row, r) => {
    let x = GAP;
    const top = GAP + r * rowH;
    for (const tile of row) {
      layers.push({ input: labelSvg(tile.label, tile.width), left: x, top });
      layers.push({ input: tile.data, left: x, top: top + LABEL_H });
      x += tile.width + GAP;
    }
  });

  mkdirSync(dirname(resolve(out)), { recursive: true });
  await sharp({
    create: { width, height: sheetH, channels: 4, background: BG },
  })
    .composite(layers)
    .png()
    .toFile(resolve(out));
  return { out: resolve(out), width, height: sheetH };
}

if (isMain(import.meta.url)) {
  answerHelp(`Usage: visual-compare.mjs --out <sheet.png> [--figma] [--height 420] [--columns N] label=path ...

Composes labeled panels (before, after, reference, variant-*) into one sheet image for visual-judge.
--figma marks a Figma-scoped sheet: the reference=<Figma export> panel is required, or no sheet is written.
A reference panel must not be near-uniform (blank or black). Two variant-* panels with near-identical pixels are refused.
--columns sets the grid width (default: one row). --height sets each panel's height in px.

Examples:
  node .agents/skills/verify-ui/scripts/visual-compare.mjs --out .cursor/fstack/artifacts/faq/sheet.png before=.cursor/fstack/artifacts/faq/before.png after=.cursor/fstack/artifacts/faq/after.png
  node .agents/skills/verify-ui/scripts/visual-compare.mjs --figma --out sheet.png --columns 2 reference=ref.png before=a.png after=b.png
`);
  const args = process.argv.slice(2);
  const figma = args.includes("--figma");
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const out = flag("--out");
  const height = Number(flag("--height") ?? 420);
  const columns = flag("--columns");
  const panels = args.filter((arg) => arg !== "--figma").map((arg) => {
    const eq = arg.indexOf("=");
    if (eq < 1) throw new Error(`panel must be label=path, got "${arg}"`);
    return { label: arg.slice(0, eq), path: resolve(arg.slice(eq + 1)) };
  });
  if (!out || panels.length === 0) {
    console.error(
      "Usage: visual-compare.mjs --out <sheet.png> [--figma] [--height 420] [--columns N] label=path ...",
    );
    process.exit(2);
  }
  await holdRunSlot("visual-compare");
  const problems = await sheetProblems(panels, { figma });
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  const result = await composeSheet(panels, {
    out,
    height,
    columns: Number(columns ?? panels.length),
  });
  console.log(
    JSON.stringify(
      { ok: true, ...result, panels: panels.map((p) => p.label) },
      null,
      2,
    ),
  );
}
