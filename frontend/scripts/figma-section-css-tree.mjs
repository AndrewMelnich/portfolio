import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import YAML from 'yaml';

const args = process.argv.slice(2);
const url = getArg('--url');
const selector = getArg('--selector');
const snapshotPath = getArg('--snapshot');
const frameKey = getArg('--frame') ?? 'desktop';
const widthOverride = getArg('--width');
const heightOverride = getArg('--height');
const outArg = getArg('--out');
const depthArg = getArg('--depth');

if (!url || !selector) {
    console.error(
        'Usage: pnpm figma:css-tree -- --url <url> --selector <css> [--snapshot <figma.yml> --frame desktop] [--width N] [--height N] [--out file.css-tree.yml]',
    );
    process.exit(1);
}

let viewportWidth = widthOverride != null ? Number(widthOverride) : null;
let designedWidth = null;
let designedHeight = null;

if (snapshotPath) {
    const snap = YAML.parse(fs.readFileSync(path.resolve(snapshotPath), 'utf8'));
    const frame = snap?.frames?.[frameKey];

    if (!frame) {
        console.error(`Frame "${frameKey}" not found in snapshot`);
        process.exit(1);
    }

    designedWidth = frame.designedWidth ?? null;
    designedHeight = frame.designedHeight ?? null;

    if (viewportWidth == null && designedWidth != null) {
        viewportWidth = designedWidth;
    }
}

if (viewportWidth == null || Number.isNaN(viewportWidth)) {
    console.error('Need --width or --snapshot with frames.<frame>.designedWidth');
    process.exit(1);
}

const viewportHeight =
    heightOverride != null ? Number(heightOverride) : designedHeight != null ? Number(designedHeight) : 900;

if (Number.isNaN(viewportHeight)) {
    console.error('Invalid --height');
    process.exit(1);
}

const resolvedUrl = resolveUrl(url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
    viewport: { width: Math.round(viewportWidth), height: Math.round(viewportHeight) },
});

try {
    const response = await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    if (response && !response.ok() && response.status() !== 0) {
        if (!resolvedUrl.startsWith('file:')) {
            console.error(`URL unreachable or bad status ${response.status()}: ${resolvedUrl}`);
            process.exitCode = 1;
            await browser.close();
            process.exit(1);
        }
    }
} catch (err) {
    console.error(`URL unreachable: ${resolvedUrl}`);
    console.error(String(err?.message ?? err));
    await browser.close();
    process.exit(1);
}

const maxDepth = depthArg != null ? Number(depthArg) : 6;
const tree = await page.evaluate(
    ({ sel, maxDepth: depth }) => {
        const root = document.querySelector(sel);
        if (!root) return null;

        const PROPS = [
            'display',
            'flex-direction',
            'justify-content',
            'align-items',
            'gap',
            'row-gap',
            'column-gap',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
            'margin-top',
            'margin-right',
            'margin-bottom',
            'margin-left',
            'width',
            'height',
            'max-width',
            'opacity',
            'color',
            'font-family',
            'font-size',
            'font-weight',
            'line-height',
            'letter-spacing',
            'text-transform',
            'border-radius',
            'position',
            'top',
            'left',
            'right',
            'bottom',
        ];

        function dump(el, d) {
            const cs = getComputedStyle(el);
            const styles = {};
            for (const p of PROPS) styles[p] = cs.getPropertyValue(p);
            const rect = el.getBoundingClientRect();
            /** @type {object} */
            const node = {
                tag: el.tagName.toLowerCase(),
                classes: [...el.classList],
                box: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
                styles,
            };
            if (d > 0) {
                node.children = [...el.children].map((c) => dump(c, d - 1));
            }
            return node;
        }

        return dump(root, depth);
    },
    { sel: selector, maxDepth },
);

await browser.close();

if (!tree) {
    console.error(`Selector not found: ${selector}`);
    process.exit(1);
}

const doc = {
    url: resolvedUrl,
    selector,
    frame: frameKey,
    viewportWidth: Math.round(viewportWidth),
    viewportHeight: Math.round(viewportHeight),
    designedWidth,
    designedHeight,
    fetchedAt: new Date().toISOString().slice(0, 10),
    tree,
};

const yamlOut = YAML.stringify(doc, { lineWidth: 120 });

if (outArg) {
    const outPath = path.resolve(outArg);
    fs.writeFileSync(outPath, yamlOut, 'utf8');
    console.error(`Wrote ${outPath}`);
} else {
    process.stdout.write(yamlOut);
}

function getArg(name) {
    const i = args.indexOf(name);
    if (i === -1) return null;
    return args[i + 1] ?? null;
}

function resolveUrl(u) {
    if (/^https?:\/\//.test(u) || u.startsWith('file:')) return u;
    const abs = path.resolve(u);
    if (fs.existsSync(abs)) return pathToFileURL(abs).href;
    return u;
}
