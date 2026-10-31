/**
 * @typedef {import('./figma-mcp-parse.js').FigmaSnapshot} FigmaSnapshot
 * @typedef {import('./figma-mcp-parse.js').FigmaNode} FigmaNode
 * @typedef {import('./figma-mcp-parse.js').CheckResolveResult} CheckResolveResult
 */

import YAML from 'yaml';

/**
 * @param {string} mcpText
 * @returns {FigmaSnapshot}
 */
export function parseMcpDump(mcpText) {
    const meta = parseFileMeta(mcpText);
    const frameBlocks = splitFrameBlocks(mcpText);
    if (frameBlocks.length === 0) {
        throw new Error('No frames found in MCP dump (missing # frame: headers)');
    }

    /** @type {Record<string, object>} */
    const frames = {};
    for (const block of frameBlocks) {
        const frame = parseFrameBlock(block);
        if (frames[frame.key]) {
            throw new Error(`Duplicate frame key: ${frame.key}`);
        }
        frames[frame.key] = frame.payload;
    }

    const fileName = extractFirstName(mcpText);

    return {
        fileKey: meta.fileKey ?? null,
        fileName,
        fetchedAt: meta.fetchedAt ?? null,
        source: meta.source ?? 'Framelink MCP get_figma_data',
        frames,
    };
}

/**
 * @param {FigmaSnapshot} snapshot
 * @returns {string}
 */
export function snapshotToYaml(snapshot) {
    return YAML.stringify(snapshot, { lineWidth: 120 });
}

/**
 * @param {FigmaSnapshot} snapshot
 * @param {string} fromPath
 * @returns {CheckResolveResult}
 */
export function resolveCheckFrom(snapshot, fromPath) {
    if (typeof fromPath !== 'string' || !fromPath.includes('.')) {
        return { ok: false, reason: 'from must be "<nodeId>.<path>"' };
    }
    const dot = fromPath.indexOf('.');
    const nodeId = fromPath.slice(0, dot);
    const rest = fromPath.slice(dot + 1);
    if (!nodeId || !rest) {
        return { ok: false, reason: 'from must be "<nodeId>.<path>"' };
    }

    for (const [frameKey, frame] of Object.entries(snapshot.frames ?? {})) {
        const node = findNodeById(frame.tree, nodeId);
        if (!node) continue;
        const value = getByPathResolvingLayoutRefs(node, rest, frame.globalVars);
        if (value === undefined) {
            return { ok: false, reason: `path "${rest}" missing on node ${nodeId} in ${frameKey}` };
        }
        return { ok: true, value, frameKey };
    }

    return { ok: false, reason: `node ${nodeId} not found in any frame tree` };
}

/**
 * @param {Record<string, unknown>} checkDoc
 * @param {FigmaSnapshot} snapshot
 * @returns {{ ok: boolean, errors: string[] }}
 */
function pushVersionError(checkDoc, errors) {
    if (checkDoc?.version !== 1) {
        errors.push('version must be 1');
    }
}

function skipBreakpoint(bp, errors) {
    if (bp === 'version' || bp === 'map') {
        return true;
    }

    if (bp !== 'desktopAlt') {
        return false;
    }

    errors.push('desktopAlt in check.yml: SKIP policy — omit unless tokens diverge from desktop');

    return true;
}

function isCheckEntries(entries) {
    return Boolean(entries && typeof entries === 'object');
}

function isCheckEntry(entry) {
    return Boolean(entry && typeof entry === 'object' && !Array.isArray(entry));
}

function pushValueError(bp, key, entry, errors) {
    if (!('value' in entry)) {
        errors.push(`${bp}.${key}: missing value`);
    }
}

function pushFromError(bp, key, entry, snapshot, errors) {
    if (!entry.from) {
        errors.push(`${bp}.${key}: missing from`);

        return;
    }

    const resolved = resolveCheckFrom(snapshot, entry.from);

    if (!resolved.ok) {
        errors.push(`${bp}.${key}: stale from — ${resolved.reason}`);
    }
}

function overrideNeedsReason(entry) {
    return entry.override === true && (!entry.reason || String(entry.reason).trim() === '');
}

function pushOverrideError(bp, key, entry, errors) {
    if (overrideNeedsReason(entry)) {
        errors.push(`${bp}.${key}: override:true requires non-empty reason`);
    }
}

function pushCheckEntry(bp, key, entry, snapshot, errors) {
    if (!isCheckEntry(entry)) {
        errors.push(`${bp}.${key}: expected { value, from, … }`);

        return;
    }

    pushValueError(bp, key, entry, errors);
    pushFromError(bp, key, entry, snapshot, errors);
    pushOverrideError(bp, key, entry, errors);
}

function pushBreakpoint(bp, entries, snapshot, errors) {
    if (skipBreakpoint(bp, errors)) {
        return;
    }

    if (!isCheckEntries(entries)) {
        errors.push(`${bp}: expected object of check keys`);

        return;
    }

    for (const [key, entry] of Object.entries(entries)) {
        pushCheckEntry(bp, key, entry, snapshot, errors);
    }
}

function pushBreakpointErrors(checkDoc, snapshot, errors) {
    for (const [bp, entries] of Object.entries(checkDoc ?? {})) {
        pushBreakpoint(bp, entries, snapshot, errors);
    }
}

export function validateCheckDoc(checkDoc, snapshot) {
    const errors = [];

    pushVersionError(checkDoc, errors);

    if (checkDoc?.map != null) {
        validateHandoffMap(checkDoc.map, snapshot, errors);
    }

    pushBreakpointErrors(checkDoc, snapshot, errors);

    return { ok: errors.length === 0, errors };
}

function mapFrame(snapshot, frameKey, errors) {
    const frame = snapshot?.frames?.[frameKey];

    if (frame?.tree) {
        return frame;
    }

    errors.push(`map.${frameKey}: frame missing in snapshot`);

    return null;
}

function selectorOk(frameKey, selector, errors) {
    if (typeof selector === 'string' && selector.trim()) {
        return true;
    }

    errors.push(`map.${frameKey}: empty selector`);

    return false;
}

function nodeIdLooksValid(nodeId) {
    return typeof nodeId === 'string' && nodeId.includes(':');
}

function pushMapPair(frameKey, selector, nodeId, frame, errors) {
    if (!selectorOk(frameKey, selector, errors)) {
        return;
    }

    if (!nodeIdLooksValid(nodeId)) {
        errors.push(`map.${frameKey}["${selector}"]: nodeId must look like "123:456"`);

        return;
    }

    if (!findNodeById(frame.tree, nodeId)) {
        errors.push(`map.${frameKey}["${selector}"]: node ${nodeId} not in tree`);
    }
}

function pushMapFrame(frameKey, pairs, snapshot, errors) {
    if (!pairs || typeof pairs !== 'object') {
        errors.push(`map.${frameKey}: expected selector→nodeId object`);

        return;
    }

    const frame = mapFrame(snapshot, frameKey, errors);

    if (!frame) {
        return;
    }

    for (const [selector, nodeId] of Object.entries(pairs)) {
        pushMapPair(frameKey, selector, nodeId, frame, errors);
    }
}

function validateHandoffMap(map, snapshot, errors) {
    if (typeof map !== 'object' || Array.isArray(map)) {
        errors.push('map: expected { <frame>: { "<selector>": "<nodeId>" } }');

        return;
    }

    for (const [frameKey, pairs] of Object.entries(map)) {
        pushMapFrame(frameKey, pairs, snapshot, errors);
    }
}

function parseFileMeta(text) {
    const fileKey = matchCommentField(text, 'fileKey');
    const fetchedAt = matchCommentField(text, 'fetchedAt');
    const source = matchCommentField(text, 'source');
    return { fileKey, fetchedAt, source };
}

function matchCommentField(text, field) {
    const re = new RegExp(`^#\\s*${field}:\\s*(.+)$`, 'm');
    const m = text.match(re);
    return m ? m[1].trim() : null;
}

function splitFrameBlocks(text) {
    const re = /^# =+\n# frame: (.+)\n# nodeId: (.+)\n# url: (.+)\n# =+\n/gm;

    /** @type {{ key: string, nodeId: string, url: string, body: string }[]} */
    const blocks = [];
    let match;
    const indices = [];
    while ((match = re.exec(text)) !== null) {
        indices.push({
            index: match.index,
            endHeader: re.lastIndex,
            key: match[1].trim(),
            nodeId: match[2].trim(),
            url: match[3].trim(),
        });
    }
    for (let i = 0; i < indices.length; i++) {
        const start = indices[i].endHeader;
        const end = i + 1 < indices.length ? indices[i + 1].index : text.length;
        blocks.push({
            key: indices[i].key,
            nodeId: indices[i].nodeId,
            url: indices[i].url,
            body: text.slice(start, end),
        });
    }
    return blocks;
}

function parseFrameBlock(block) {
    const globalVars = parseYamlSection(block.body, 'GLOBAL_VARS');
    const elements = parseYamlSection(block.body, 'ELEMENTS');
    const nodesText = extractNodesSection(block.body);
    const tree = parseNodesTree(nodesText);

    const designed = extractDesignedSize(tree?.layout);
    const payload = {
        nodeId: block.nodeId,
        url: block.url,
        name: tree?.name ?? null,
        ...(designed.designedWidth != null ? { designedWidth: designed.designedWidth } : {}),
        ...(designed.designedHeight != null ? { designedHeight: designed.designedHeight } : {}),
        globalVars: globalVars ?? {},
        ...(elements ? { elements } : {}),
        tree,
    };

    return { key: block.key, payload };
}

function parseYamlSection(body, header) {
    const startRe = new RegExp(`^${header}:\\s*$`, 'm');
    const start = body.search(startRe);
    if (start === -1) return null;

    const afterHeader = body.slice(start).split('\n').slice(1);
    const lines = [];
    for (const line of afterHeader) {
        if (/^(GLOBAL_VARS|ELEMENTS|NODES|NAME):\s*$/.test(line)) break;
        if (/^# =+/.test(line)) break;
        lines.push(line);
    }

    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length === 0) return {};
    const yamlText = lines.join('\n');
    return YAML.parse(yamlText);
}

function extractNodesSection(body) {
    const start = body.search(/^NODES:\s*$/m);
    if (start === -1) throw new Error('NODES: section missing in frame block');
    const after = body.slice(start).split('\n').slice(1);
    const lines = [];
    for (const line of after) {
        if (/^# =+/.test(line)) break;
        if (/^(GLOBAL_VARS|ELEMENTS|NAME):\s*$/.test(line)) break;
        lines.push(line);
    }
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.join('\n');
}

/**
 * @param {string} nodesText
 * @returns {FigmaNode | null}
 */
function parseNodesTree(nodesText) {
    const lines = nodesText.split('\n').filter((l) => l.trim() !== '');

    /** @type {{ indent: number, node: object }[]} */
    const stack = [];
    let root = null;

    for (const line of lines) {
        const indent = line.match(/^ */)?.[0].length ?? 0;
        const node = parseNodeLine(line.trim());
        while (stack.length && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        if (stack.length === 0) {
            root = node;
        } else {
            const parent = stack[stack.length - 1].node;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
        }
        stack.push({ indent, node });
    }

    return root;
}

/**
 * @param {string} line
 * @returns {FigmaNode}
 */
export function parseNodeLine(line) {
    const m = line.match(/^\[([A-Z][A-Z0-9_-]*)\]\s+([\s\S]*)$/);
    if (!m) throw new Error(`Bad node line: ${line}`);
    const type = m[1];
    let rest = m[2];

    /** @type {object} */
    const node = { type };

    if (rest.startsWith('"')) {
        const { value, end } = readQuoted(rest, 0);
        node.name = value;
        rest = rest.slice(end).trimStart();
    }

    const idMatch = rest.match(/^#([0-9]+:[0-9]+)\s*(.*)$/);
    if (!idMatch) throw new Error(`Missing node id: ${line}`);
    node.id = idMatch[1];
    rest = idMatch[2];

    const attrs = parseAttrs(rest);
    Object.assign(node, attrs);
    return node;
}

/**
 * @param {string} s
 */
function skipSpaces(str, index) {
    let i = index;

    while (i < str.length && /\s/.test(str[i])) {
        i += 1;
    }

    return i;
}

function assignSpan(str, key, index, attrs, reader) {
    const { value, end } = reader(str, index);

    attrs[key] = value;

    return end;
}

function assignBare(str, key, index, attrs) {
    let end = index;

    while (end < str.length && !/\s/.test(str[end])) {
        end += 1;
    }

    attrs[key] = coerceUnquoted(str.slice(index, end));

    return end;
}

function readAttrValue(str, key, index, attrs) {
    const ch = str[index];

    if (ch === '{' || ch === '[') {
        return assignSpan(str, key, index, attrs, readJson);
    }

    if (ch === '"') {
        return assignSpan(str, key, index, attrs, readQuoted);
    }

    return assignBare(str, key, index, attrs);
}

function readAttr(str, index, attrs) {
    const eq = str.indexOf('=', index);

    if (eq === -1) {
        return null;
    }

    const key = str.slice(index, eq);
    const valueAt = eq + 1;

    if (valueAt >= str.length) {
        attrs[key] = '';

        return null;
    }

    return readAttrValue(str, key, valueAt, attrs);
}

export function parseAttrs(s) {
    /** @type {Record<string, unknown>} */
    const attrs = {};
    let i = 0;
    const str = s.trim();

    while (i < str.length) {
        i = skipSpaces(str, i);

        if (i >= str.length) {
            break;
        }

        const next = readAttr(str, i, attrs);

        if (next == null) {
            break;
        }

        i = next;
    }

    return attrs;
}

function coerceUnquoted(raw) {
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) {
        return Number(raw);
    }
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    return raw;
}

function readQuoted(str, start) {
    let i = start + 1;
    let escape = false;
    while (i < str.length) {
        const c = str[i];
        if (escape) {
            escape = false;
            i++;
            continue;
        }
        if (c === '\\') {
            escape = true;
            i++;
            continue;
        }
        if (c === '"') {
            const slice = str.slice(start, i + 1);
            return { value: JSON.parse(slice), end: i + 1 };
        }
        i++;
    }
    throw new Error(`Unterminated string near: ${str.slice(start, start + 40)}`);
}

function jsonCloser(open) {
    return open === '{' ? '}' : ']';
}

function stepString(char, escape) {
    if (escape) {
        return { inStr: true, escape: false };
    }

    if (char === '\\') {
        return { inStr: true, escape: true };
    }

    if (char === '"') {
        return { inStr: false, escape: false };
    }

    return { inStr: true, escape: false };
}

function closeJson(str, index, start, state) {
    state.depth -= 1;

    if (state.depth !== 0) {
        return null;
    }

    return { value: JSON.parse(str.slice(start, index + 1)), end: index + 1 };
}

function stepJsonToken(str, index, char, open, close, start, state) {
    if (char === '"') {
        state.inStr = true;

        return null;
    }

    if (char === open) {
        state.depth += 1;

        return null;
    }

    if (char !== close) {
        return null;
    }

    return closeJson(str, index, start, state);
}

function stepJson(str, index, open, close, start, state) {
    const char = str[index];

    if (state.inStr) {
        const next = stepString(char, state.escape);

        state.inStr = next.inStr;
        state.escape = next.escape;

        return null;
    }

    return stepJsonToken(str, index, char, open, close, start, state);
}

function readJson(str, start) {
    const open = str[start];
    const close = jsonCloser(open);
    const state = { depth: 0, inStr: false, escape: false };

    for (let i = start; i < str.length; i += 1) {
        const done = stepJson(str, i, open, close, start, state);

        if (done) {
            return done;
        }
    }

    throw new Error(`Unterminated JSON near: ${str.slice(start, start + 40)}`);
}

function extractDesignedSize(layout) {
    if (!layout || typeof layout !== 'object') return {};
    const out = {};
    if (typeof layout.designedWidth === 'string') {
        const n = Number.parseFloat(layout.designedWidth);
        if (!Number.isNaN(n)) out.designedWidth = n;
    } else if (typeof layout.designedWidth === 'number') {
        out.designedWidth = layout.designedWidth;
    }
    if (typeof layout.designedHeight === 'string') {
        const n = Number.parseFloat(layout.designedHeight);
        if (!Number.isNaN(n)) out.designedHeight = n;
    } else if (typeof layout.designedHeight === 'number') {
        out.designedHeight = layout.designedHeight;
    }
    return out;
}

function findNodeById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
}

function getByPath(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[part];
    }
    return cur;
}

function getByPathResolvingLayoutRefs(obj, path, globalVars) {
    const parts = path.split('.');
    let cur = obj;
    for (const part of parts) {
        if (cur == null) return undefined;
        if (part === 'layout' && typeof cur.layout === 'string' && globalVars?.[cur.layout]) {
            cur = globalVars[cur.layout];
            continue;
        }
        if (typeof cur !== 'object') return undefined;
        cur = cur[part];
    }
    return cur;
}

function extractFirstName(text) {
    const m = text.match(/^NAME:\s*(.+)$/m);
    if (!m) return null;
    try {
        return YAML.parse(m[1].trim());
    } catch {
        return m[1].trim().replace(/^"|"$/g, '');
    }
}
