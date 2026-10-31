import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { API_BASE, figmaFetch, getToken } from './figma-diff-api.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_VISUAL_DIR = path.join(REPO_ROOT, '.figma-diff-cache', 'visual');
const MAX_FRAMES = 3;
const THRESHOLD = 0.1;

function isVisualPath(path) {
    if (path.startsWith('absoluteBoundingBox.')) {
        return path.endsWith('.width') || path.endsWith('.height');
    }
    return /^(characters|opacity|visible|padding|itemSpacing|counterAxisSpacing|layoutMode|primaryAxis|counterAxis|fills|strokes|stroke|corner|rectangleCorner|font|lineHeight|letterSpacing|textAlign|effects|blendMode)/.test(
        path,
    );
}

function createBucket() {
    const out = [];
    const seen = new Set();
    return {
        out,
        push(id, name) {
            if (!id || seen.has(id) || out.length >= MAX_FRAMES) {
                return;
            }
            seen.add(id);
            out.push({ id, name: name ?? id });
        },
    };
}

function changedPathIsVisual(item) {
    return (item.paths ?? []).some((entry) => isVisualPath(entry.path));
}

function collectFrameTargets(frame, bucket) {
    for (const item of frame.changed ?? []) {
        if (changedPathIsVisual(item)) {
            bucket.push(item.id, item.name);
        }
    }
    for (const item of [...(frame.added ?? []), ...(frame.removed ?? [])]) {
        bucket.push(item.id, item.name);
    }
}

function collectChangedFrames(model, bucket) {
    for (const page of model.pages ?? []) {
        for (const frame of page.frames ?? []) {
            collectFrameTargets(frame, bucket);
        }
    }
}

function addScopeFallback(model, bucket) {
    const scope = model.scope;
    if (!scope?.id || scope.kind === 'page') {
        return;
    }
    bucket.push(scope.id, scope.name);
}

export function visualTargets(model) {
    const bucket = createBucket();
    collectChangedFrames(model, bucket);
    if (!bucket.out.length) {
        addScopeFallback(model, bucket);
    }
    return bucket.out;
}

const CHANNEL_DELTA = Math.round(THRESHOLD * 255);

function pixelAt(png, x, y) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) {
        return null;
    }
    const i = (png.width * y + x) << 2;
    const alpha = png.data[i + 3] / 255;
    if (alpha < 0.04) {
        return [255, 255, 255];
    }

    return [
        Math.round(png.data[i] * alpha + 255 * (1 - alpha)),
        Math.round(png.data[i + 1] * alpha + 255 * (1 - alpha)),
        Math.round(png.data[i + 2] * alpha + 255 * (1 - alpha)),
    ];
}

function differs(left, right) {
    if (!left || !right) {
        return Boolean(left) !== Boolean(right);
    }

    return (
        Math.abs(left[0] - right[0]) > CHANNEL_DELTA ||
        Math.abs(left[1] - right[1]) > CHANNEL_DELTA ||
        Math.abs(left[2] - right[2]) > CHANNEL_DELTA
    );
}

function tint(rgb) {
    const keep = 0.45;

    return [Math.round(rgb[0] * keep + 255 * (1 - keep)), Math.round(rgb[1] * keep), Math.round(rgb[2] * keep), 255];
}

/**
 * @param {Buffer} beforeBuf
 * @param {Buffer} afterBuf
 */
export function diffPngBuffers(beforeBuf, afterBuf) {
    const before = PNG.sync.read(beforeBuf);
    const after = PNG.sync.read(afterBuf);
    const width = Math.max(before.width, after.width);
    const height = Math.max(before.height, after.height);
    const diff = new PNG({ width, height });
    let diffPixels = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const left = pixelAt(before, x, y);
            const right = pixelAt(after, x, y);
            const base = right ?? left ?? [255, 255, 255];
            const i = (width * y + x) << 2;
            const changed = differs(left, right);
            const rgba = changed ? tint(base) : [base[0], base[1], base[2], 255];

            diff.data[i] = rgba[0];
            diff.data[i + 1] = rgba[1];
            diff.data[i + 2] = rgba[2];
            diff.data[i + 3] = rgba[3];
            if (changed) {
                diffPixels += 1;
            }
        }
    }

    return {
        diffPixels,
        height,
        png: PNG.sync.write(diff),
        totalPixels: width * height,
        width,
    };
}

function safeId(nodeId) {
    return String(nodeId).replace(/[^A-Za-z0-9._-]/g, '-');
}

async function imageUrls(fileKey, nodeIds, { token, version, fetchImpl }) {
    const q = new URLSearchParams({ format: 'png', ids: nodeIds.join(','), scale: '1' });
    if (version) {
        q.set('version', String(version));
    }
    const meta = await figmaFetch(`${API_BASE}/v1/images/${encodeURIComponent(fileKey)}?${q}`, { fetchImpl, token });
    return meta.images ?? {};
}

async function downloadPng(url, fetchImpl) {
    const res = await fetchImpl(url);
    if (!res.ok) {
        throw new Error(`PNG download ${res.status} ${url}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

function percent(diffPixels, totalPixels) {
    if (!totalPixels) {
        return '0.0';
    }
    return ((diffPixels / totalPixels) * 100).toFixed(1);
}

/**
 * @param {{
 *   model: object,
 *   beforeVersion?: string | null,
 *   afterVersion?: string | null,
 *   outDir?: string,
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 * }} opts
 */
function oneSidedKind(beforeUrl, afterUrl) {
    if (afterUrl) {
        return 'after';
    }
    if (beforeUrl) {
        return 'before';
    }
    return null;
}

async function writeOneSided(dir, beforeUrl, afterUrl, fetchImpl) {
    const only = oneSidedKind(beforeUrl, afterUrl);
    if (only === 'after') {
        fs.writeFileSync(path.join(dir, 'after.png'), await downloadPng(afterUrl, fetchImpl));
    } else if (only === 'before') {
        fs.writeFileSync(path.join(dir, 'before.png'), await downloadPng(beforeUrl, fetchImpl));
    }
    return only;
}

function oneSidedLine(target, dir, only) {
    const state = only ? `only ${only}` : 'no render';
    return `- \`${target.name}\` (\`${target.id}\`) ${state} → ${dir}`;
}

async function writePair(dir, beforeUrl, afterUrl, fetchImpl) {
    const [beforeBuf, afterBuf] = await Promise.all([
        downloadPng(beforeUrl, fetchImpl),
        downloadPng(afterUrl, fetchImpl),
    ]);
    fs.writeFileSync(path.join(dir, 'before.png'), beforeBuf);
    fs.writeFileSync(path.join(dir, 'after.png'), afterBuf);
    const diff = diffPngBuffers(beforeBuf, afterBuf);
    const diffPath = path.join(dir, 'diff.png');
    fs.writeFileSync(diffPath, diff.png);
    return { diff, diffPath };
}

function pairLine(target, diff, diffPath) {
    const pct = percent(diff.diffPixels, diff.totalPixels);
    return `- \`${target.name}\` (\`${target.id}\`) ${pct}% (${diff.diffPixels} px) → ${diffPath}`;
}

async function renderTarget(fileKey, outDir, maps, target, fetchImpl) {
    const dir = path.join(outDir, fileKey, safeId(target.id));
    fs.mkdirSync(dir, { recursive: true });
    const beforeUrl = maps.before[target.id];
    const afterUrl = maps.after[target.id];
    if (!beforeUrl || !afterUrl) {
        const only = await writeOneSided(dir, beforeUrl, afterUrl, fetchImpl);
        return oneSidedLine(target, dir, only);
    }
    const written = await writePair(dir, beforeUrl, afterUrl, fetchImpl);
    return pairLine(target, written.diff, written.diffPath);
}

async function loadImageMaps(fileKey, ids, beforeVersion, afterVersion, token, fetchImpl) {
    const [before, after] = await Promise.all([
        imageUrls(fileKey, ids, { fetchImpl, token, version: beforeVersion }),
        imageUrls(fileKey, ids, { fetchImpl, token, version: afterVersion }),
    ]);
    return { after, before };
}

export async function writeVisualDiff({
    model,
    beforeVersion,
    afterVersion = null,
    outDir = DEFAULT_VISUAL_DIR,
    token = getToken(),
    fetchImpl = fetch,
}) {
    const targets = visualTargets(model);
    if (!targets.length) {
        return 'Visual: no changed frames to render.\n';
    }
    const maps = await loadImageMaps(
        model.fileKey,
        targets.map((target) => target.id),
        beforeVersion,
        afterVersion,
        token,
        fetchImpl,
    );
    const lines = ['Visual diff', ''];
    for (const target of targets) {
        lines.push(await renderTarget(model.fileKey, outDir, maps, target, fetchImpl));
    }
    return `${lines.join('\n')}\n`;
}
