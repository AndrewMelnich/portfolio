import { resolveCheckFrom } from './figma-mcp-parse.mjs';

const TOL_PX = 4;

const TOL_OPACITY = 0.02;

const TOL_EM = 0.02;

/**
 * @typedef {{ key: string, selector: string, checkValue: unknown, from: string, figmaValue: unknown, liveValue: unknown, liveSource: string, delta: string, verdict: string, note: string }} CompareRow
 */

/**
 * @param {object} opts
 * @param {object} opts.snapshot
 * @param {object} opts.check
 * @param {object} opts.cssTree
 * @param {string} [opts.frame]
 */
function checkContext({ snapshot, check, cssTree, frame }) {
    const frameKey = frame ?? cssTree.frame ?? 'desktop';

    return {
        snapshot,
        cssTree,
        frameKey,
        entries: check?.[frameKey] ?? {},
        map: check?.map?.[frameKey] ?? {},
        root: cssTree.tree,
    };
}

function desktopViewportWarning(frameKey, cssTree) {
    if (frameKey !== 'desktop') {
        return null;
    }

    if (typeof cssTree.viewportWidth !== 'number' || cssTree.viewportWidth > 1199) {
        return null;
    }

    return `Viewport ${cssTree.viewportWidth}px ≤ 1199 — project @include tablet is active. Desktop check tokens may false-FAIL. Re-dump with --width ≥ 1200 (or compare check.tablet).`;
}

function rowBase(key, entry, figmaValue) {
    return {
        key,
        checkValue: entry.value,
        from: entry.from ?? '—',
        figmaValue,
        liveValue: null,
        liveSource: '—',
        delta: '',
    };
}

function skipRow(base, selector, note) {
    return { ...base, selector, verdict: 'SKIP', note };
}

function explicitSelector(entry) {
    return typeof entry.selector === 'string' ? entry.selector : '—';
}

function figmaValueOf(snapshot, from) {
    if (!from) {
        return { ok: false, reason: 'missing from', value: 'STALE: missing from' };
    }

    const resolved = resolveCheckFrom(snapshot, from);

    if (!resolved.ok) {
        return { ...resolved, value: `STALE: ${resolved.reason}` };
    }

    return { ...resolved, value: resolved.value };
}

function skippedEntry(entry) {
    return entry.compare === 'skip' || entry.live === false;
}

function skipNote(entry) {
    return entry.reason ? String(entry.reason) : 'compare: skip (not 1:1 with css-tree host)';
}

function fontSpecFor(key, resolved, ctx) {
    if (!key.toLowerCase().includes('font') || !resolved.ok || typeof resolved.value !== 'string') {
        return null;
    }

    return lookupTextStyle(ctx.snapshot, resolved.frameKey ?? ctx.frameKey, resolved.value);
}

function measuredRow(ctx, key, entry, base, resolved, sel, liveNode) {
    const fontSpec = fontSpecFor(key, resolved, ctx);
    const liveRead = readLiveValue(key, liveNode, ctx.root, entry.value, { fontSpec });

    return {
        ...base,
        selector: sel.selector,
        figmaValue: fontSpec ? formatFontSpec(fontSpec, resolved.value) : resolved.value,
        liveValue: liveRead.value,
        liveSource: liveRead.source,
        delta: liveRead.delta ?? '',
        verdict: judge(key, entry.value, resolved.value, liveRead),
        note: liveRead.note ?? '',
    };
}

function comparedRow(ctx, entry, base, resolved) {
    const sel = resolveSelector({ from: entry.from, map: ctx.map, explicit: entry.selector });

    if (!sel.ok) {
        return skipRow(base, '—', sel.reason);
    }

    const liveNode = findByClass(ctx.root, sel.selector);

    if (!liveNode) {
        return skipRow(base, sel.selector, `selector ${sel.selector} not in css-tree`);
    }

    return measuredRow(ctx, base.key, entry, base, resolved, sel, liveNode);
}

function compareEntry(ctx, key, entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }

    const resolved = figmaValueOf(ctx.snapshot, entry.from);
    const base = rowBase(key, entry, resolved.value);

    if (skippedEntry(entry)) {
        return skipRow(base, explicitSelector(entry), skipNote(entry));
    }

    return comparedRow(ctx, entry, base, resolved);
}

function collectRows(ctx) {
    /** @type {CompareRow[]} */
    const rows = [];

    for (const [key, entry] of Object.entries(ctx.entries)) {
        const row = compareEntry(ctx, key, entry);

        if (row) {
            rows.push(row);
        }
    }

    return rows;
}

function pushUnmappedWarning(warnings, rows) {
    const unmapped = rows.filter((row) => row.note?.startsWith('unmapped nodeId'));

    if (!unmapped.length) {
        return;
    }

    warnings.push(
        `${unmapped.length} check key(s) unmapped — add map.<frame>[".bem"] = nodeId (or entry.selector). No keyword guessing.`,
    );
}

function verdictCounts(rows) {
    return {
        PASS: rows.filter((row) => row.verdict === 'PASS').length,
        FAIL: rows.filter((row) => row.verdict === 'FAIL').length,
        SKIP: rows.filter((row) => row.verdict === 'SKIP').length,
        INFO: rows.filter((row) => row.verdict === 'INFO').length,
    };
}

function reportMeta(cssTree) {
    return {
        url: cssTree.url ?? null,
        selector: cssTree.selector ?? null,
        viewportWidth: cssTree.viewportWidth ?? null,
        designedWidth: cssTree.designedWidth ?? null,
        fetchedAt: cssTree.fetchedAt ?? null,
    };
}

export function compareCssTreeToCheck(opts) {
    const ctx = checkContext(opts);
    const warnings = [];
    const viewportWarning = desktopViewportWarning(ctx.frameKey, ctx.cssTree);

    if (viewportWarning) {
        warnings.push(viewportWarning);
    }

    const rows = collectRows(ctx);

    pushUnmappedWarning(warnings, rows);

    const counts = verdictCounts(rows);

    return {
        frame: ctx.frameKey,
        verdict: counts.FAIL > 0 ? 'FAIL' : 'PASS',
        counts,
        warnings,
        rows: [...rows].sort(compareVerdictImportance),
        map: ctx.map,
        meta: reportMeta(ctx.cssTree),
    };
}

/**
 * @returns {{ ok: true, selector: string } | { ok: false, reason: string }}
 */
function resolveSelector({ from, map, explicit }) {
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

function styleProp(el, prop) {
    return el.styles?.[prop];
}

function pxRead(value, source, checkValue) {
    return { value, source, delta: deltaPx(checkValue, value) };
}

function readMarginBottom(el, _root, checkValue) {
    return pxRead(styleProp(el, 'margin-bottom'), 'styles.margin-bottom', checkValue);
}

function readRowGap(el, _root, checkValue) {
    const gap = styleProp(el, 'row-gap') ?? styleProp(el, 'gap');

    return pxRead(gap, 'styles.row-gap', checkValue);
}

function gapOrSkip(gap, source, checkValue, note) {
    if (gap && gap !== 'normal') {
        return pxRead(gap, source, checkValue);
    }

    return { value: null, source: 'geometry', note, delta: '' };
}

function readGap(el, _root, checkValue) {
    const gap = styleProp(el, 'gap') ?? styleProp(el, 'column-gap') ?? styleProp(el, 'row-gap');

    return gapOrSkip(gap, 'styles.gap', checkValue, 'gap/gutter not in computed styles — SKIP (use box math manually)');
}

function readPadding(el) {
    const pad = `${styleProp(el, 'padding-top') ?? ''} ${styleProp(el, 'padding-right') ?? ''}`.trim();

    return { value: pad, source: 'styles.padding', delta: '' };
}

function readTextTransform(el) {
    return { value: styleProp(el, 'text-transform'), source: 'styles.text-transform', delta: '' };
}

function readMaxWidth(el, _root, checkValue) {
    return pxRead(styleProp(el, 'max-width'), 'styles.max-width', checkValue);
}

function boxOrStyle(el, boxKey, styleKey) {
    return el.box?.[boxKey] ?? styleProp(el, styleKey);
}

function readWidth(el, _root, checkValue) {
    return pxRead(boxOrStyle(el, 'width', 'width'), 'box.width', checkValue);
}

function readHeight(el, _root, checkValue) {
    return pxRead(boxOrStyle(el, 'height', 'height'), 'box.height', checkValue);
}

function readSectionSize(_el, root) {
    return {
        value: `${Math.round(root.box?.width ?? 0)}×${Math.round(root.box?.height ?? 0)}`,
        source: 'root.box',
        note: 'computed box vs artboard — INFO',
        delta: '',
    };
}

function readPhotoGap(_el, root, checkValue) {
    const gap = styleProp(root, 'column-gap') ?? styleProp(root, 'gap');

    return gapOrSkip(gap, 'root.column-gap', checkValue, 'no column-gap; SKIP box math without paired nodes');
}

function readGeometrySkip() {
    return { value: null, source: '—', note: 'geometry/type token — SKIP in auto live reader', delta: '' };
}

function readMissingKey() {
    return { value: null, source: '—', note: 'no live reader for key', delta: '' };
}

const LIVE_READERS = [
    { match: (key) => key.includes('font'), read: (el, _root, _check, ctx) => readLiveFont(el, ctx.fontSpec) },
    { match: (key) => key.includes('locationtointro'), read: readMarginBottom },
    { match: (key) => key.includes('rowgap') || key.endsWith('rowgap'), read: readRowGap },
    { match: (key) => key.endsWith('gap') || key.includes('gutter'), read: readGap },
    { match: (key) => key.includes('padding'), read: (el) => readPadding(el) },
    { match: (key) => key.includes('opacity'), read: (el, _root, checkValue) => readLiveOpacity(el, checkValue) },
    {
        match: (key) => key.includes('texttransform') || key === 'csstexttransform',
        read: (el) => readTextTransform(el),
    },
    { match: (key) => key.includes('maxwidth') || key === 'intromaxwidth', read: readMaxWidth },
    { match: (key) => key.includes('width') && !key.includes('section'), read: readWidth },
    { match: (key) => key.includes('height') && !key.includes('section'), read: readHeight },
    { match: (key) => key === 'sectionsize', read: readSectionSize },
    { match: (key) => key.includes('gutter') || key.includes('photostocontent'), read: readPhotoGap },
    { match: (key) => key.endsWith('x') || key.endsWith('y') || key.includes('fill'), read: readGeometrySkip },
];

function readLiveValue(key, node, root, checkValue, ctx = {}) {
    if (!node && !root) {
        return { value: null, source: 'missing', note: 'no live node' };
    }

    const hit = LIVE_READERS.find((reader) => reader.match(key.toLowerCase()));

    if (!hit) {
        return readMissingKey();
    }

    return hit.read(node || root, root, checkValue, ctx);
}

function notedSkip(live) {
    return Boolean(live.note?.includes('SKIP') || live.value == null);
}

function earlyVerdict(key, live) {
    if (!notedSkip(live)) {
        return null;
    }

    if (key === 'sectionsize' || live.note?.includes('INFO')) {
        return 'INFO';
    }

    if (live.value == null) {
        return 'SKIP';
    }

    return null;
}

function opacityVerdict(checkValue, live) {
    const a = toNum(checkValue);
    const b = toNum(live.value);

    if (a != null && b != null) {
        return Math.abs(a - b) <= TOL_OPACITY ? 'PASS' : 'FAIL';
    }

    return live.value == null ? 'SKIP' : 'FAIL';
}

function fontVerdict(live) {
    if (live.note?.includes('SKIP') || live.value == null) {
        return 'SKIP';
    }

    if (live.mismatches?.length) {
        return 'FAIL';
    }

    return 'PASS';
}

function textMatches(checkValue, live) {
    const word = String(checkValue).toLowerCase().split(' ')[0];

    return String(live.value).toLowerCase().includes(word);
}

function textVerdict(checkValue, live) {
    if (normalizeStr(checkValue) === normalizeStr(live.value)) {
        return 'PASS';
    }

    return textMatches(checkValue, live) ? 'PASS' : 'FAIL';
}

function pxClose(checkValue, live) {
    const a = toNum(checkValue);
    const b = toNum(live.value);

    if (a == null || b == null) {
        return null;
    }

    return Math.abs(a - b) <= TOL_PX ? 'PASS' : 'FAIL';
}

function prefixPass(checkValue, live) {
    const a = toNum(checkValue);

    if (a == null || !normalizeStr(live.value).startsWith(String(a))) {
        return null;
    }

    return 'PASS';
}

function stringOrSkip(checkValue, live) {
    if (normalizeStr(checkValue) === normalizeStr(live.value)) {
        return 'PASS';
    }

    return live.value == null ? 'SKIP' : 'FAIL';
}

function kindVerdict(key, checkValue, live) {
    if (key.includes('opacity')) {
        return opacityVerdict(checkValue, live);
    }

    if (key.includes('font')) {
        return fontVerdict(live);
    }

    if (key.includes('padding') || key.includes('texttransform')) {
        return textVerdict(checkValue, live);
    }

    return pxClose(checkValue, live) ?? prefixPass(checkValue, live) ?? stringOrSkip(checkValue, live);
}

function judge(key, checkValue, _figmaValue, liveRead) {
    const k = key.toLowerCase();
    const early = earlyVerdict(k, liveRead);

    if (early) {
        return early;
    }

    if (k === 'sectionsize') {
        return 'INFO';
    }

    return kindVerdict(k, checkValue, liveRead);
}

/**
 * @param {object} snapshot
 * @param {string} frameKey
 * @param {string} styleName
 * @returns {object | null}
 */
function namedStyle(styleName) {
    return Boolean(styleName && typeof styleName === 'string');
}

function styleHit(vars, styleName) {
    const hit = vars?.[styleName];

    if (hit && typeof hit === 'object' && hit.fontSize != null) {
        return hit;
    }

    return null;
}

function directTextStyle(snapshot, frameKey, styleName) {
    if (!namedStyle(styleName)) {
        return null;
    }

    return styleHit(snapshot?.frames?.[frameKey]?.globalVars, styleName);
}

function lookupTextStyle(snapshot, frameKey, styleName) {
    const direct = directTextStyle(snapshot, frameKey, styleName);

    if (direct) {
        return direct;
    }

    for (const frame of Object.values(snapshot?.frames ?? {})) {
        const hit = styleHit(frame?.globalVars, styleName);

        if (hit) {
            return hit;
        }
    }

    return null;
}

function formatFontSpec(spec, styleName) {
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
function missingFontSpec() {
    return {
        value: null,
        source: 'globalVars textStyle',
        note: 'SKIP — textStyle not found in snapshot globalVars',
        delta: '',
        mismatches: [],
    };
}

function missingLiveSize() {
    return {
        value: null,
        source: 'styles.font-*',
        note: 'SKIP — no live font-size (re-dump with font props)',
        delta: '',
        mismatches: [],
    };
}

function fontLive(el) {
    const size = toNum(el.styles?.['font-size']);

    return {
        size,
        weight: toNum(el.styles?.['font-weight']),
        lhPx: toNum(el.styles?.['line-height']),
        lsPx: toNum(el.styles?.['letter-spacing']),
        family: String(el.styles?.['font-family'] ?? ''),
        lhEm: emRatio(toNum(el.styles?.['line-height']), size),
        lsEm: emRatio(toNum(el.styles?.['letter-spacing']), size),
    };
}

function emRatio(px, size) {
    if (px == null || !size) {
        return null;
    }

    return px / size;
}

function fontExpected(spec) {
    return {
        size: toNum(spec.fontSize),
        weight: toNum(spec.fontWeight),
        lhEm: parseEm(spec.lineHeight),
        lsEm: parseEm(spec.letterSpacing),
        family: String(spec.fontFamily ?? ''),
    };
}

function pushSizeMismatch(mismatches, live, expected) {
    if (expected.size != null && Math.abs(live.size - expected.size) > TOL_PX) {
        mismatches.push(`fontSize ${live.size}≠${expected.size}`);
    }
}

function pushWeightMismatch(mismatches, live, expected) {
    if (expected.weight == null || live.weight == null || live.weight === expected.weight) {
        return;
    }

    mismatches.push(`weight ${live.weight}≠${expected.weight}`);
}

function pushEmMismatch(mismatches, label, liveEm, expectedEm) {
    if (expectedEm == null || liveEm == null || Math.abs(liveEm - expectedEm) <= TOL_EM) {
        return;
    }

    mismatches.push(`${label} ${round3(liveEm)}≠${expectedEm}`);
}

function pushFamilyMismatch(mismatches, live, expected) {
    if (!expected.family || !live.family) {
        return;
    }

    const got = live.family.toLowerCase().replace(/["']/g, '');

    if (!got.includes(expected.family.toLowerCase())) {
        mismatches.push(`family !${expected.family}`);
    }
}

function fontMismatches(live, expected) {
    /** @type {string[]} */
    const mismatches = [];

    pushSizeMismatch(mismatches, live, expected);
    pushWeightMismatch(mismatches, live, expected);
    pushEmMismatch(mismatches, 'lh', live.lhEm, expected.lhEm);
    pushEmMismatch(mismatches, 'ls', live.lsEm, expected.lsEm);
    pushFamilyMismatch(mismatches, live, expected);

    return mismatches;
}

function emLabel(em) {
    return em != null ? round3(em) : '—';
}

function fontSummary(live) {
    return `${live.size}px/${emLabel(live.lhEm)}em/${emLabel(live.lsEm)}em/${live.weight ?? '—'}`;
}

function fontResult(live, mismatches) {
    return {
        value: fontSummary(live),
        source: 'styles.font-* vs globalVars',
        delta: mismatches.length ? mismatches.join('; ') : '0',
        note: mismatches.length ? mismatches.join('; ') : '',
        mismatches,
    };
}

function readLiveFont(el, fontSpec) {
    if (!fontSpec) {
        return missingFontSpec();
    }

    const live = fontLive(el);

    if (live.size == null) {
        return missingLiveSize();
    }

    return fontResult(live, fontMismatches(live, fontExpected(fontSpec)));
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
function readLiveOpacity(el, checkValue) {
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
function alphaFromCssColor(color) {
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

const VERDICT_RANK = { FAIL: 0, INFO: 1, SKIP: 2, PASS: 3 };

function compareVerdictImportance(a, b) {
    const ra = VERDICT_RANK[a.verdict] ?? 99;
    const rb = VERDICT_RANK[b.verdict] ?? 99;

    if (ra !== rb) return ra - rb;

    return String(a.key).localeCompare(String(b.key));
}
