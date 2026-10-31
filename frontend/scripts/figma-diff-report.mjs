import { nodeDeepLink } from './figma-diff-file-key.mjs';
import { topLevelFrameId } from './figma-diff-normalize.mjs';
import { toIso } from './figma-diff-time.mjs';
import { compareId, jsonValue, stableStringify } from './figma-diff-util.mjs';

function nodeUrl(fileKey, id) {
    return nodeDeepLink(fileKey, id);
}

function formatEntry(fileKey, node) {
    const type = node.type ? ` ${node.type}` : '';
    const name = node.name ?? '(unnamed)';
    const lines = [`- \`${name}\` (\`${node.id}\`)${type}`];
    if (fileKey) {
        lines.push(`  ${nodeUrl(fileKey, node.id)}`);
    }
    return lines;
}

function formatPaths(paths) {
    return paths.map((p) => `  - \`${p.path}\`: ${jsonValue(p.before)} → ${jsonValue(p.after)}`);
}

function emptyMap(m) {
    return !m.added.length && !m.removed.length && !m.changed.length;
}

function pushMapSection(lines, title, map, fileKey) {
    if (emptyMap(map)) {
        return;
    }
    lines.push(`## ${title}`, '');
    if (map.added.length) {
        lines.push('### Added', '');
        for (const item of map.added) {
            lines.push(...formatEntry(fileKey, item), '');
        }
    }
    if (map.removed.length) {
        lines.push('### Removed', '');
        for (const item of map.removed) {
            lines.push(...formatEntry(fileKey, item), '');
        }
    }
    if (map.changed.length) {
        lines.push('### Changed', '');
        for (const item of map.changed) {
            lines.push(`- \`${item.name ?? '(unnamed)'}\` (\`${item.id}\`)`);
            lines.push(...formatPaths(item.paths), '');
        }
    }
}

function groupNodes(diff, afterNodes, beforeNodes) {
    const nodes = { ...beforeNodes, ...afterNodes };

    /** @type {Map<string, { id: string, name: string, frames: Map<string, object> }>} */
    const pages = new Map();

    function pageIdOf(node) {
        if (!node) {
            return '_document';
        }
        if (node.type === 'CANVAS') {
            return node.id;
        }
        if (node.pageId) {
            return node.pageId;
        }
        return '_document';
    }

    function pageBucket(nodeId) {
        const node = nodes[nodeId];
        const id = pageIdOf(node);
        const page = nodes[id];
        if (!pages.has(id)) {
            pages.set(id, {
                id,
                name: page?.type === 'CANVAS' ? (page.name ?? id) : 'Document',
                frames: new Map(),
            });
        }
        return pages.get(id);
    }

    function frameBucket(nodeId) {
        return ensureFrame(pageBucket(nodeId), nodes, nodeId);
    }

    for (const item of diff.added) {
        frameBucket(item.id).added.push(item);
    }
    for (const item of diff.removed) {
        frameBucket(item.id).removed.push(item);
    }
    for (const item of diff.renamed) {
        frameBucket(item.id).renamed.push(item);
    }
    for (const item of diff.moved) {
        frameBucket(item.id).moved.push(item);
    }
    for (const item of diff.changed) {
        frameBucket(item.id).changed.push(item);
    }

    const pageList = [...pages.values()].sort((a, b) => compareId(a.id, b.id));
    return pageList.map((page) => ({
        id: page.id,
        name: page.name,
        frames: [...page.frames.values()].sort((a, b) => compareId(a.id, b.id)),
    }));
}

function canvasFrameId(nodes, node, nodeId) {
    if (node?.type === 'CANVAS') {
        return node.id;
    }
    return topLevelFrameId(nodes, nodeId);
}

function resolveFrameId(nodes, nodeId) {
    const node = nodes[nodeId];
    const frameId = canvasFrameId(nodes, node, nodeId);
    if (!nodes[frameId]) {
        return nodeId;
    }
    return frameId;
}

function emptyFrame(frameId, frame) {
    return {
        id: frameId,
        name: frame?.name ?? frameId,
        type: frame?.type ?? null,
        added: [],
        removed: [],
        renamed: [],
        moved: [],
        changed: [],
    };
}

function ensureFrame(page, nodes, nodeId) {
    const frameId = resolveFrameId(nodes, nodeId);
    if (!page.frames.has(frameId)) {
        page.frames.set(frameId, emptyFrame(frameId, nodes[frameId] ?? nodes[nodeId]));
    }
    return page.frames.get(frameId);
}

function versionMeta(meta) {
    if (!meta) {
        return { id: null, createdAt: null, label: null };
    }
    return {
        createdAt: meta.createdAt ?? meta.created_at ?? meta.lastModified ?? null,
        id: meta.id == null ? null : String(meta.id),
        label: meta.label ?? null,
    };
}

export function buildReportModel({
    fileKey,
    fileName,
    timeZone,
    since,
    sinceInstantMs,
    baseline,
    current,
    before,
    after,
    diff,
    scope = null,
}) {
    const pages = groupNodes(diff, after.nodes ?? {}, before.nodes ?? {});
    return {
        baseline: versionMeta(baseline),
        current: versionMeta(current),
        fileKey,
        fileName: fileName ?? after.fileName ?? before.fileName ?? '',
        pages,
        ...(scope ? { scope } : {}),
        schemaVersion: 1,
        since: since ?? null,
        sinceInstant: sinceInstantMs != null ? toIso(sinceInstantMs) : null,
        summary: {
            added: diff.added.length,
            changed: diff.changed.length,
            moved: diff.moved.length,
            removed: diff.removed.length,
            renamed: diff.renamed.length,
        },
        componentSets: diff.componentSets,
        components: diff.components,
        styles: diff.styles,
        timeZone: timeZone ?? null,
        variableCollections: diff.variableCollections,
        variables: diff.variables,
    };
}

function fileLine(model) {
    const name = model.fileName ? ` (${model.fileName})` : '';
    return `- File: \`${model.fileKey}\`${name}`;
}

function scopeLine(scope) {
    if (!scope) {
        return null;
    }
    const scopeName = scope.name ? ` \`${scope.name}\`` : '';
    return `- Scope: ${scope.kind}${scopeName} (\`${scope.id}\`)`;
}

function sinceLine(model) {
    if (!model.since) {
        return null;
    }
    const instant = model.sinceInstant ? ` → ${model.sinceInstant}` : '';
    const tz = model.timeZone ? `, ${model.timeZone}` : '';
    return `- Since: ${model.since} (end of day${tz}${instant})`;
}

function versionLine(label, meta) {
    const at = meta.createdAt ? ` at ${meta.createdAt}` : '';
    const text = meta.label ? ` "${meta.label}"` : '';
    return `- ${label}: version \`${meta.id ?? 'unknown'}\`${at}${text}`;
}

function pushOptional(lines, line) {
    if (line) {
        lines.push(line);
    }
}

function headerLines(model) {
    const lines = [fileLine(model)];
    pushOptional(lines, scopeLine(model.scope));
    pushOptional(lines, sinceLine(model));
    lines.push(versionLine('Baseline', model.baseline), versionLine('Current', model.current), '');
    return lines;
}

function summaryLines(model) {
    return [
        '## Summary',
        '',
        `- added: ${model.summary.added}`,
        `- removed: ${model.summary.removed}`,
        `- renamed: ${model.summary.renamed}`,
        `- moved: ${model.summary.moved}`,
        `- changed: ${model.summary.changed}`,
        '',
    ];
}

function appendMapSections(lines, model) {
    pushMapSection(lines, 'Components', model.components, model.fileKey);
    pushMapSection(lines, 'Component sets', model.componentSets, model.fileKey);
    pushMapSection(lines, 'Styles', model.styles, null);
    pushMapSection(lines, 'Variables', model.variables, null);
    pushMapSection(lines, 'Variable collections', model.variableCollections, null);
}

function appendNamedList(lines, title, items, pushItem) {
    if (!items.length) {
        return;
    }
    lines.push(title, '');
    for (const item of items) {
        pushItem(lines, item);
        lines.push('');
    }
}

function appendNodeList(lines, title, model, items) {
    appendNamedList(lines, title, items, (buf, item) => {
        buf.push(...formatEntry(model.fileKey, item));
    });
}

function pushRenamed(lines, model, item) {
    lines.push(`- \`${item.before}\` → \`${item.after}\` (\`${item.id}\`)`);
    if (model.fileKey) {
        lines.push(`  ${nodeUrl(model.fileKey, item.id)}`);
    }
}

function parentLabel(side) {
    const name = side.parentName ? ` ${side.parentName}` : '';
    return `${side.parentId ?? 'null'}${name}`;
}

function pushMoved(lines, model, item) {
    lines.push(...formatEntry(model.fileKey, item));
    lines.push(`  - parent: \`${parentLabel(item.from)}\` → \`${parentLabel(item.to)}\``);
}

function pushChanged(lines, model, item) {
    lines.push(`- \`${item.name ?? '(unnamed)'}\` (\`${item.id}\`) ${item.type ?? ''}`.trimEnd());
    if (model.fileKey) {
        lines.push(`  ${nodeUrl(model.fileKey, item.id)}`);
    }
    lines.push(...formatPaths(item.paths));
}

function pushFrameLink(lines, model, id) {
    if (model.fileKey) {
        lines.push(nodeUrl(model.fileKey, id));
    }
}

function appendFrame(lines, model, frame) {
    lines.push(`### Frame: ${frame.name} (\`${frame.id}\`)`);
    pushFrameLink(lines, model, frame.id);
    lines.push('');
    appendNodeList(lines, '#### Added', model, frame.added);
    appendNodeList(lines, '#### Removed', model, frame.removed);
    appendNamedList(lines, '#### Renamed', frame.renamed, (buf, item) => pushRenamed(buf, model, item));
    appendNamedList(lines, '#### Moved', frame.moved, (buf, item) => pushMoved(buf, model, item));
    appendNamedList(lines, '#### Changed', frame.changed, (buf, item) => pushChanged(buf, model, item));
}

function appendPage(lines, model, page) {
    lines.push(`## Page: ${page.name} (\`${page.id}\`)`, '');
    for (const frame of page.frames) {
        appendFrame(lines, model, frame);
    }
}

function appendPages(lines, model) {
    for (const page of model.pages) {
        appendPage(lines, model, page);
    }
}

function trimTrailingBlank(lines) {
    while (lines.length && lines[lines.length - 1] === '') {
        lines.pop();
    }
}

export function renderMarkdown(model) {
    const lines = ['# Figma diff', '', ...headerLines(model), ...summaryLines(model)];
    appendMapSections(lines, model);
    appendPages(lines, model);
    trimTrailingBlank(lines);
    return `${lines.join('\n')}\n`;
}

export function renderJson(model) {
    return stableStringify(model);
}

export function renderReport(model, { json = false } = {}) {
    return json ? renderJson(model) : renderMarkdown(model);
}
