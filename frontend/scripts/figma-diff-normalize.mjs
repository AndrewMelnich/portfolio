import { compareId, isPlainObject, sortDeep } from './figma-diff-util.mjs';

const FILE_DROP = new Set(['thumbnailUrl', 'role', 'editorType', 'linkAccess', 'branches', 'err']);
const NODE_DROP = new Set(['absoluteRenderBounds', 'pluginData', 'sharedPluginData']);
const MAP_DROP = new Set(['thumbnailUrl', 'thumbnail_url']);

const FRAME_LIKE = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION']);

function normalizeValue(value, dropKeys = NODE_DROP) {
    if (typeof value === 'number') {
        return sortDeep(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item, dropKeys));
    }
    if (!isPlainObject(value)) {
        return value;
    }
    const out = {};
    for (const key of Object.keys(value).sort(compareId)) {
        if (dropKeys.has(key) || key === 'children') {
            continue;
        }
        const v = value[key];
        if (v !== undefined) {
            out[key] = normalizeValue(v, dropKeys);
        }
    }
    return out;
}

function normalizeMap(map) {
    if (!map || !isPlainObject(map)) {
        return {};
    }
    const out = {};
    for (const key of Object.keys(map).sort(compareId)) {
        out[key] = normalizeValue(map[key], MAP_DROP);
    }
    return out;
}

function walkNode(node, parentId, pageId, nodes) {
    if (!node || typeof node !== 'object') {
        return;
    }
    const id = node.id;
    if (id == null) {
        return;
    }
    const nextPageId = node.type === 'CANVAS' ? id : pageId;
    const childList = Array.isArray(node.children) ? node.children : [];
    const childIds = childList.map((c) => c.id).filter((cid) => cid != null);
    const rest = normalizeValue(node, NODE_DROP);
    nodes[id] = sortDeep({
        ...rest,
        children: childIds,
        id,
        parentId,
        pageId: nextPageId,
    });
    for (const child of childList) {
        walkNode(child, id, nextPageId, nodes);
    }
}

function descendantIds(nodes, rootId) {
    const out = [];
    const stack = [rootId];
    const seen = new Set();
    while (stack.length) {
        const id = stack.pop();
        if (seen.has(id) || !nodes[id]) {
            continue;
        }
        seen.add(id);
        out.push(id);
        const kids = nodes[id].children ?? [];
        for (let i = kids.length - 1; i >= 0; i -= 1) {
            stack.push(kids[i]);
        }
    }
    return out;
}

function ancestorIds(nodes, id) {
    const out = [];
    let cur = nodes[id];
    const seen = new Set();
    while (cur?.parentId != null && !seen.has(cur.parentId)) {
        seen.add(cur.parentId);
        out.push(cur.parentId);
        cur = nodes[cur.parentId];
    }
    return out;
}

function findCanvases(nodes, page) {
    return Object.values(nodes).filter((node) => node.type === 'CANVAS' && (node.id === page || node.name === page));
}

function addTree(nodes, id, keep) {
    for (const descendantId of descendantIds(nodes, id)) {
        keep.add(descendantId);
    }
    for (const ancestorId of ancestorIds(nodes, id)) {
        keep.add(ancestorId);
    }
}

function keepPage(nodes, page, keep) {
    const canvases = findCanvases(nodes, page);
    if (canvases.length > 1) {
        throw new Error(`Ambiguous page name ${JSON.stringify(page)}; pass the canvas node id`);
    }
    if (canvases.length !== 1) {
        return;
    }
    addTree(nodes, canvases[0].id, keep);
}

function nodeInPage(page, keep, id) {
    if (!page || !keep.size) {
        return true;
    }
    return keep.has(id);
}

function scopeNodeIds(nodes, nodeIds, page, keep) {
    const scoped = new Set();
    for (const raw of nodeIds) {
        const id = String(raw);
        if (!nodes[id] || !nodeInPage(page, keep, id)) {
            continue;
        }
        addTree(nodes, id, scoped);
    }
    return scoped;
}

function mergeScope(keep, scoped, page) {
    if (page) {
        for (const id of [...keep]) {
            if (!scoped.has(id)) {
                keep.delete(id);
            }
        }
    }
    for (const id of scoped) {
        keep.add(id);
    }
}

function pickNodes(nodes, keep) {
    const filteredNodes = {};
    for (const id of [...keep].sort(compareId)) {
        filteredNodes[id] = nodes[id];
    }
    return filteredNodes;
}

function hasNodeIds(nodeIds) {
    return Boolean(nodeIds && nodeIds.length);
}

export function filterSnapshot(snapshot, { page, nodeIds } = {}) {
    if (!page && !hasNodeIds(nodeIds)) {
        return snapshot;
    }
    const { nodes } = snapshot;
    const keep = new Set();
    if (page) {
        keepPage(nodes, page, keep);
    }
    if (hasNodeIds(nodeIds)) {
        mergeScope(keep, scopeNodeIds(nodes, nodeIds, page, keep), page);
    }
    return { ...snapshot, nodes: pickNodes(nodes, keep) };
}

export function topLevelFrameId(nodes, nodeId) {
    let cur = nodes[nodeId];
    let lastFrame = FRAME_LIKE.has(cur?.type) ? cur.id : null;
    const seen = new Set();
    while (cur?.parentId != null && !seen.has(cur.parentId)) {
        seen.add(cur.parentId);
        const parent = nodes[cur.parentId];
        if (!parent) {
            break;
        }
        if (parent.type === 'CANVAS' || parent.type === 'DOCUMENT') {
            break;
        }
        if (FRAME_LIKE.has(parent.type)) {
            lastFrame = parent.id;
        }
        cur = parent;
    }
    return lastFrame ?? nodeId;
}

function alreadyNormalized(raw) {
    return raw?.schemaVersion === 1 && raw.nodes && typeof raw.nodes === 'object';
}

function withFileKey(raw, fileKey) {
    return sortDeep({
        ...raw,
        fileKey: fileKey ?? raw.fileKey ?? null,
    });
}

function readNodes(raw) {
    const nodes = {};
    if (raw?.document) {
        walkNode(raw.document, null, null, nodes);
    }
    return nodes;
}

function readVariables(raw) {
    if (raw?.variables && !raw.variables.document) {
        return normalizeMap(raw.variables);
    }
    return {};
}

function mapField(raw, key) {
    return normalizeMap(raw?.[key]);
}

function textOr(raw, key, fallback) {
    const value = raw?.[key];
    return value ?? fallback;
}

function versionIdOf(raw) {
    if (raw?.version == null) {
        return null;
    }
    return String(raw.version);
}

function normalizedBody(raw, fileKey) {
    return {
        components: mapField(raw, 'components'),
        componentSets: mapField(raw, 'componentSets'),
        fileKey,
        fileName: textOr(raw, 'name', ''),
        lastModified: textOr(raw, 'lastModified', null),
        nodes: readNodes(raw),
        schemaVersion: 1,
        styles: mapField(raw, 'styles'),
        variableCollections: mapField(raw, 'variableCollections'),
        variables: readVariables(raw),
        versionId: versionIdOf(raw),
    };
}

/**
 * @param {object} raw
 * @param {{ fileKey?: string | null }} [opts]
 */
export function normalizeFile(raw, { fileKey = null } = {}) {
    if (alreadyNormalized(raw)) {
        return withFileKey(raw, fileKey);
    }
    return sortDeep(normalizedBody(raw, fileKey));
}
