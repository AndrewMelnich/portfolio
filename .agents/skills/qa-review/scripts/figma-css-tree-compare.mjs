const TOL_PX = 4;
const TOL_OPACITY = 0.02;
const TOL_EM = 0.02;

/**
 * @param {object} opts
 * @param {object} opts.snapshot
 * @param {object} opts.check
 * @param {object} opts.cssTree
 * @param {string} [opts.frame]
 * @param {number} [opts.desktopMinWidth] narrowest viewport that still gets desktop CSS (no breakpoint mixin)
 */
export function compareCssTreeToCheck({ snapshot, check, cssTree, frame, desktopMinWidth }) {
    const frameKey = frame ?? cssTree.frame ?? 'desktop';
    const entries = check?.[frameKey] ?? {};
    const map = check?.map?.[frameKey] ?? {};
    const root = cssTree.tree;
    const warnings = [];

    if (
        frameKey === 'desktop' &&
        typeof desktopMinWidth === 'number' &&
        typeof cssTree.viewportWidth === 'number' &&
        cssTree.viewportWidth < desktopMinWidth
    ) {
        warnings.push(
            `Viewport ${cssTree.viewportWidth}px < ${desktopMinWidth} — a narrower breakpoint mixin is active. Desktop check tokens may false-FAIL. Re-dump with --width ≥ ${desktopMinWidth} (or compare the matching frame).`,
        );
    }

    /** @type {CompareRow[]} */
    const rows = [];

    for (const [key, entry] of Object.entries(entries)) {
        if (!entry || typeof entry !== 'object') continue;

        const from = entry.from;
        const checkValue = entry.value;
        const resolved = from ? resolveCheckFrom(snapshot, from) : { ok: false, reason: 'missing from' };
        const figmaValue = resolved.ok ? resolved.value : `STALE: ${resolved.reason}`;

        if (entry.compare === 'skip' || entry.live === false) {
            rows.push({
                key,
                selector: typeof entry.selector === 'string' ? entry.selector : '—',
                checkValue,
                from: from ?? '—',
                figmaValue,
                liveValue: null,
                liveSource: '—',
                delta: '',
                verdict: 'SKIP',
                note: entry.reason ? String(entry.reason) : 'compare: skip (not 1:1 with css-tree host)',
            });
            continue;
        }

        const sel = resolveSelector({ from, map, explicit: entry.selector });

        if (!sel.ok) {
            rows.push({
                key,
                selector: '—',
                checkValue,
                from: from ?? '—',
                figmaValue,
                liveValue: null,
                liveSource: '—',
                delta: '',
                verdict: 'SKIP',
                note: sel.reason,
            });
            continue;
        }

        const liveNode = findByClass(root, sel.selector);

        if (!liveNode) {
            rows.push({
                key,
                selector: sel.selector,
                checkValue,
                from: from ?? '—',
                figmaValue,
                liveValue: null,
                liveSource: '—',
                delta: '',
                verdict: 'SKIP',
                note: `selector ${sel.selector} not in css-tree`,
            });
            continue;
        }

        const fontSpec =
            key.toLowerCase().includes('font') && resolved.ok && typeof figmaValue === 'string'
                ? lookupTextStyle(snapshot, resolved.frameKey ?? frameKey, figmaValue)
                : null;

        const liveRead = readLiveValue(key, liveNode, root, checkValue, { fontSpec });
        const verdict = judge(key, checkValue, figmaValue, liveRead);

        rows.push({
            key,
            selector: sel.selector,
            checkValue,
            from: from ?? '—',
            figmaValue: fontSpec ? formatFontSpec(fontSpec, figmaValue) : figmaValue,
            liveValue: liveRead.value,
            liveSource: liveRead.source,
            delta: liveRead.delta ?? '',
            verdict,
            note: liveRead.note ?? '',
        });
    }

    const unmapped = rows.filter((r) => r.note?.startsWith('unmapped nodeId'));

    if (unmapped.length) {
        warnings.push(
            `${unmapped.length} check key(s) unmapped — add map.<frame>[".bem"] = nodeId (or entry.selector). No keyword guessing.`,
        );
    }

    const counts = {
        PASS: rows.filter((r) => r.verdict === 'PASS').length,
        FAIL: rows.filter((r) => r.verdict === 'FAIL').length,
        SKIP: rows.filter((r) => r.verdict === 'SKIP').length,
        INFO: rows.filter((r) => r.verdict === 'INFO').length,
    };

    const verdict = counts.FAIL > 0 ? 'FAIL' : 'PASS';
    const sortedRows = [...rows].sort(compareVerdictImportance);

    return {
        frame: frameKey,
        verdict,
        counts,
        warnings,
        rows: sortedRows,
        map,
        meta: {
            url: cssTree.url ?? null,
            selector: cssTree.selector ?? null,
            viewportWidth: cssTree.viewportWidth ?? null,
            designedWidth: cssTree.designedWidth ?? null,
            fetchedAt: cssTree.fetchedAt ?? null,
        },
    };
}

/**
 * @typedef {{ key: string, selector: string, checkValue: unknown, from: string, figmaValue: unknown, liveValue: unknown, liveSource: string, delta: string, verdict: string, note: string }} CompareRow
 */

/**
 * @returns {{ ok: true, selector: string } | { ok: false, reason: string }}
 */
export function resolveSelector({ from, map, explicit }) {
    if (typeof explicit === 'string' && explicit.trim()) {
        return { ok: true, selector: explicit.trim() };
    }

    const nodeId = nodeIdFromFrom(from);

    if (!nodeId) {
        return { ok: false, reason: 'missing from nodeId' };
    }

    for (const [selector, id] of Object.entries(map ?? {})) {
        if (String(id) === nodeId) {
            return { ok: true, selector };
        }
    }

    return {
        ok: false,
        reason: `unmapped nodeId ${nodeId} — add map entry or entry.selector`,
    };
}

function nodeIdFromFrom(from) {
    if (typeof from !== 'string' || !from.includes('.')) return null;
    const id = from.slice(0, from.indexOf('.'));

    return /^\d+:\d+$/.test(id) ? id : null;
}

function findByClass(node, selector) {
    if (!node) return null;
    const name = String(selector).replace(/^\./, '');
    if ((node.classes || []).includes(name)) return node;

    for (const child of node.children || []) {
        const found = findByClass(child, selector);
        if (found) return found;
    }

    return null;
}

function readLiveValue(key, node, root, checkValue, ctx = {}) {
    const k = key.toLowerCase();

    if (!node && !root) {
        return { value: null, source: 'missing', note: 'no live node' };
    }

    const el = node || root;

    if (k.includes('font')) {
        return readLiveFont(el, ctx.fontSpec);
    }

    if (k.includes('locationtointro')) {
        const mb = el.styles?.['margin-bottom'];

        return { value: mb, source: 'styles.margin-bottom', delta: deltaPx(checkValue, mb) };
    }

    if (k.includes('rowgap') || k.endsWith('rowgap')) {
        const gap = el.styles?.['row-gap'] ?? el.styles?.gap;

        return { value: gap, source: 'styles.row-gap', delta: deltaPx(checkValue, gap) };
    }

    if (k.endsWith('gap') || k.includes('gutter')) {
        const gap = el.styles?.gap ?? el.styles?.['column-gap'] ?? el.styles?.['row-gap'];

        if (gap && gap !== 'normal') {
            return { value: gap, source: 'styles.gap', delta: deltaPx(checkValue, gap) };
        }

        return {
            value: null,
            source: 'geometry',
            note: 'gap/gutter not in computed styles — SKIP (use box math manually)',
            delta: '',
        };
    }

    if (k.includes('padding')) {
        const pad = `${el.styles?.['padding-top'] ?? ''} ${el.styles?.['padding-right'] ?? ''}`.trim();
        return { value: pad, source: 'styles.padding', delta: '' };
    }

    if (k.includes('opacity')) {
        return readLiveOpacity(el, checkValue);
    }

    if (k.includes('texttransform') || k === 'csstexttransform') {
        return {
            value: el.styles?.['text-transform'],
            source: 'styles.text-transform',
            delta: '',
        };
    }

    if (k.includes('maxwidth') || k === 'intromaxwidth') {
        const v = el.styles?.['max-width'];
        return { value: v, source: 'styles.max-width', delta: deltaPx(checkValue, v) };
    }

    if (k.includes('width') && !k.includes('section')) {
        const v = el.box?.width ?? el.styles?.width;
        return { value: v, source: 'box.width', delta: deltaPx(checkValue, v) };
    }

    if (k.includes('height') && !k.includes('section')) {
        const v = el.box?.height ?? el.styles?.height;
        return { value: v, source: 'box.height', delta: deltaPx(checkValue, v) };
    }

    if (k === 'sectionsize') {
        return {
            value: `${Math.round(root.box?.width ?? 0)}×${Math.round(root.box?.height ?? 0)}`,
            source: 'root.box',
            note: 'computed box vs artboard — INFO',
            delta: '',
        };
    }

    if (k.includes('gutter') || k.includes('photostocontent')) {
        const gap = root.styles?.['column-gap'] ?? root.styles?.gap;
        if (gap && gap !== 'normal') {
            return { value: gap, source: 'root.column-gap', delta: deltaPx(checkValue, gap) };
        }
        return {
            value: null,
            source: 'geometry',
            note: 'no column-gap; SKIP box math without paired nodes',
            delta: '',
        };
    }

    if (k.endsWith('x') || k.endsWith('y') || k.includes('fill')) {
        return {
            value: null,
            source: '—',
            note: 'geometry/type token — SKIP in auto live reader',
            delta: '',
        };
    }

    return {
        value: null,
        source: '—',
        note: 'no live reader for key',
        delta: '',
    };
}

function judge(key, checkValue, figmaValue, liveRead) {
    if (liveRead.note?.includes('SKIP') || liveRead.value == null) {
        if (key.toLowerCase() === 'sectionsize') return 'INFO';
        if (liveRead.note?.includes('INFO')) return 'INFO';
        if (liveRead.value == null) return 'SKIP';
    }

    const k = key.toLowerCase();

    if (k === 'sectionsize') return 'INFO';

    if (k.includes('opacity')) {
        const a = toNum(checkValue);
        const b = toNum(liveRead.value);

        if (a != null && b != null) {
            return Math.abs(a - b) <= TOL_OPACITY ? 'PASS' : 'FAIL';
        }

        return liveRead.value == null ? 'SKIP' : 'FAIL';
    }

    if (k.includes('font')) {
        if (liveRead.note?.includes('SKIP') || liveRead.value == null) return 'SKIP';
        if (liveRead.mismatches?.length) return 'FAIL';
        return 'PASS';
    }

    if (k.includes('padding') || k.includes('texttransform')) {
        return normalizeStr(checkValue) === normalizeStr(liveRead.value) ||
            String(liveRead.value).toLowerCase().includes(String(checkValue).toLowerCase().split(' ')[0])
            ? 'PASS'
            : 'FAIL';
    }

    const a = toNum(checkValue);
    const b = toNum(liveRead.value);
    if (a != null && b != null) {
        return Math.abs(a - b) <= TOL_PX ? 'PASS' : 'FAIL';
    }

    if (normalizeStr(checkValue) === normalizeStr(liveRead.value)) return 'PASS';

    if (a != null && normalizeStr(liveRead.value).startsWith(String(a))) return 'PASS';

    return liveRead.value == null ? 'SKIP' : 'FAIL';
}

/**
 * @param {object} snapshot
 * @param {string} frameKey
 * @param {string} styleName
 * @returns {object | null}
 */
export function lookupTextStyle(snapshot, frameKey, styleName) {
    if (!styleName || typeof styleName !== 'string') return null;
    const direct = snapshot?.frames?.[frameKey]?.globalVars?.[styleName];
    if (direct && typeof direct === 'object' && direct.fontSize != null) return direct;

    for (const frame of Object.values(snapshot?.frames ?? {})) {
        const gv = frame?.globalVars?.[styleName];
        if (gv && typeof gv === 'object' && gv.fontSize != null) return gv;
    }

    return null;
}

export function formatFontSpec(spec, styleName) {
    const size = spec.fontSize;
    const lh = spec.lineHeight ?? '—';
    const ls = spec.letterSpacing ?? '—';
    const w = spec.fontWeight ?? '—';
    return `${styleName} ${w} ${size}/${lh}/${ls}`;
}

/**
 * @param {object} el
 * @param {object | null | undefined} fontSpec
 */
export function readLiveFont(el, fontSpec) {
    if (!fontSpec) {
        return {
            value: null,
            source: 'globalVars textStyle',
            note: 'SKIP — textStyle not found in snapshot globalVars',
            delta: '',
            mismatches: [],
        };
    }

    const liveSize = toNum(el.styles?.['font-size']);
    const liveWeight = toNum(el.styles?.['font-weight']);
    const liveLhPx = toNum(el.styles?.['line-height']);
    const liveLsPx = toNum(el.styles?.['letter-spacing']);
    const liveFamily = String(el.styles?.['font-family'] ?? '');

    if (liveSize == null) {
        return {
            value: null,
            source: 'styles.font-*',
            note: 'SKIP — no live font-size (re-dump with font props)',
            delta: '',
            mismatches: [],
        };
    }

    const expectedSize = toNum(fontSpec.fontSize);
    const expectedWeight = toNum(fontSpec.fontWeight);
    const expectedLhEm = parseEm(fontSpec.lineHeight);
    const expectedLsEm = parseEm(fontSpec.letterSpacing);
    const expectedFamily = String(fontSpec.fontFamily ?? '');

    const liveLhEm = liveLhPx != null && liveSize ? liveLhPx / liveSize : null;
    const liveLsEm = liveLsPx != null && liveSize ? liveLsPx / liveSize : null;

    /** @type {string[]} */
    const mismatches = [];

    if (expectedSize != null && Math.abs(liveSize - expectedSize) > TOL_PX) {
        mismatches.push(`fontSize ${liveSize}≠${expectedSize}`);
    }

    if (expectedWeight != null && liveWeight != null && liveWeight !== expectedWeight) {
        mismatches.push(`weight ${liveWeight}≠${expectedWeight}`);
    }

    if (expectedLhEm != null && liveLhEm != null && Math.abs(liveLhEm - expectedLhEm) > TOL_EM) {
        mismatches.push(`lh ${round3(liveLhEm)}≠${expectedLhEm}`);
    }

    if (expectedLsEm != null && liveLsEm != null && Math.abs(liveLsEm - expectedLsEm) > TOL_EM) {
        mismatches.push(`ls ${round3(liveLsEm)}≠${expectedLsEm}`);
    }

    if (expectedFamily && liveFamily) {
        const want = expectedFamily.toLowerCase();
        const got = liveFamily.toLowerCase().replace(/["']/g, '');
        if (!got.includes(want)) {
            mismatches.push(`family !${expectedFamily}`);
        }
    }

    const liveSummary = `${liveSize}px/${liveLhEm != null ? round3(liveLhEm) : '—'}em/${liveLsEm != null ? round3(liveLsEm) : '—'}em/${liveWeight ?? '—'}`;

    return {
        value: liveSummary,
        source: 'styles.font-* vs globalVars',
        delta: mismatches.length ? mismatches.join('; ') : '0',
        note: mismatches.length ? mismatches.join('; ') : '',
        mismatches,
    };
}

function parseEm(v) {
    if (v == null) return null;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const s = String(v).trim().toLowerCase();
    if (s.endsWith('em')) {
        const n = Number.parseFloat(s);
        return Number.isNaN(n) ? null : n;
    }
    const n = Number.parseFloat(s);
    return Number.isNaN(n) ? null : n;
}

function round3(n) {
    return Math.round(n * 1000) / 1000;
}

/**
 * @param {object} el
 * @param {unknown} checkValue
 */
export function readLiveOpacity(el, checkValue) {
    const styleOp = toNum(el.styles?.opacity);
    const colorAlpha = alphaFromCssColor(el.styles?.color);

    if (colorAlpha != null && colorAlpha < 1) {
        return {
            value: colorAlpha,
            source: 'styles.color alpha',
            delta: deltaOpacity(checkValue, colorAlpha),
        };
    }

    if (styleOp != null) {
        return {
            value: styleOp,
            source: 'styles.opacity',
            delta: deltaOpacity(checkValue, styleOp),
        };
    }

    if (colorAlpha != null) {
        return {
            value: colorAlpha,
            source: 'styles.color alpha',
            delta: deltaOpacity(checkValue, colorAlpha),
        };
    }

    return { value: null, source: 'styles.opacity|color', note: 'no opacity/color', delta: '' };
}

/**
 * @param {unknown} color
 * @returns {number | null}
 */
export function alphaFromCssColor(color) {
    if (color == null) return null;
    const s = String(color).trim().toLowerCase();

    if (!s || s === 'transparent') return s === 'transparent' ? 0 : null;

    const slash = s.match(/^(?:rgba?|hsla?)\(\s*[^/]+\/\s*([\d.]+%?)\s*\)$/);
    if (slash) return parseAlphaToken(slash[1]);

    const comma = s.match(/^(?:rgba|hsla)\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*([\d.]+%?)\s*\)$/);
    if (comma) return parseAlphaToken(comma[1]);

    if (/^(?:rgb|hsl)\(/.test(s)) return 1;

    return null;
}

function parseAlphaToken(raw) {
    if (raw.endsWith('%')) {
        const n = Number.parseFloat(raw);

        return Number.isNaN(n) ? null : n / 100;
    }

    const n = Number.parseFloat(raw);

    return Number.isNaN(n) ? null : n;
}

function toNum(v) {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (v == null) return null;
    const m = String(v).match(/-?[\d.]+/);
    return m ? Number(m[0]) : null;
}

function deltaOpacity(checkValue, liveValue) {
    const a = toNum(checkValue);
    const b = toNum(liveValue);
    if (a == null || b == null) return '';
    const d = Math.round((b - a) * 1000) / 1000;
    return d === 0 ? '0' : d > 0 ? `+${d}` : `${d}`;
}

function deltaPx(checkValue, liveValue) {
    const a = toNum(checkValue);
    const b = toNum(liveValue);
    if (a == null || b == null) return '';
    const d = Math.round((b - a) * 100) / 100;
    return d === 0 ? '0' : d > 0 ? `+${d}` : `${d}`;
}

function normalizeStr(v) {
    return String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * @param {object} snapshot
 * @param {string} fromPath
 * @returns {{ ok: true, value: unknown, frameKey: string } | { ok: false, reason: string }}
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

function findNodeById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
        const found = findNodeById(child, id);
        if (found) return found;
    }
    return null;
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

const VERDICT_RANK = { FAIL: 0, INFO: 1, SKIP: 2, PASS: 3 };

function compareVerdictImportance(a, b) {
    const ra = VERDICT_RANK[a.verdict] ?? 99;
    const rb = VERDICT_RANK[b.verdict] ?? 99;

    if (ra !== rb) return ra - rb;

    return String(a.key).localeCompare(String(b.key));
}
