import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    attachVariables,
    cacheScope,
    fetchAllVersions,
    fetchFile,
    fetchVariables,
    getToken,
    pickVersionOrThrow,
    readCache,
    writeCache,
} from './figma-diff-api.mjs';
import { diffSnapshots } from './figma-diff-differ.mjs';
import { resolveFileKey } from './figma-diff-file-key.mjs';
import { filterSnapshot, normalizeFile } from './figma-diff-normalize.mjs';
import { buildReportModel, renderReport } from './figma-diff-report.mjs';
import { parseInstant, toIso } from './figma-diff-time.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CACHE_DIR = path.join(REPO_ROOT, '.figma-diff-cache');

function readAgentsTexts() {
    const texts = [];
    for (const rel of ['AGENTS.md', 'frontend/AGENTS.md']) {
        const p = path.join(REPO_ROOT, rel);
        if (fs.existsSync(p)) {
            texts.push(fs.readFileSync(p, 'utf8'));
        }
    }
    return texts;
}

function readJsonFile(file) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
        throw new Error(`File not found: ${abs}`);
    }
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function snapshotMeta(raw, versionRow) {
    if (versionRow) {
        return {
            createdAt: versionRow.created_at ?? raw.lastModified ?? null,
            id: String(versionRow.id),
            label: versionRow.label ?? null,
            lastModified: raw.lastModified ?? null,
        };
    }
    return {
        createdAt: raw.lastModified ?? null,
        id: raw.version == null ? null : String(raw.version),
        label: null,
        lastModified: raw.lastModified ?? null,
    };
}

async function tryVariables(fileKey, raw, opts) {
    if (opts.noVariables) {
        return raw;
    }
    try {
        const payload = await fetchVariables(fileKey, opts);
        return attachVariables(raw, payload);
    } catch (err) {
        if (err.status === 400 || err.status === 403 || err.status === 404) {
            return raw;
        }
        throw err;
    }
}

async function fetchFileScoped(fileKey, opts) {
    try {
        return await fetchFile(fileKey, opts);
    } catch (err) {
        if (!opts.ids?.length || (err.status !== 400 && err.status !== 404)) {
            throw err;
        }
        return fetchFile(fileKey, { ...opts, ids: undefined });
    }
}

async function loadVersionedFile(fileKey, versionRow, opts) {
    const versionId = String(versionRow.id);
    const scope = cacheScope(opts.ids);
    if (opts.cacheDir) {
        const hit = readCache(opts.cacheDir, fileKey, versionId, scope);
        if (hit) {
            return hit;
        }
    }
    const raw = await fetchFileScoped(fileKey, { ...opts, version: versionId });
    const withVars = await tryVariables(fileKey, raw, { ...opts, version: versionId });
    if (opts.cacheDir) {
        writeCache(opts.cacheDir, fileKey, versionId, withVars, scope);
    }
    return withVars;
}

async function loadLiveFile(fileKey, opts) {
    const raw = await fetchFileScoped(fileKey, { ...opts, version: undefined });
    return tryVariables(fileKey, raw, { ...opts, version: undefined });
}

const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'GROUP']);

function nodeAt(snapshot, nodeId) {
    return snapshot.nodes?.[nodeId];
}

function scopeKind(type) {
    if (type === 'CANVAS') {
        return 'page';
    }
    if (type && FRAME_TYPES.has(type)) {
        return 'frame';
    }
    return 'node';
}

function linkScope(nodeId, before, after) {
    const node = nodeAt(after, nodeId) ?? nodeAt(before, nodeId);
    const type = node?.type ?? null;
    return {
        id: nodeId,
        kind: scopeKind(type),
        name: node?.name ?? null,
        type,
    };
}

function prepare(raw, fileKey, scope) {
    return filterSnapshot(normalizeFile(raw, { fileKey }), scope);
}

function assertLinkFileKey(args) {
    const linkKey = args.link?.fileKey;
    if (linkKey && args.fileKey && linkKey !== args.fileKey) {
        throw new Error(`--file-key ${args.fileKey} does not match the link file ${linkKey}`);
    }
}

function flagFileKey(args) {
    return args.link?.fileKey || args.fileKey;
}

function scopedNodeIds(args) {
    const nodeIds = [...(args.nodeIds ?? [])];
    const linkId = args.link?.nodeId;
    if (linkId && !nodeIds.includes(linkId)) {
        nodeIds.push(linkId);
    }
    return nodeIds;
}

function instantOrNull(value, timeZone, flag) {
    if (!value) {
        return null;
    }
    return parseInstant(value, timeZone, flag);
}

function loadFixtures(args) {
    const beforeRaw = readJsonFile(args.before);
    const afterRaw = readJsonFile(args.after);
    return {
        afterRaw,
        baselineMeta: snapshotMeta(beforeRaw),
        beforeRaw,
        currentMeta: snapshotMeta(afterRaw),
    };
}

function apiOptions(args, fetchImpl, token, nodeIds) {
    return {
        cacheDir: args.cacheDir ?? DEFAULT_CACHE_DIR,
        fetchImpl,
        geometry: args.geometry === 'paths' ? 'paths' : 'off',
        ids: nodeIds.length ? nodeIds : undefined,
        noVariables: args.noVariables,
        token,
    };
}

async function loadUntilRaw(fileKey, api, versions, sinceInfo, untilInfo, fetchImpl, token, timeZone) {
    const untilVersions =
        untilInfo.instantMs === sinceInfo.instantMs
            ? versions
            : await fetchAllVersions(fileKey, { fetchImpl, token, untilMs: untilInfo.instantMs });
    const untilRow = pickVersionOrThrow(untilVersions, untilInfo.instantMs, toIso(untilInfo.instantMs), timeZone);
    const raw = await loadVersionedFile(fileKey, untilRow, api);
    return { meta: snapshotMeta(raw, untilRow), raw };
}

async function loadAfterRaw(fileKey, api, versions, sinceInfo, untilInfo, fetchImpl, token, timeZone) {
    if (!untilInfo) {
        const raw = await loadLiveFile(fileKey, api);
        return { meta: snapshotMeta(raw), raw };
    }
    return loadUntilRaw(fileKey, api, versions, sinceInfo, untilInfo, fetchImpl, token, timeZone);
}

async function loadFromApi(fileKey, args, env, fetchImpl, nodeIds, sinceInfo, untilInfo) {
    const token = getToken(env);
    const api = apiOptions(args, fetchImpl, token, nodeIds);
    const versions = await fetchAllVersions(fileKey, { fetchImpl, token, untilMs: sinceInfo.instantMs });
    const baselineRow = pickVersionOrThrow(versions, sinceInfo.instantMs, toIso(sinceInfo.instantMs), args.timeZone);
    const beforeRaw = await loadVersionedFile(fileKey, baselineRow, api);
    const after = await loadAfterRaw(fileKey, api, versions, sinceInfo, untilInfo, fetchImpl, token, args.timeZone);
    return {
        afterRaw: after.raw,
        baselineMeta: snapshotMeta(beforeRaw, baselineRow),
        beforeRaw,
        currentMeta: after.meta,
    };
}

async function loadInputs(args, fileKey, env, fetchImpl, nodeIds, sinceInfo, untilInfo) {
    if (args.fixtureMode) {
        return loadFixtures(args);
    }
    return loadFromApi(fileKey, args, env, fetchImpl, nodeIds, sinceInfo, untilInfo);
}

function assertLinkedNode(nodeId, before, after) {
    if (!nodeId) {
        return;
    }
    if (!before.nodes[nodeId] && !after.nodes[nodeId]) {
        throw new Error(
            `Node ${nodeId} is not in the file at --since or in the current file. Pass a frame or page link.`,
        );
    }
}

function reportScope(args, before, after) {
    const nodeId = args.link?.nodeId;
    if (!nodeId) {
        return null;
    }
    return linkScope(nodeId, before, after);
}

function sinceLabel(sinceInfo) {
    return sinceInfo?.label ?? null;
}

function sinceMs(sinceInfo) {
    return sinceInfo?.instantMs ?? null;
}

function finishDiff(args, fileKey, sinceInfo, loaded) {
    const scope = { nodeIds: loaded.nodeIds, page: args.page };
    const before = prepare(loaded.beforeRaw, fileKey, scope);
    const after = prepare(loaded.afterRaw, fileKey, scope);
    assertLinkedNode(args.link?.nodeId, before, after);
    const diff = diffSnapshots(before, after);
    const model = buildReportModel({
        after,
        baseline: loaded.baselineMeta,
        before,
        current: loaded.currentMeta,
        diff,
        fileKey,
        fileName: after.fileName || before.fileName,
        scope: reportScope(args, before, after),
        since: sinceLabel(sinceInfo),
        sinceInstantMs: sinceMs(sinceInfo),
        timeZone: args.timeZone,
    });
    return {
        after,
        before,
        diff,
        model,
        output: renderReport(model, { json: args.json }),
    };
}

export async function runDiff(args, deps = {}) {
    assertLinkFileKey(args);
    const env = deps.env ?? process.env;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const fileKey = resolveFileKey({
        agentsTexts: deps.agentsTexts ?? readAgentsTexts(),
        env,
        flag: flagFileKey(args),
    });
    const sinceInfo = instantOrNull(args.since, args.timeZone, '--since');
    const untilInfo = instantOrNull(args.until, args.timeZone, '--until');
    const nodeIds = scopedNodeIds(args);
    const loaded = await loadInputs(args, fileKey, env, fetchImpl, nodeIds, sinceInfo, untilInfo);
    return finishDiff(args, fileKey, sinceInfo, { ...loaded, nodeIds });
}
