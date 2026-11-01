import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mapPath = join(frontendRoot, '../.cursor/fstack/features.md');
const srcRoot = join(frontendRoot, 'src');
const map = readFileSync(mapPath, 'utf8');
const errors = [];

const SKIP = new Set(['node_modules', 'stories', '__tests__', '__fixtures__']);
const productFiles = [];

function collectFiles(dir) {
    for (const entry of readdirSync(dir)) {
        if (SKIP.has(entry) || entry.endsWith('.stories')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectFiles(full);
            continue;
        }
        if (!/\.(astro|tsx|ts|jsx|js|md|json)$/.test(entry)) continue;
        if (/\.stories\./.test(entry)) continue;
        productFiles.push(full);
    }
}

collectFiles(srcRoot);
const productText = productFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

const featuresStart = map.indexOf('## Features');
const handlesStart = map.indexOf('## Handles');
const recipesStart = map.indexOf('## Recipes');
if (featuresStart < 0 || recipesStart < 0) {
    console.error('lint:feature-map: features.md needs ## Features and ## Recipes');
    process.exit(1);
}

const featuresBlock = map.slice(featuresStart, handlesStart > featuresStart ? handlesStart : recipesStart);
const recipesBlock = map.slice(recipesStart);

function slugify(title) {
    return title
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-');
}

const rows = [];
for (const match of featuresBlock.matchAll(/^\|([^|]+)\|([^|]+)\|([^|]+)\|$/gm)) {
    const feature = match[1].trim();
    const recipe = match[3].trim();
    if (feature === 'Feature' || /^[-:]+$/.test(feature)) continue;
    rows.push({ feature, recipe });
}

if (!rows.length) errors.push('Features table has no data rows');

const anchors = new Set();
for (const m of recipesBlock.matchAll(/^###\s+(.+)$/gm)) anchors.add(slugify(m[1]));
for (const m of map.matchAll(/<a\s+id="([^"]+)"/g)) anchors.add(m[1]);

for (const row of rows) {
    const links = [...row.recipe.matchAll(/\[([^\]]+)\]\(#([^)]+)\)/g)];
    if (!links.length) {
        errors.push(`row "${row.feature}" has no recipe link`);
        continue;
    }
    for (const link of links) {
        if (!anchors.has(link[2])) {
            errors.push(`row "${row.feature}" links missing #${link[2]}`);
        }
    }
}

for (const line of recipesBlock.split('\n')) {
    const step = line.trim();
    if (!step.startsWith('-')) continue;
    if (/\b(?:querySelector(?:All)?|getElementById|classList)\b/.test(step)) {
        errors.push(`code handle in recipe step: ${step.slice(0, 120)}`);
    }
    if (/--selector\s+(["'])(?!role=|text=)/.test(step)) {
        errors.push(`code handle in recipe step: ${step.slice(0, 120)}`);
    }
}

for (const m of map.matchAll(/--name\s+"([^"]+)"|--name\s+'([^']+)'|name='([^']+)'|name="([^"]+)"/g)) {
    const name = m[1] || m[2] || m[3] || m[4];
    if (name && !productText.includes(name)) {
        errors.push(`accessible name "${name}" not found in src product code`);
    }
}

if (errors.length) {
    console.error('lint:feature-map:');
    for (const line of errors) console.error(`  ${line}`);
    process.exit(1);
}
