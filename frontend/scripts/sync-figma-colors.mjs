import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = path.join(__dirname, 'figma_colors.json');
const VARIABLES_SCSS = path.join(__dirname, '../src/app/css/base/_variables.scss');

const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'u7u8ZErBchKM06eoxWOF9p';
const COLLECTION_FILTER = process.env.FIGMA_COLOR_COLLECTION_NAME ?? '';

const COLOR_TYPES = new Set(['color', 'COLOR']);
const RESERVED_KEYS = new Set(['$extensions', '$description', '$collection_metadata', '$variable_metadata']);

const inputArg = process.argv.find((a) => a === '--input');
const inputPath = inputArg ? path.resolve(process.argv[process.argv.indexOf('--input') + 1]) : DEFAULT_INPUT;
const useApi = process.argv.includes('--api');

function figmaNameToScss(name) {
    const parts = name
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean);
    const leaf = parts.length > 1 ? parts[parts.length - 1] : name;
    return leaf
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function rgbaToHex({ r, g, b, a = 1 }) {
    const h = (n) =>
        Math.round(Math.min(1, Math.max(0, n)) * 255)
            .toString(16)
            .padStart(2, '0');
    const hex = `#${h(r)}${h(g)}${h(b)}`;
    return a < 1 ? `${hex}${h(a)}` : hex;
}

const HEX_COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const RGBA_COLOR = /^rgba?\(\s*([^)]+)\s*\)$/i;

function channelScale(r, g, b) {
    if (r > 1 || g > 1 || b > 1) {
        return 255;
    }

    return 1;
}

function hexFromChannels(parts) {
    const [r, g, b, a = 1] = parts.map(Number);
    const scale = channelScale(r, g, b);

    return rgbaToHex({ r: r / scale, g: g / scale, b: b / scale, a: Number(a) });
}

function hexFromRgba(value) {
    const rgba = value.match(RGBA_COLOR);

    if (!rgba) {
        return null;
    }

    const parts = rgba[1].split(',').map((part) => part.trim());

    if (parts.some((part) => Number.isNaN(Number(part)))) {
        return null;
    }

    return hexFromChannels(parts);
}

function parseHex(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const color = value.trim();

    if (HEX_COLOR.test(color)) {
        return color.toLowerCase();
    }

    return hexFromRgba(color);
}

function colorSearchStopped(value, depth) {
    return value == null || depth > 12;
}

function parseStringColor(value) {
    if (typeof value !== 'string') {
        return undefined;
    }

    return parseHex(value);
}

function isAlias(value, variables, modeId) {
    return value.type === 'VARIABLE_ALIAS' && Boolean(variables) && Boolean(modeId);
}

function parseAliasColor(value, variables, modeId, depth) {
    if (!isAlias(value, variables, modeId)) {
        return undefined;
    }

    const target = variables[value.id];

    if (!target?.valuesByMode) {
        return null;
    }

    return parseColorValue(target.valuesByMode[modeId], variables, modeId, depth + 1);
}

function hasRgb(value) {
    return typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number';
}

function parseRgbColor(value) {
    if (!hasRgb(value)) {
        return undefined;
    }

    return rgbaToHex({ r: value.r, g: value.g, b: value.b, a: value.a ?? 1 });
}

function parseComponentsColor(value) {
    if (!Array.isArray(value.components) || value.components.length < 3) {
        return undefined;
    }

    const [r, g, b] = value.components;

    return rgbaToHex({ r, g, b, a: value.alpha ?? 1 });
}

function hexWithAlpha(value, hex, alpha) {
    if (!(value.components?.length >= 3)) {
        return hex;
    }

    const [r, g, b] = value.components;

    return rgbaToHex({ r, g, b, a: alpha });
}

function parseHexField(value) {
    if (!value.hex) {
        return undefined;
    }

    const hex = parseHex(value.hex);
    const alpha = value.alpha ?? 1;

    if (alpha >= 1) {
        return hex;
    }

    return hexWithAlpha(value, hex, alpha);
}

function firstColor(parsed) {
    for (const value of parsed) {
        if (value !== undefined) {
            return value;
        }
    }

    return null;
}

function parseColorObject(value, variables, modeId, depth) {
    return firstColor([
        parseAliasColor(value, variables, modeId, depth),
        parseRgbColor(value),
        parseComponentsColor(value),
        parseHexField(value),
    ]);
}

function parseColorValue(value, variables = null, modeId = null, depth = 0) {
    if (colorSearchStopped(value, depth)) {
        return null;
    }

    if (typeof value === 'string') {
        return parseStringColor(value);
    }

    if (typeof value !== 'object') {
        return null;
    }

    return parseColorObject(value, variables, modeId, depth);
}

function normalizePathSegment(key) {
    if (!key || key.startsWith('$')) return null;
    if (key.startsWith('@')) return key.slice(1);
    return key;
}

function modeMap(node) {
    return node.$variable_metadata?.modes ?? node.modes;
}

function firstModeValue(node) {
    const modes = modeMap(node);

    if (!modes || typeof modes !== 'object') {
        return null;
    }

    return Object.values(modes)[0];
}

function pickTokenValue(node) {
    if (node.$value !== undefined) {
        return node.$value;
    }

    if (node.value !== undefined) {
        return node.value;
    }

    return firstModeValue(node);
}

function metaName(node) {
    return node.$variable_metadata?.name || null;
}

function slashName(node) {
    if (typeof node.name === 'string' && node.name.includes('/')) {
        return node.name;
    }

    return null;
}

function pathName(node, path) {
    if (path.length) {
        return path.join('/');
    }

    if (typeof node.name === 'string') {
        return node.name;
    }

    return null;
}

function tokenDisplayName(node, path) {
    return metaName(node) || slashName(node) || pathName(node, path);
}

function extractByTreeWalk(data) {
    const entries = [];
    const seenNames = new Set();

    function add(name, hex) {
        if (!name || !hex || seenNames.has(name)) return;
        seenNames.add(name);
        entries.push({ name, hex });
    }

    walkColorNode(data, { path: [], variables: null, modeId: null, add });
    return entries;
}

function tokenType(node) {
    return node.$type ?? node.type ?? node.resolvedType;
}

function markedColor(node, type) {
    if (COLOR_TYPES.has(type)) {
        return true;
    }

    return type === 'color' && (node.$value != null || node.value != null);
}

function looksLikeColor(node, ctx) {
    const type = tokenType(node);

    if (markedColor(node, type)) {
        return true;
    }

    return Boolean(node.$value && parseColorValue(pickTokenValue(node), ctx.variables, ctx.modeId));
}

function tryTokenColor(node, ctx) {
    if (!looksLikeColor(node, ctx)) {
        return false;
    }

    const name = tokenDisplayName(node, ctx.path);
    const hex = parseColorValue(pickTokenValue(node), ctx.variables, ctx.modeId);

    if (!(name && hex)) {
        return false;
    }

    ctx.add(name, hex);

    return true;
}

function isResolvedColor(node, modeId) {
    return node.resolvedType === 'COLOR' && Boolean(node.valuesByMode) && Boolean(modeId);
}

function resolvedName(node, path) {
    return node.name ?? path.join('/');
}

function rememberResolved(ctx, name, hex) {
    if (name && hex) {
        ctx.add(name, hex);
    }
}

function tryResolvedColor(node, ctx) {
    if (!isResolvedColor(node, ctx.modeId)) {
        return false;
    }

    rememberResolved(
        ctx,
        resolvedName(node, ctx.path),
        parseColorValue(node.valuesByMode[ctx.modeId], ctx.variables, ctx.modeId),
    );

    return true;
}

function recordColorNode(node, ctx) {
    if (tryTokenColor(node, ctx)) {
        return true;
    }

    return tryResolvedColor(node, ctx);
}

function skipWalk(node) {
    return node == null || typeof node !== 'object';
}

function walkList(nodes, ctx) {
    for (const item of nodes) {
        walkColorNode(item, ctx);
    }
}

function skipField(key) {
    if (RESERVED_KEYS.has(key)) {
        return true;
    }

    return key.startsWith('$') && key !== '$value';
}

function nextColorPath(key, path) {
    const segment = normalizePathSegment(key);

    if (!segment) {
        return path;
    }

    return [...path, segment];
}

function walkField(key, val, ctx) {
    if (skipField(key)) {
        return;
    }

    if (!val || typeof val !== 'object') {
        return;
    }

    walkColorNode(val, { ...ctx, path: nextColorPath(key, ctx.path) });
}

function walkFields(node, ctx) {
    for (const [key, val] of Object.entries(node)) {
        walkField(key, val, ctx);
    }
}

function walkColorNode(node, ctx) {
    if (skipWalk(node)) {
        return;
    }

    if (Array.isArray(node)) {
        walkList(node, ctx);

        return;
    }

    if (recordColorNode(node, ctx)) {
        return;
    }

    walkFields(node, ctx);
}

function collectionMap(body) {
    return body.meta?.variableCollections ?? body.variableCollections ?? {};
}

function variableMap(body) {
    return body.meta?.variables ?? body.variables ?? {};
}

function targetCollections(collections) {
    const collectionList = Object.values(collections);

    if (!COLLECTION_FILTER) {
        return collectionList;
    }

    const targets = collectionList.filter((collection) => collection.name === COLLECTION_FILTER);

    if (!targets.length) {
        throw new Error(
            `Коллекция "${COLLECTION_FILTER}" не найдена. Доступные: ${collectionList.map((collection) => collection.name).join(', ')}`,
        );
    }

    return targets;
}

function collectionModeId(collection) {
    return collection.defaultModeId ?? collection.modes?.[0]?.modeId;
}

function colorHex(variable, variables, modeId) {
    if (!variable || variable.resolvedType !== 'COLOR') {
        return null;
    }

    return parseColorValue(variable.valuesByMode?.[modeId], variables, modeId);
}

function rememberColor(entries, seen, name, hex) {
    if (!name || !hex || seen.has(name)) {
        return;
    }

    seen.add(name);
    entries.push({ name, hex });
}

function collectCollection(entries, seen, collection, variables) {
    const modeId = collectionModeId(collection);
    const ids = collection.variableIds ?? [];

    for (const id of ids) {
        const variable = variables[id];

        rememberColor(entries, seen, variable?.name, colorHex(variable, variables, modeId));
    }
}

function extractFromRestPayload(body) {
    const entries = [];
    const seen = new Set();
    const variables = variableMap(body);

    for (const collection of targetCollections(collectionMap(body))) {
        collectCollection(entries, seen, collection, variables);
    }

    return entries;
}

function variableBag(data) {
    return data.meta?.variables ?? data.variables;
}

function isVariableRecord(vars) {
    return Boolean(vars && typeof vars === 'object' && !Array.isArray(vars));
}

function hasResolvedType(vars) {
    return Object.values(vars).some(
        (variable) => variable && typeof variable === 'object' && 'resolvedType' in variable,
    );
}

function isRestVariablesPayload(data) {
    const vars = variableBag(data);

    if (!isVariableRecord(vars)) {
        return false;
    }

    return hasResolvedType(vars);
}

function colorEntry(item) {
    return {
        name: tokenDisplayName(item, []),
        hex: parseColorValue(pickTokenValue(item)),
    };
}

function isColorItem(item) {
    return Boolean(item && COLOR_TYPES.has(item.$type ?? item.type));
}

function namedColor(entry) {
    return Boolean(entry.name && entry.hex);
}

function entriesFromArray(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    return data.filter(isColorItem).map(colorEntry).filter(namedColor);
}

function parseFigmaColorsFile(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const fromArray = entriesFromArray(parsed);

    if (fromArray.length) {
        return fromArray;
    }

    if (isRestVariablesPayload(parsed)) {
        return extractFromRestPayload(parsed);
    }

    return extractByTreeWalk(parsed);
}

function ensureUniqueScssNames(entries) {
    const used = new Map();
    return entries.map((entry) => {
        let scss = figmaNameToScss(entry.name);
        if (!used.has(scss)) {
            used.set(scss, 1);
            return { ...entry, scss };
        }
        const count = used.get(scss) + 1;
        used.set(scss, count);
        scss = `${scss}-${count}`;
        return { ...entry, scss };
    });
}

function figmaToken() {
    return process.env.FIGMA_API_KEY ?? process.env.PUBLIC_FIGMA_TOKEN;
}

function assertFigmaOk(res, body) {
    if (res.ok) {
        return;
    }

    const msg = body.message ?? JSON.stringify(body);

    if (msg.includes('file_variables:read')) {
        throw new Error('Нет scope file_variables:read (Figma Enterprise). Экспортируй JSON в figma_colors.json');
    }

    throw new Error(`Figma API: ${msg}`);
}

async function loadFromApi() {
    const API_KEY = figmaToken();

    if (!API_KEY) {
        throw new Error('Задай FIGMA_API_KEY или PUBLIC_FIGMA_TOKEN для --api');
    }

    const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/variables/local`, {
        headers: { 'X-Figma-Token': API_KEY },
    });
    const body = await res.json();

    assertFigmaOk(res, body);

    return parseFigmaColorsFile(body);
}

function loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseFigmaColorsFile(JSON.parse(raw));
}

function writeScss(entries) {
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    const withScss = ensureUniqueScssNames(sorted);

    const lines = [
        '/**',
        '  * @tokens ColorPalette',
        '  * @presenter Color',
        '  * Синхронизировано из figma_colors.json',
        '  */',
        ...withScss.map(({ name, hex, scss }) => `$${scss}: ${hex}; // ${name}`),
        '',
        '',
    ];

    let scss = fs.readFileSync(VARIABLES_SCSS, 'utf8');
    const startMarker = '/**\n  * @tokens ColorPalette';
    const endMarker = '/**\n  * @tokens-end\n  */\n\n/**\n  * @tokens Colors';

    const startIdx = scss.indexOf(startMarker);
    const endIdx = scss.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
        throw new Error('Не найден блок @tokens ColorPalette в _variables.scss');
    }

    scss = scss.slice(0, startIdx) + lines.join('\n') + scss.slice(endIdx);
    fs.writeFileSync(VARIABLES_SCSS, scss);

    return withScss.length;
}

async function main() {
    let entries;

    try {
        if (useApi) {
            entries = await loadFromApi();
            console.log('Источник: Figma API');
        } else {
            entries = loadFromFile(inputPath);
            console.log(`Источник: ${inputPath}`);
        }
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    if (!entries.length) {
        console.error('Цветовые токены не найдены. Проверь формат figma_colors.json');
        process.exit(1);
    }

    const count = writeScss(entries);
    console.log(`OK: ${count} цветов → ${VARIABLES_SCSS}`);
}

main();
