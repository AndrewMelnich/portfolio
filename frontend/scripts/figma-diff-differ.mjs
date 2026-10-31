import { compareId, isPlainObject, isPrimitive, jsonValue } from './figma-diff-util.mjs';

const STRUCTURAL = new Set(['name', 'parentId', 'pageId', 'children']);

function samePrimitiveArray(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function sortedCopy(ids) {
    return [...ids].sort(compareId);
}

function sameIdSet(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const sa = sortedCopy(a);
    const sb = sortedCopy(b);
    for (let i = 0; i < sa.length; i += 1) {
        if (sa[i] !== sb[i]) {
            return false;
        }
    }
    return true;
}

function joinPath(base, key) {
    return base ? `${base}.${key}` : key;
}

function indexPath(base, i) {
    return `${base}[${i}]`;
}

/**
 * @typedef {{ path: string, before: unknown, after: unknown }} ValueDelta
 * @typedef {{ id: string, name: string | null, type: string | null, paths: ValueDelta[] }} NodeChange
 */

function freshList() {
    /** @type {any[]} */
    const items = [];
    return items;
}

function nodeChanges() {
    /** @type {NodeChange[]} */
    const items = [];
    return items;
}

function valuesEqual(before, after) {
    return Object.is(before, after) || jsonValue(before) === jsonValue(after);
}

function pushKeyDiff(before, after, key, next, out) {
    if (!(key in before)) {
        out.push({ path: next, before: undefined, after: after[key] });
        return;
    }
    if (!(key in after)) {
        out.push({ path: next, before: before[key], after: undefined });
        return;
    }
    diffValues(before[key], after[key], next, out);
}

function diffObjects(before, after, path, out) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareId);
    for (const key of keys) {
        pushKeyDiff(before, after, key, joinPath(path, key), out);
    }
}

function pushIndexDiff(before, after, i, path, out) {
    if (i >= before.length) {
        out.push({ path: indexPath(path, i), before: undefined, after: after[i] });
        return;
    }
    if (i >= after.length) {
        out.push({ path: indexPath(path, i), before: before[i], after: undefined });
        return;
    }
    diffValues(before[i], after[i], indexPath(path, i), out);
}

function diffPrimitiveArrays(before, after, path, out) {
    if (!samePrimitiveArray(before, after)) {
        out.push({ path, before, after });
    }
}

function diffArrays(before, after, path, out) {
    const primitive = before.every(isPrimitive) && after.every(isPrimitive);
    if (primitive) {
        diffPrimitiveArrays(before, after, path, out);
        return;
    }
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i += 1) {
        pushIndexDiff(before, after, i, path, out);
    }
}

function diffValues(before, after, path, out) {
    if (valuesEqual(before, after)) {
        return;
    }
    if (isPlainObject(before) && isPlainObject(after)) {
        diffObjects(before, after, path, out);
        return;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
        diffArrays(before, after, path, out);
        return;
    }
    out.push({ path, before, after });
}

function nodeLabel(nodes, id) {
    const n = nodes[id];
    if (!n) {
        return { id, name: null, type: null };
    }
    return { id, name: n.name ?? null, type: n.type ?? null };
}

function mapName(entry) {
    return entry?.name ?? null;
}

function changedMapEntry(id, beforeEntry, afterEntry) {
    const paths = freshList();
    diffValues(beforeEntry, afterEntry, '', paths);
    if (!paths.length) {
        return null;
    }
    return {
        id,
        name: afterEntry.name ?? beforeEntry.name ?? null,
        paths: paths.sort((left, right) => compareId(left.path, right.path)),
    };
}

function pushMapEntry(buckets, id, beforeEntry, afterEntry) {
    if (!beforeEntry) {
        buckets.added.push({ id, name: mapName(afterEntry), after: afterEntry });
        return;
    }
    if (!afterEntry) {
        buckets.removed.push({ id, name: mapName(beforeEntry), before: beforeEntry });
        return;
    }
    const changed = changedMapEntry(id, beforeEntry, afterEntry);
    if (changed) {
        buckets.changed.push(changed);
    }
}

function mapDiff(beforeMap, afterMap) {
    const buckets = { added: freshList(), removed: freshList(), changed: freshList() };
    const ids = [...new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)])].sort(compareId);
    for (const id of ids) {
        pushMapEntry(buckets, id, beforeMap[id], afterMap[id]);
    }
    return buckets;
}

function nodeType(afterNode, beforeNode) {
    return afterNode.type ?? beforeNode.type ?? null;
}

function nodeName(afterNode, beforeNode) {
    return afterNode.name ?? beforeNode.name ?? null;
}

function parentSide(nodes, node) {
    return {
        parentId: node.parentId,
        pageId: node.pageId ?? null,
        parentName: nodes[node.parentId]?.name ?? null,
    };
}

function renameOf(id, beforeNode, afterNode) {
    if (beforeNode.name === afterNode.name) {
        return null;
    }
    return {
        id,
        type: nodeType(afterNode, beforeNode),
        before: beforeNode.name ?? null,
        after: afterNode.name ?? null,
    };
}

function moveOf(id, beforeNode, afterNode, beforeNodes, afterNodes) {
    if (beforeNode.parentId === afterNode.parentId) {
        return null;
    }
    return {
        id,
        type: nodeType(afterNode, beforeNode),
        name: nodeName(afterNode, beforeNode),
        from: parentSide(beforeNodes, beforeNode),
        to: parentSide(afterNodes, afterNode),
    };
}

function pushChildOrder(beforeNode, afterNode, paths) {
    const beforeChildren = beforeNode.children ?? [];
    const afterChildren = afterNode.children ?? [];
    if (sameIdSet(beforeChildren, afterChildren) && !samePrimitiveArray(beforeChildren, afterChildren)) {
        paths.push({ path: 'children', before: beforeChildren, after: afterChildren });
    }
}

function collectKeyDiff(beforeNode, afterNode, key, paths) {
    if (STRUCTURAL.has(key) && key !== 'children') {
        return;
    }
    if (key === 'children') {
        pushChildOrder(beforeNode, afterNode, paths);
        return;
    }
    diffValues(beforeNode[key], afterNode[key], key, paths);
}

function changeOf(id, beforeNode, afterNode) {
    const paths = freshList();
    const keys = [...new Set([...Object.keys(beforeNode), ...Object.keys(afterNode)])].sort(compareId);
    for (const key of keys) {
        collectKeyDiff(beforeNode, afterNode, key, paths);
    }
    if (!paths.length) {
        return null;
    }
    return {
        id,
        name: nodeName(afterNode, beforeNode),
        type: nodeType(afterNode, beforeNode),
        paths: paths.sort((left, right) => compareId(left.path, right.path)),
    };
}

function pushNodeDelta(buckets, id, beforeNodes, afterNodes) {
    const beforeNode = beforeNodes[id];
    const afterNode = afterNodes[id];
    if (!beforeNode) {
        buckets.added.push(nodeLabel(afterNodes, id));
        return;
    }
    if (!afterNode) {
        buckets.removed.push(nodeLabel(beforeNodes, id));
        return;
    }
    const renamed = renameOf(id, beforeNode, afterNode);
    if (renamed) {
        buckets.renamed.push(renamed);
    }
    const moved = moveOf(id, beforeNode, afterNode, beforeNodes, afterNodes);
    if (moved) {
        buckets.moved.push(moved);
    }
    const changed = changeOf(id, beforeNode, afterNode);
    if (changed) {
        buckets.changed.push(changed);
    }
}

function emptyBuckets() {
    return {
        added: freshList(),
        removed: freshList(),
        renamed: freshList(),
        moved: freshList(),
        changed: nodeChanges(),
    };
}

function mapOrEmpty(before, after, key) {
    return mapDiff(before[key] ?? {}, after[key] ?? {});
}

export function diffSnapshots(before, after) {
    const beforeNodes = before.nodes ?? {};
    const afterNodes = after.nodes ?? {};
    const buckets = emptyBuckets();
    const ids = [...new Set([...Object.keys(beforeNodes), ...Object.keys(afterNodes)])].sort(compareId);

    for (const id of ids) {
        pushNodeDelta(buckets, id, beforeNodes, afterNodes);
    }

    return {
        added: buckets.added,
        changed: buckets.changed,
        componentSets: mapOrEmpty(before, after, 'componentSets'),
        components: mapOrEmpty(before, after, 'components'),
        moved: buckets.moved,
        removed: buckets.removed,
        renamed: buckets.renamed,
        styles: mapOrEmpty(before, after, 'styles'),
        variableCollections: mapOrEmpty(before, after, 'variableCollections'),
        variables: mapOrEmpty(before, after, 'variables'),
    };
}
