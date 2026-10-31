import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

loadEnv(path.join(ROOT, '.env'));

const token = process.env.FIGMA_API_KEY ?? process.env.PUBLIC_FIGMA_TOKEN;
const fileKey = getArg('--file') ?? process.env.FIGMA_FILE_KEY ?? process.env.PUBLIC_FIGMA_FILE_ID;
const nodeId = normalizeNodeId(getArg('--node') ?? process.env.FIGMA_NODE_ID);

if (!token) {
    throw new Error('Нужен PUBLIC_FIGMA_TOKEN или FIGMA_API_KEY в frontend/.env');
}
if (!fileKey) {
    throw new Error('Нужен --file или PUBLIC_FIGMA_FILE_ID / FIGMA_FILE_KEY');
}
if (!nodeId) {
    throw new Error('Нужен --node <id> (например 740:783 или 740-783)');
}

const node = await fetchNode(fileKey, nodeId, token);
const { width, height } = getFrameSize(node);
const grid = resolveColumnsGrid(node);

if (!grid) {
    console.log(
        JSON.stringify(
            {
                hasGrid: false,
                fileKey,
                nodeId,
                name: node.name,
                frame: { width, height },
            },
            null,
            2,
        ),
    );
    process.exit(0);
}

assertGridFitsFrame(grid, width);

const starts = [];
for (let n = 1; n <= grid.count; n += 1) {
    starts.push({
        col: n,
        x: grid.offset + (n - 1) * (grid.sectionSize + grid.gutterSize),
    });
}

console.log(
    JSON.stringify(
        {
            hasGrid: true,
            fileKey,
            nodeId,
            name: node.name,
            frame: { width, height },
            grid: {
                pattern: grid.pattern,
                count: grid.count,
                offset: grid.offset,
                gutterSize: grid.gutterSize,
                sectionSize: grid.sectionSize,
                alignment: grid.alignment,
                visible: grid.visible,
            },
            colStarts: starts,
            snapHint: 'snapped if |element.x - colStarts[n].x| ≤ 1 (and/or right edge). Else use raw Figma px.',
        },
        null,
        2,
    ),
);

function loadEnv(envPath) {
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
    }
}

function getArg(flag) {
    const i = process.argv.indexOf(flag);
    return i === -1 ? undefined : process.argv[i + 1];
}

function normalizeNodeId(id) {
    if (!id) return undefined;
    return String(id).replace(/-/g, ':');
}

async function fetchNode(fileKey, nodeId, token) {
    const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
    const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`Figma nodes API ${res.status}: ${data.err ?? JSON.stringify(data)}`);
    }
    const node = data.nodes?.[nodeId]?.document;
    if (!node) throw new Error(`Нода ${nodeId} не найдена`);
    return node;
}

function resolveColumnsGrid(node) {
    const grids = node.layoutGrids ?? [];
    return (
        grids.find((g) => g.pattern === 'COLUMNS' && g.visible !== false) ??
        grids.find((g) => g.pattern === 'COLUMNS') ??
        null
    );
}

function getFrameSize(node) {
    const bb = node.absoluteBoundingBox;
    if (!bb?.width || !bb?.height) {
        throw new Error(`У ноды "${node.name}" нет absoluteBoundingBox`);
    }
    return { width: bb.width, height: bb.height };
}

function assertGridFitsFrame(grid, frameWidth) {
    const content = grid.offset * 2 + grid.count * grid.sectionSize + (grid.count - 1) * grid.gutterSize;
    const delta = Math.abs(content - frameWidth);
    if (delta > 0.5) {
        throw new Error(
            `Сетка не сходится с шириной фрейма: content=${content.toFixed(2)} frame=${frameWidth} delta=${delta.toFixed(2)}`,
        );
    }
}

(function selfCheck() {
    const grid = { offset: 20, gutterSize: 20, sectionSize: 67.77777862548828, count: 18 };
    assertGridFitsFrame(grid, 1600);
})();
