#!/usr/bin/env node
import { execFileSync, execSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    statSync,
    watch,
    writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? '') : undefined);
const POLICY_FILE = resolve(flag('--policy') ?? join(HERE, '../../uml-viewer.policy.json'));
const ROOT = dirname(POLICY_FILE);
const MAIL_DIR = join(ROOT, '.uml-viewer');
const TO_AGENT = join(MAIL_DIR, 'to-agent.json');
const TO_VIEWER = join(MAIL_DIR, 'to-viewer.json');
const IR_FILE = join(MAIL_DIR, 'ir.json');

const TS_EXT = ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.astro'];
const STYLE_EXT = ['.scss', '.sass', '.css'];
const BINARY_EXT = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.bmp',
    '.avif',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot',
    '.mp4',
    '.webm',
    '.mp3',
    '.wav',
    '.zip',
    '.gz',
    '.7z',
    '.pdf',
    '.wasm',
]);
const SKIP = [
    /\.(test|spec|stories)\.[cm]?[jt]sx?$/,
    /\.d\.ts$/,
    /Story\.astro$/,
    /\.figma\.mcp\.yml$/,
    /(^|\/)__(tests|fixtures|mocks)__\//,
];
const MISSING = '✕ нет маршрута';

const posix = (p) => p.split(sep).join('/');
const sha = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const isFile = (p) => existsSync(p) && statSync(p).isFile();
const readJson = (file, fallback) => {
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
};
const writeJsonAtomic = (file, data) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(`${file}.tmp`, file);
};

function loadPolicy() {
    const policy = { title: 'UML', sources: [], omit: [], proposals: [], ...readJson(POLICY_FILE, {}) };
    policy.sources = policy.sources.map((s) => ({ levels: [], isolated: [], dirs: ['src'], strip: '', ...s }));
    return policy;
}

const sourceRoot = (source) => {
    const path = isAbsolute(source.root) ? source.root : resolve(ROOT, source.root);
    return existsSync(path) ? realpathSync(path) : path;
};

function skipDirEntry(name) {
    return name.startsWith('.') || name === 'node_modules' || name === 'vendor';
}

function walkEntry(dir, entry, exts, out) {
    if (skipDirEntry(entry.name)) return;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, exts, out);
    else if (exts.includes(extname(entry.name))) out.push(path);
}

function walk(dir, exts, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) walkEntry(dir, entry, exts, out);
    return out;
}

function walkFileEntry(dir, entry, out) {
    if (skipDirEntry(entry.name)) return;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, out);
    else out.push(path);
}

function walkFiles(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) walkFileEntry(dir, entry, out);
    return out;
}

function strippedLocal(source, local) {
    if (source.strip && local.startsWith(`${source.strip}/`)) return local.slice(source.strip.length + 1);
    return local;
}

function binaryModule(source, root, abs, stereotype) {
    const st = statSync(abs);
    const local = posix(relative(root, abs));
    return {
        local: strippedLocal(source, local),
        path: abs,
        lang: extname(abs).slice(1) || 'bin',
        lines: 0,
        hash: sha(`${st.size}:${Math.trunc(st.mtimeMs)}`),
        stereotype,
        ops: [],
        binary: true,
    };
}

function textOrBinary(source, root, abs, stereotype) {
    try {
        const text = readFileSync(abs, 'utf8');
        if (text.includes('\0')) return binaryModule(source, root, abs, stereotype);
        return { ...moduleBase(source, root, abs, text), stereotype, ops: [] };
    } catch {
        return binaryModule(source, root, abs, stereotype);
    }
}

function structureOnlyModule(source, root, abs) {
    const ext = extname(abs).toLowerCase();
    const stereotype = STYLE_EXT.includes(ext) ? 'stylesheet' : 'file';
    if (BINARY_EXT.has(ext)) return binaryModule(source, root, abs, stereotype);
    return textOrBinary(source, root, abs, stereotype);
}

function moduleBase(source, root, abs, text) {
    return {
        local: strippedLocal(source, posix(relative(root, abs))),
        path: abs,
        lang: extname(abs).slice(1),
        lines: text.split('\n').length,
        hash: sha(text),
    };
}

const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s+(type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
const DYNAMIC_RE = /\bimport\(\s*['"]([^'"\n]+)['"]/g;
const DECL_RE =
    /^export\s+(default\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|var|abstract\s+class|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const LIST_RE = /^export\s+(type\s+)?\{([^}]*)\}\s*(?:from\s+['"]([^'"]+)['"])?/gm;
const STAR_RE = /^export\s+\*\s+(?:as\s+([\w$]+)\s+)?from\s+['"]([^'"]+)['"]/gm;
const CALL_RE = /(?:\.(get|post|put|patch|delete)\s*(?:<[^>()]*>)?\s*\(\s*)?(['"`])(\/(?:api\/)?v\d+\/[^'"`\s]*)\2/g;

function packageName(spec) {
    if (spec.startsWith('node:')) return 'node';
    const parts = spec.split('/');
    if (spec.startsWith('@')) return parts.slice(0, 2).join('/');
    return parts[0];
}

function aliasPair(root, key, target) {
    return [key.slice(0, -1), resolve(root, target.replace(/\*$/, ''))];
}

function tsAliases(root) {
    const paths = readJson(join(root, 'tsconfig.json'), {}).compilerOptions?.paths ?? {};
    return Object.entries(paths)
        .filter(([key]) => key.endsWith('/*'))
        .map(([key, [target]]) => aliasPair(root, key, target));
}

function tsBase(clean, fromFile, aliases) {
    if (clean.startsWith('.')) return resolve(dirname(fromFile), clean);
    const alias = aliases.find(([prefix]) => clean.startsWith(prefix));
    if (!alias) return null;
    return join(alias[1], clean.slice(alias[0].length));
}

function tsCandidates(base) {
    const ext = extname(base);
    return [
        ...(TS_EXT.includes(ext) ? [base] : []),
        ...(ext === '.js' ? [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')] : []),
        ...TS_EXT.map((e) => base + e),
        ...TS_EXT.map((e) => join(base, `index${e}`)),
    ];
}

function resolveTs(spec, fromFile, aliases) {
    const clean = spec.split('?')[0];
    if (clean.startsWith('astro:')) return { foreign: 'astro' };
    const base = tsBase(clean, fromFile, aliases);
    if (!base) return { foreign: packageName(clean) };
    const hit = tsCandidates(base).find(isFile);
    return hit ? { path: hit } : null;
}

function pushDecl(ops, text, match) {
    const kind = match[2].replace(/\s+/g, ' ');
    ops.push({ name: match[3], kind, type: kind === 'interface' || kind === 'type', line: lineAt(text, match.index) });
}

function pushListItem(ops, text, match, raw) {
    const item = raw.trim();
    if (!item) return;
    const type = Boolean(match[1]) || item.startsWith('type ');
    const name = item
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        .trim();
    ops.push({ name, kind: match[3] ? 're-export' : 'export', type, line: lineAt(text, match.index), from: match[3] });
}

function pushList(ops, text, match) {
    for (const raw of match[2].split(',')) pushListItem(ops, text, match, raw);
}

function pushStar(ops, text, match) {
    ops.push({
        name: match[1] ?? `* ${match[2]}`,
        kind: 're-export',
        type: false,
        line: lineAt(text, match.index),
        from: match[2],
    });
}

function pushDefault(ops, text) {
    if (!/^export\s+default\s+(?!(?:async\s+)?(?:function|class|abstract))/m.test(text)) return;
    ops.push({
        name: 'default',
        kind: 'default',
        type: false,
        line: lineAt(text, text.search(/^export\s+default/m)),
    });
}

function pushAstroOps(ops, text, file) {
    if (!file.endsWith('.astro')) return;
    const props = text.search(/^[ \t]*(?:interface|type)\s+Props\b/m);
    if (props >= 0 && !ops.some((op) => op.name === 'Props'))
        ops.push({ name: 'Props', kind: 'interface', type: true, line: lineAt(text, props) });
    ops.unshift({ name: basename(file, '.astro'), kind: 'component', type: false, line: 1 });
}

function tsOps(text, file) {
    const ops = [];
    for (const match of text.matchAll(DECL_RE)) pushDecl(ops, text, match);
    for (const match of text.matchAll(LIST_RE)) pushList(ops, text, match);
    for (const match of text.matchAll(STAR_RE)) pushStar(ops, text, match);
    pushDefault(ops, text);
    pushAstroOps(ops, text, file);
    return ops;
}

function allKind(ops, kind) {
    return Boolean(ops.length && ops.every((op) => op.kind === kind));
}

function allTypes(ops) {
    return Boolean(ops.length && ops.every((op) => op.type));
}

function tsStereotype(file, ops) {
    if (file.endsWith('.astro')) return 'component';
    if (allKind(ops, 're-export')) return 'public-api';
    if (allTypes(ops)) return 'interface';
    return 'module';
}

function tsFiles(source, root) {
    return source.dirs
        .flatMap((dir) => walk(join(root, dir), TS_EXT))
        .map((abs) => ({ abs, text: readFileSync(abs, 'utf8') }))
        .map((file) => ({ ...file, ...moduleBase(source, root, file.abs, file.text) }))
        .filter((file) => !SKIP.some((re) => re.test(file.local)));
}

function pushForeignImport(ctx, target) {
    if (!target?.foreign) return false;
    ctx.foreign.push({ from: ctx.local, to: target.foreign });
    return true;
}

function pushLocalImport(ctx, target, type) {
    if (!target || !ctx.byPath.has(target.path)) return;
    ctx.edges.push({ from: ctx.local, to: ctx.byPath.get(target.path), type });
}

function recordImport(ctx, spec, type) {
    const target = resolveTs(spec, ctx.abs, ctx.aliases);
    if (pushForeignImport(ctx, target)) return;
    pushLocalImport(ctx, target, type);
}

function recordCall(ctx, text, match) {
    const path = match[3].replace(/\$\{[^}]*\}/g, ':p').split('?')[0];
    ctx.calls.push({
        from: ctx.local,
        method: (match[1] ?? '*').toUpperCase(),
        path,
        line: lineAt(text, match.index),
    });
}

function tsImports(text) {
    return [
        ...[...text.matchAll(IMPORT_RE)].map((match) => ({ spec: match[2], type: Boolean(match[1]) })),
        ...[...text.matchAll(DYNAMIC_RE)].map((match) => ({ spec: match[1], type: false })),
    ];
}

function scanTsFile(ctx, file) {
    const { abs, text, ...module } = file;
    const bag = { ...ctx, abs, local: module.local };
    for (const { spec, type } of tsImports(text)) recordImport(bag, spec, type);
    for (const match of text.matchAll(CALL_RE)) recordCall(bag, text, match);
    const ops = tsOps(text, module.local);
    return { ...module, stereotype: tsStereotype(module.local, ops), ops };
}

function keptExtra(codeLocals, module) {
    return !codeLocals.has(module.local) && !SKIP.some((re) => re.test(module.local));
}

function extraModules(source, root, codeLocals) {
    const candidateAbs = source.dirs.flatMap((dir) => walkFiles(join(root, dir)));
    const ignored = gitIgnoredAbs(root, candidateAbs);
    return candidateAbs
        .filter((abs) => !ignored.has(abs))
        .map((abs) => structureOnlyModule(source, root, abs))
        .filter((module) => keptExtra(codeLocals, module));
}

function scanTs(source, root) {
    const files = tsFiles(source, root);
    const edges = [];
    const foreign = [];
    const calls = [];
    const ctx = {
        aliases: tsAliases(root),
        byPath: new Map(files.map((file) => [file.abs, file.local])),
        edges,
        foreign,
        calls,
    };
    const modules = files.map((file) => scanTsFile(ctx, file));
    const codeLocals = new Set(modules.map((module) => module.local));
    return { modules: [...modules, ...extraModules(source, root, codeLocals)], edges, foreign, calls, routes: [] };
}

const PHP_NS_RE = /^namespace\s+([\w\\]+)\s*;/m;
const PHP_DECL_RE = /^[ \t]*((?:(?:final|abstract|readonly)\s+)*)(class|interface|trait|enum)\s+(\w+)/gm;
const PHP_USE_RE = /^use\s+(?!function\b|const\b)([^;]+);/gm;
const PHP_TRAIT_RE = /^[ \t]+use\s+([\w\\,\s]+);/gm;
const PHP_FQN_RE = /(?<![\w\\])\\?((?:[A-Z]\w*\\)+[A-Z]\w*)/g;
const PHP_METHOD_RE = /^[ \t]*public\s+(?:static\s+)?function\s+(\w+)/gm;
const ROUTE_TOKEN_RE =
    /(?:Route::|->)(get|post|put|patch|delete|any)\(\s*'([^']*)'\s*,\s*\[?\s*([\w\\]+)::class|prefix\(\s*'([^']*)'\s*\)|->group\(\s*function[^{]*\{|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\{|\}/g;

function useItems(body) {
    const group = body.match(/^([\w\\]+)\\\{(.+)\}$/);
    if (!group) return [body];
    return group[2].split(',').map((item) => `${group[1]}\\${item.trim()}`);
}

function rememberUse(map, item) {
    const [fqn, alias] = item.split(/\s+as\s+/i).map((part) => part.trim().replace(/^\\/, ''));
    if (fqn) map.set(alias ?? fqn.split('\\').pop(), fqn);
}

function phpImports(text) {
    const map = new Map();
    for (const match of text.matchAll(PHP_USE_RE)) {
        for (const item of useItems(match[1].replace(/\s+/g, ' ').trim())) rememberUse(map, item);
    }
    return map;
}

function joinRoute(stack, pending, segment) {
    const prefix = [...stack.map((frame) => frame.prefix), pending ?? ''].filter(Boolean).join('/');
    return `/${[prefix, segment].filter(Boolean).join('/')}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
}

function pushPhpRoute(state, text, match, resolveClass) {
    state.routes.push({
        method: match[1].toUpperCase(),
        path: joinRoute(state.stack, state.pending, match[2]),
        controller: resolveClass(match[3]),
        line: lineAt(text, match.index),
    });
    state.pending = null;
}

function openRouteGroup(state) {
    state.depth += 1;
    state.stack.push({ prefix: state.pending ?? '', depth: state.depth });
    state.pending = null;
}

function closeRouteGroup(state) {
    if (state.stack.at(-1)?.depth === state.depth) state.stack.pop();
    state.depth -= 1;
}

function braceKind(token) {
    if (token.startsWith('->group')) return 'group';
    if (token === '{') return 'open';
    if (token === '}') return 'close';
    return 'skip';
}

function routeKind(match) {
    if (match[1]) return 'route';
    if (match[4] !== undefined) return 'prefix';
    return braceKind(match[0]);
}

const ROUTE_STEPS = {
    route: (state, text, match, resolveClass) => pushPhpRoute(state, text, match, resolveClass),
    prefix: (state, _text, match) => {
        state.pending = match[4];
    },
    group: (state) => openRouteGroup(state),
    open: (state) => {
        state.depth += 1;
    },
    close: (state) => closeRouteGroup(state),
    skip: () => {},
};

function phpRoutes(text, resolveClass) {
    const state = { routes: [], stack: [], depth: 0, pending: null };
    for (const match of text.matchAll(ROUTE_TOKEN_RE)) ROUTE_STEPS[routeKind(match)](state, text, match, resolveClass);
    return state.routes;
}

function phpFiles(source, root) {
    return source.dirs
        .flatMap((dir) => walk(join(root, dir), ['.php']))
        .map((abs) => ({ abs, text: readFileSync(abs, 'utf8') }))
        .map((file) => ({ ...file, ...moduleBase(source, root, file.abs, file.text) }))
        .filter((file) => !SKIP.some((re) => re.test(file.local)));
}

function phpDecls(text) {
    return [...text.matchAll(PHP_DECL_RE)].map((match) => ({
        name: match[3],
        kind: match[1].includes('abstract') ? 'abstract class' : match[2],
        line: lineAt(text, match.index),
    }));
}

function fileNs(text) {
    return text.match(PHP_NS_RE)?.[1] ?? '';
}

function classKey(ns, name) {
    return ns ? `${ns}\\${name}` : name;
}

function indexFile(classes, file) {
    file.ns = fileNs(file.text);
    file.decls = phpDecls(file.text);
    for (const decl of file.decls) classes.set(classKey(file.ns, decl.name), file.local);
}

function indexClasses(files) {
    const classes = new Map();
    for (const file of files) indexFile(classes, file);
    return classes;
}

function resolvePhpClass(imports, ns, name) {
    const clean = name.replace(/^\\/, '');
    const head = clean.split('\\')[0];
    if (imports.has(head)) return [imports.get(head), ...clean.split('\\').slice(1)].join('\\');
    if (clean.includes('\\') || !ns) return clean;
    return `${ns}\\${clean}`;
}

function addTraits(deps, text, resolveClass) {
    for (const match of text.matchAll(PHP_TRAIT_RE)) {
        for (const name of match[1].split(',')) deps.add(resolveClass(name.trim()));
    }
}

function addFqns(deps, text, classes) {
    for (const match of text.matchAll(PHP_FQN_RE)) if (classes.has(match[1])) deps.add(match[1]);
}

function siblingMentioned(text, sibling, local, ns, deps) {
    if (sibling.local === local) return;
    for (const decl of sibling.decls) {
        if (new RegExp(`\\b${decl.name}\\b`).test(text)) deps.add(`${ns}\\${decl.name}`);
    }
}

function addSiblings(deps, text, byNs, ns, local) {
    for (const sibling of byNs.get(ns) ?? []) siblingMentioned(text, sibling, local, ns, deps);
}

function linkKnown(ctx, fqn) {
    const to = ctx.classes.get(fqn);
    if (to !== ctx.local) ctx.edges.push({ from: ctx.local, to, type: false });
}

function linkDep(ctx, fqn) {
    if (ctx.classes.has(fqn)) return linkKnown(ctx, fqn);
    ctx.foreign.push({ from: ctx.local, to: fqn.includes('\\') ? fqn.split('\\')[0] : 'php' });
}

function linkDeps(ctx, deps) {
    for (const fqn of deps) linkDep(ctx, fqn);
}

function declOps(decls) {
    return decls.map((decl) => ({ name: decl.name, kind: decl.kind, type: decl.kind !== 'class', line: decl.line }));
}

function pushMethods(ops, text) {
    for (const match of text.matchAll(PHP_METHOD_RE)) {
        ops.push({ name: match[1], kind: 'method', type: false, line: lineAt(text, match.index) });
    }
}

function rememberRoute(ctx, route, ops) {
    const controller = ctx.classes.get(route.controller);
    ctx.routes.push({ ...route, file: ctx.local, controller });
    ops.push({ name: `${route.method} ${route.path}`, kind: 'route', type: false, line: route.line });
    if (controller) ctx.edges.push({ from: ctx.local, to: controller, type: false });
}

function pushRouteOps(ctx, text, resolveClass, ops) {
    if (!ctx.local.startsWith('routes/')) return;
    for (const route of phpRoutes(text, resolveClass)) rememberRoute(ctx, route, ops);
}

const PHP_STEREOTYPE = { interface: 'interface', trait: 'interface', 'abstract class': 'abstract', enum: 'enum' };

function phpStereotype(decls) {
    return PHP_STEREOTYPE[decls[0]?.kind] ?? 'module';
}

function scanPhpFile(ctx, file) {
    const { abs, text, ns, decls, ...module } = file;
    void abs;
    const bag = { ...ctx, local: module.local };
    const imports = phpImports(text);
    const resolveClass = (name) => resolvePhpClass(imports, ns, name);
    const deps = new Set(imports.values());
    addTraits(deps, text, resolveClass);
    addFqns(deps, text, ctx.classes);
    addSiblings(deps, text, ctx.byNs, ns, module.local);
    linkDeps(bag, deps);
    const ops = declOps(decls);
    pushMethods(ops, text);
    pushRouteOps(bag, text, resolveClass, ops);
    return { ...module, stereotype: phpStereotype(decls), ops };
}

function scanPhp(source, root) {
    const files = phpFiles(source, root);
    const classes = indexClasses(files);
    const byNs = Map.groupBy(
        files.filter((file) => file.decls.length),
        (file) => file.ns,
    );
    const edges = [];
    const foreign = [];
    const routes = [];
    const modules = files.map((file) => scanPhpFile({ classes, byNs, edges, foreign, routes }, file));
    return { modules, edges, foreign, calls: [], routes };
}

const SCANNERS = { ts: scanTs, php: scanPhp };
const routeSegs = (path) =>
    path
        .replace(/^\/+|\/+$/g, '')
        .replace(/^api\//, '')
        .split('/');

function methodOk(callMethod, routeMethod) {
    if (callMethod === '*') return true;
    if (routeMethod === 'ANY') return true;
    return routeMethod === callMethod;
}

function sameTokenScore(param, same) {
    return param || same ? 2 : -Infinity;
}

function segmentPoint(param, wild, same) {
    if (param === wild) return sameTokenScore(param, same);
    return param ? 1 : 0;
}

function segmentScore(segs, routeSeg) {
    let score = 0;
    for (let i = 0; i < routeSeg.length && score >= 0; i += 1) {
        score += segmentPoint(routeSeg[i].startsWith('{'), segs[i] === ':p', routeSeg[i] === segs[i]);
    }
    return score;
}

function routeScore(segs, route, call) {
    const routeSeg = routeSegs(route.path);
    if (routeSeg.length !== segs.length) return -1;
    if (!methodOk(call.method, route.method)) return -1;
    return segmentScore(segs, routeSeg);
}

function betterRoute(best, route, score) {
    if (score > best.score) return { route, score };
    return best;
}

function matchRoute(call, routes) {
    const segs = routeSegs(call.path);
    let best = { route: null, score: -1 };
    for (const route of routes) best = betterRoute(best, route, routeScore(segs, route, call));
    return best.route;
}

function omittedBy(policy) {
    return (id) => policy.omit.some((prefix) => id === prefix || id.startsWith(`${prefix}/`));
}

function blankIr(policy, multi) {
    return {
        title: policy.title,
        root: ROOT,
        multi,
        sources: [],
        proposals: policy.proposals,
        modules: [],
        edges: [],
        foreign: [],
    };
}

function moduleRecord(source, root, local, module, id) {
    const [layer, slice] = local.split('/');
    const rank = source.levels.findIndex((group) => group.includes(layer));
    const file = posix(join(source.root, relative(root, module.path)));
    return { id: id(local), ...module, file, source: source.id, layer, slice, rank };
}

function pushModules(ir, part, source, root, id, keep) {
    for (const { local, ...module } of part.modules) {
        if (!keep.has(id(local))) continue;
        ir.modules.push(moduleRecord(source, root, local, module, id));
    }
}

function edgeEnds(from, to, keep) {
    if (from === to) return null;
    if (!keep.has(from) || !keep.has(to)) return null;
    return [from, to];
}

function addEdge(edges, from, to, type) {
    const key = `${from}|${to}`;
    const prev = edges.get(key);
    if (prev) {
        prev.type &&= type;
        return;
    }
    edges.set(key, { from, to, type, kind: 'import' });
}

function pushEdges(ir, part, id, keep) {
    const edges = new Map();
    for (const edge of part.edges) {
        const ends = edgeEnds(id(edge.from), id(edge.to), keep);
        if (ends) addEdge(edges, ends[0], ends[1], edge.type);
    }
    ir.edges.push(...edges.values());
}

function pushForeign(ir, part, id, keep) {
    const foreign = new Map();
    for (const item of part.foreign) {
        if (keep.has(id(item.from))) foreign.set(`${item.from}|${item.to}`, { from: id(item.from), to: item.to });
    }
    ir.foreign.push(...foreign.values());
}

function pushCalls(allCalls, part, id, keep) {
    allCalls.push(
        ...part.calls.filter((call) => keep.has(id(call.from))).map((call) => ({ ...call, from: id(call.from) })),
    );
}

function routeController(route, id) {
    return route.controller && id(route.controller);
}

function pushRoutes(allRoutes, part, id) {
    allRoutes.push(
        ...part.routes.map((route) => ({ ...route, file: id(route.file), controller: routeController(route, id) })),
    );
}

function absorbSource(ir, source, rootOf, multi, omitted, allCalls, allRoutes) {
    const root = rootOf(source);
    const prefix = multi ? `${source.id}/` : '';
    const id = (local) => prefix + local;
    const part = SCANNERS[source.lang](source, root);
    const keep = new Set(part.modules.map((module) => id(module.local)).filter((item) => !omitted(item)));
    pushModules(ir, part, source, root, id, keep);
    pushEdges(ir, part, id, keep);
    pushForeign(ir, part, id, keep);
    pushCalls(allCalls, part, id, keep);
    pushRoutes(allRoutes, part, id);
    ir.sources.push({ id: source.id, lang: source.lang, isolated: source.isolated, levels: source.levels });
}

function missingRoutesId(multi, backend) {
    return `${multi ? `${backend}/` : ''}routes/${MISSING}`;
}

function httpTarget(route, missingId) {
    if (!route) return missingId;
    return route.controller ?? route.file;
}

function httpLabel(call, route) {
    const matched = route ? `  ⇒ ${route.method} ${route.path}` : '';
    return `${call.method} ${call.path}${matched}`;
}

function rememberHttp(http, call, to, route) {
    const key = `${call.from}|${to}`;
    if (!http.has(key)) http.set(key, { from: call.from, to, type: false, kind: 'http', labels: [] });
    http.get(key).labels.push(httpLabel(call, route));
}

function missingModule(missingId, backend, missing) {
    return {
        id: missingId,
        path: null,
        file: '',
        lang: 'php',
        lines: 0,
        hash: sha(JSON.stringify(missing)),
        source: backend,
        layer: 'routes',
        rank: -1,
        stereotype: 'missing',
        ops: missing.map((call) => ({
            name: `${call.method} ${call.path}`,
            kind: call.from,
            type: false,
            line: call.line,
        })),
    };
}

function recordHttp(http, missing, call, allRoutes, missingId) {
    const route = matchRoute(call, allRoutes);
    if (!route) missing.push(call);
    rememberHttp(http, call, httpTarget(route, missingId), route);
}

function hasHttp(allRoutes, allCalls) {
    return Boolean(allRoutes.length && allCalls.length);
}

function linkHttp(ir, allCalls, allRoutes, multi) {
    if (!hasHttp(allRoutes, allCalls)) return;
    const backend = allRoutes[0].file.split('/')[0];
    const missingId = missingRoutesId(multi, backend);
    const http = new Map();
    const missing = [];
    for (const call of allCalls) recordHttp(http, missing, call, allRoutes, missingId);
    if (missing.length) ir.modules.push(missingModule(missingId, backend, missing));
    ir.edges.push(...http.values());
}

function layerViolation(from, to) {
    if (from.rank < 0 || to.rank < 0) return false;
    return from.rank < to.rank;
}

function sliceViolation(from, to, isolated) {
    if (from.layer !== to.layer || from.slice === to.slice) return false;
    return isolated.get(from.source).includes(from.layer);
}

function rankedViolation(from, to, isolated) {
    if (layerViolation(from, to)) return 'layer';
    if (sliceViolation(from, to, isolated)) return 'slice';
    return null;
}

function violationOf(from, to, isolated) {
    if (to.stereotype === 'missing') return 'no-route';
    if (from.source !== to.source) return null;
    return rankedViolation(from, to, isolated);
}

function markViolations(ir) {
    const byId = new Map(ir.modules.map((module) => [module.id, module]));
    const isolated = new Map(ir.sources.map((source) => [source.id, source.isolated]));
    for (const edge of ir.edges) {
        const kind = violationOf(byId.get(edge.from), byId.get(edge.to), isolated);
        if (kind) edge.violation = kind;
    }
}

export function scan({ rootOf = sourceRoot } = {}) {
    const policy = loadPolicy();
    const sources = policy.sources.filter((source) => existsSync(rootOf(source)));
    const multi = sources.length > 1;
    const ir = blankIr(policy, multi);
    const allCalls = [];
    const allRoutes = [];
    for (const source of sources) absorbSource(ir, source, rootOf, multi, omittedBy(policy), allCalls, allRoutes);
    linkHttp(ir, allCalls, allRoutes, multi);
    markViolations(ir);
    ir.version = sha(JSON.stringify(ir));
    return ir;
}

const git = (cwd, ...cmd) =>
    execFileSync('git', cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function gitTop(cwd) {
    try {
        return realpathSync(git(cwd, 'rev-parse', '--show-toplevel'));
    } catch {
        return null;
    }
}

function ignoredSet(top, absPaths) {
    try {
        const out = execFileSync('git', ['check-ignore', '-z', '--stdin'], {
            cwd: top,
            input: `${absPaths.join('\0')}\0`,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'ignore'],
        });
        return new Set(out.split('\0').filter(Boolean));
    } catch {
        return new Set();
    }
}

function gitIgnoredAbs(cwd, absPaths) {
    if (!absPaths.length) return new Set();
    const top = gitTop(cwd);
    if (!top) return new Set();
    return ignoredSet(top, absPaths);
}

function gitHas(top, base, path) {
    try {
        git(top, 'cat-file', '-t', `${base}:${path}`);
        return true;
    } catch {
        return false;
    }
}

function archivePaths(top, base, out, present) {
    if (!present.length) return;
    execSync(
        `git archive ${base} ${present.map((path) => JSON.stringify(path)).join(' ')} | tar -x -C ${JSON.stringify(out)}`,
        { cwd: top },
    );
}

function checkoutSource(dir, source, ref) {
    const abs = sourceRoot(source);
    if (!existsSync(abs)) return null;
    const top = realpathSync(git(abs, 'rev-parse', '--show-toplevel'));
    const base = git(top, 'merge-base', 'HEAD', ref) || git(top, 'rev-parse', ref);
    const rel = posix(relative(top, abs));
    const out = join(dir, sha(top));
    mkdirSync(out, { recursive: true });
    const wanted = [...source.dirs, 'tsconfig.json', 'composer.json'].map((path) => posix(join(rel, path)));
    archivePaths(
        top,
        base,
        out,
        wanted.filter((path) => gitHas(top, base, path)),
    );
    return { id: source.id, base, root: join(out, rel) };
}

function baseSnapshot(ref) {
    const policy = loadPolicy();
    const dir = mkdtempSync(join(tmpdir(), 'uml-base-'));
    const roots = new Map();
    let base;
    for (const source of policy.sources) {
        const checked = checkoutSource(dir, source, ref);
        if (!checked) continue;
        base = checked.base;
        roots.set(checked.id, checked.root);
    }
    return { base, ir: scan({ rootOf: (source) => roots.get(source.id) ?? join(dir, 'missing') }) };
}

function sourceById(id) {
    return loadPolicy().sources.find((source) => source.id === id);
}

function stripRootName(file, source) {
    const rootName = posix(source.root).replace(/\/$/, '');
    const rel = posix(file);
    if (rootName === '.' || (rel !== rootName && !rel.startsWith(`${rootName}/`))) return rel;
    return rel.slice(rootName.length).replace(/^\//, '');
}

function moduleFile(module) {
    if (!module?.file || !module.source) return null;
    return module.file;
}

function joinedRepoPath(root, source, file) {
    const top = realpathSync(git(root, 'rev-parse', '--show-toplevel'));
    const path = posix(join(posix(relative(top, root)), stripRootName(file, source)));
    if (!path || path === '.') return null;
    return path;
}

function repoPath(module) {
    const file = moduleFile(module);
    const source = file && sourceById(module.source);
    if (!source) return null;
    const root = sourceRoot(source);
    if (!existsSync(root)) return null;
    return joinedRepoPath(root, source, file);
}

function gitDiff(cwd, args) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            maxBuffer: 8e6,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (error) {
        if (error.status !== 1 || typeof error.stdout !== 'string') throw error;
        return error.stdout;
    }
}

function cursorBin() {
    const mac = '/Applications/Cursor.app/Contents/Resources/app/bin/cursor';
    if (process.platform === 'darwin' && existsSync(mac)) return mac;
    return 'cursor';
}

function openInCursor(file, line) {
    return new Promise((ok, fail) => {
        const child = spawn(cursorBin(), ['-g', `${file}:${line}:1`], { stdio: 'ignore' });
        child.on('error', fail);
        child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`cursor exit ${code}`))));
    });
}

function requireResolve(base, spec) {
    try {
        return createRequire(base).resolve(spec);
    } catch {
        return null;
    }
}

function resolvedTsPath(fromModule, spec, root) {
    return resolveTs(spec, fromModule.path, tsAliases(root))?.path ?? null;
}

function nodeResolve(fromModule, spec, root) {
    return requireResolve(fromModule.path, spec) ?? requireResolve(join(root, 'package.json'), spec);
}

function resolveImportAbs(fromModule, spec) {
    const source = sourceById(fromModule.source);
    if (!source || !fromModule.path) return null;
    const root = sourceRoot(source);
    return resolvedTsPath(fromModule, spec, root) ?? nodeResolve(fromModule, spec, root);
}

function symbolRes(name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [
        new RegExp(`^export\\s+(?:declare\\s+)?(?:type|interface|enum|class)\\s+${esc}\\b`, 'm'),
        new RegExp(`^(?:declare\\s+)?(?:type|interface|enum|class)\\s+${esc}\\b`, 'm'),
        new RegExp(`\\b(?:type|interface|enum|class)\\s+${esc}\\b`),
        new RegExp(`\\b${esc}\\b`),
    ];
}

function matchLine(text, re) {
    const match = text.match(re);
    if (!match) return null;
    return lineAt(text, match.index);
}

function firstSymbolLine(text, name) {
    for (const re of symbolRes(name)) {
        const line = matchLine(text, re);
        if (line) return line;
    }
    return null;
}

function findSymbolLine(file, name) {
    if (!name || !existsSync(file)) return 1;
    return firstSymbolLine(readFileSync(file, 'utf8'), name) ?? 1;
}

function realOrSelf(abs) {
    try {
        return realpathSync(abs);
    } catch {
        return abs;
    }
}

function samePath(modulePath, real, abs) {
    if (!modulePath || !existsSync(modulePath)) return false;
    try {
        return realpathSync(modulePath) === real;
    } catch {
        return modulePath === abs;
    }
}

function moduleByAbsPath(ir, abs) {
    if (!abs || !existsSync(abs)) return null;
    const real = realOrSelf(abs);
    return ir.modules.find((module) => samePath(module.path, real, abs)) ?? null;
}

function diffArgs() {
    return ['diff', '--no-color', '--no-ext-diff', '--unified=3'];
}

function canIndexDiff(module, text) {
    if (text.trim()) return false;
    if (module.diff !== 'added') return false;
    return Boolean(module.path && existsSync(module.path));
}

function addedDiff(module, top, args, path, text) {
    if (!canIndexDiff(module, text)) return text;
    return gitDiff(top, [...args, '--no-index', '--', '/dev/null', path]);
}

function clipDiff(text) {
    if (text.length <= 200_000) return text;
    return `${text.slice(0, 200_000)}\n… diff обрезан\n`;
}

function codeDiff(module, base) {
    const path = repoPath(module);
    if (!path || !base) return null;
    const root = sourceRoot(sourceById(module.source));
    const top = realpathSync(git(root, 'rev-parse', '--show-toplevel'));
    const args = diffArgs();
    return {
        file: path,
        text: clipDiff(addedDiff(module, top, args, path, gitDiff(top, [...args, base, '--', path]))),
    };
}

function edgeKey(edge) {
    return `${edge.from}|${edge.to}`;
}

function markModule(module, oldModules) {
    const was = oldModules.get(module.id);
    if (!was) module.diff = 'added';
    else if (was.hash !== module.hash) module.diff = 'changed';
}

function markModules(ir, oldModules) {
    for (const module of ir.modules) markModule(module, oldModules);
}

function pushRemovedModules(ir, old, ids) {
    for (const module of old.modules) if (!ids.has(module.id)) ir.modules.push({ ...module, diff: 'removed' });
}

function freshViolation(edge, was) {
    return Boolean(edge.violation && !was?.violation);
}

function flagEdge(edge, was) {
    if (!was) edge.diff = 'added';
    if (freshViolation(edge, was)) edge.newViolation = true;
}

function markEdges(ir, oldEdges) {
    for (const edge of ir.edges) flagEdge(edge, oldEdges.get(edgeKey(edge)));
}

function pushRemovedEdges(ir, old, keys) {
    for (const edge of old.edges) if (!keys.has(edgeKey(edge))) ir.edges.push({ ...edge, diff: 'removed' });
}

function annotate(ir, snapshot, ref) {
    const { ir: old, base } = snapshot;
    const oldModules = new Map(old.modules.map((module) => [module.id, module]));
    const oldEdges = new Map(old.edges.map((edge) => [edgeKey(edge), edge]));
    const ids = new Set(ir.modules.map((module) => module.id));
    markModules(ir, oldModules);
    pushRemovedModules(ir, old, ids);
    const keys = new Set(ir.edges.map(edgeKey));
    markEdges(ir, oldEdges);
    pushRemovedEdges(ir, old, keys);
    ir.diff = { ref, base: base.slice(0, 10) };
    ir.version = sha(JSON.stringify(ir));
    return ir;
}

function summary(ir) {
    const list = (title, items) =>
        items.length ? `\n### ${title} (${items.length})\n${items.map((x) => `- ${x}`).join('\n')}\n` : '';
    const by = (kind) => ir.modules.filter((m) => m.diff === kind).map((m) => `\`${m.id}\``);
    const edge = (e) => `\`${e.from}\` → \`${e.to}\`${e.kind === 'http' ? ` (http: ${e.labels.join('; ')})` : ''}`;
    return [
        `## Структурный diff: ${ir.diff.ref} (merge-base ${ir.diff.base})`,
        list(
            'Новые нарушения',
            ir.edges.filter((e) => e.newViolation).map((e) => `${e.violation}: ${edge(e)}`),
        ),
        list('Модули добавлены', by('added')),
        list('Модули изменены', by('changed')),
        list('Модули удалены', by('removed')),
        list('Зависимости добавлены', ir.edges.filter((e) => e.diff === 'added').map(edge)),
        list('Зависимости удалены', ir.edges.filter((e) => e.diff === 'removed').map(edge)),
    ].join('\n');
}

function enqueue(file, command) {
    const box = readJson(file, { nextId: 1, queue: [] });
    box.queue.push({ id: box.nextId++, at: new Date().toISOString(), ...command });
    writeJsonAtomic(file, box);
    return box.queue.length;
}

function dequeue(file) {
    const box = readJson(file, null);
    if (!box?.queue?.length) return null;
    const command = box.queue.shift();
    writeJsonAtomic(file, box);
    return command;
}

function readBody(req) {
    return new Promise((ok, fail) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1e5) req.destroy();
        });
        req.on('end', () => ok(body));
        req.on('error', fail);
    });
}

function publishIr(build, state) {
    const next = build();
    if (next.version === state.ir.version) return;
    state.ir = next;
    writeJsonAtomic(IR_FILE, next);
    console.log(`[uml] rescanned ${next.modules.length} modules, ${next.edges.length} edges (${next.version})`);
}

function startRescan(build, state) {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(() => publishIr(build, state), 150);
    };
}

function watchSource(source, rescan) {
    for (const dirName of source.dirs) {
        const dir = join(sourceRoot(source), dirName);
        if (existsSync(dir)) watch(dir, { recursive: true }, rescan);
    }
}

function watchSources(rescan) {
    for (const source of loadPolicy().sources) watchSource(source, rescan);
    watch(ROOT, (_, name) => name === basename(POLICY_FILE) && rescan());
}

function send(res, status, body, type = 'application/json') {
    res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function htmlPage(url) {
    const name = url.pathname === '/guide' ? 'guide.html' : 'viewer.html';
    return readFileSync(join(HERE, name), 'utf8');
}

function apiState(ir) {
    const inbox = readJson(TO_AGENT, { queue: [] }).queue.length;
    return { status: 200, body: { version: ir.version, command: dequeue(TO_VIEWER), inbox } };
}

function apiSource(ir, url) {
    const module = ir.modules.find((item) => item.id === url.searchParams.get('id'));
    if (!module?.path) return { status: 404, body: { error: 'no source' } };
    if (module.binary) return { status: 200, body: { file: module.file, text: '⟨ binary file ⟩\n' } };
    return { status: 200, body: { file: module.file, text: readFileSync(module.path, 'utf8') } };
}

function cursorLine(url) {
    const line = Number(url.searchParams.get('line'));
    if (Number.isInteger(line) && line > 0) return line;
    return 1;
}

function apiOpen(ir, url) {
    const module = ir.modules.find((item) => item.id === url.searchParams.get('id'));
    if (!module?.path || !existsSync(module.path)) return { status: 404, body: { error: 'no source' } };
    return openInCursor(module.path, cursorLine(url)).then(() => ({ status: 200, body: { ok: true } }));
}

function gotoFrom(ir, url) {
    const from = ir.modules.find((item) => item.id === url.searchParams.get('from'));
    const spec = url.searchParams.get('spec');
    if (!from || !spec) return null;
    return { from, spec, name: url.searchParams.get('name') || '' };
}

function gotoAbs(from, spec) {
    const abs = resolveImportAbs(from, spec);
    if (!abs || !existsSync(abs)) return null;
    return abs;
}

async function gotoBody(ir, abs, name) {
    const line = findSymbolLine(abs, name);
    const mod = moduleByAbsPath(ir, abs);
    if (mod) return { status: 200, body: { id: mod.id, line } };
    await openInCursor(abs, line);
    return { status: 200, body: { opened: true, file: abs, line } };
}

function apiGoto(ir, url) {
    const req = gotoFrom(ir, url);
    if (!req) return { status: 404, body: { error: 'no import' } };
    const abs = gotoAbs(req.from, req.spec);
    if (!abs) return { status: 404, body: { error: 'unresolved' } };
    return gotoBody(ir, abs, req.name);
}

function snapshotBase(snapshot) {
    return snapshot?.base ?? null;
}

function moduleDiff(module, base) {
    if (!module) return null;
    return codeDiff(module, base);
}

function apiDiff(ir, snapshot, url) {
    const base = snapshotBase(snapshot);
    if (!base) return { status: 404, body: { error: 'no diff' } };
    const module = ir.modules.find((item) => item.id === url.searchParams.get('id'));
    const diff = moduleDiff(module, base);
    if (!diff) return { status: 404, body: { error: 'no source' } };
    return { status: 200, body: diff };
}

async function apiInbox(req) {
    const { text, context } = JSON.parse(await readBody(req));
    if (!text?.trim()) return { status: 400, body: { error: 'empty note' } };
    return { status: 200, body: { inbox: enqueue(TO_AGENT, { op: 'note', text: text.trim(), context }) } };
}

const PAGE_ROUTES = {
    '/': (ir, url) => ({ status: 200, body: htmlPage(url), type: 'text/html' }),
    '/guide': (ir, url) => ({ status: 200, body: htmlPage(url), type: 'text/html' }),
    '/api/ir': (ir) => ({ status: 200, body: ir }),
    '/api/state': (ir) => apiState(ir),
    '/api/source': (ir, url) => apiSource(ir, url),
    '/api/open': (ir, url) => apiOpen(ir, url),
    '/api/goto': (ir, url) => apiGoto(ir, url),
    '/api/diff': (ir, url, _req, snapshot) => apiDiff(ir, snapshot, url),
};

async function routeResponse(ir, snapshot, req, url) {
    if (url.pathname === '/api/inbox' && req.method === 'POST') return apiInbox(req);
    const handler = PAGE_ROUTES[url.pathname];
    if (!handler) return { status: 404, body: { error: 'not found' } };
    return handler(ir, url, req, snapshot);
}

async function handleRequest(state, snapshot, req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
        const result = await routeResponse(state.ir, snapshot, req, url);
        send(res, result.status, result.body, result.type);
    } catch (error) {
        send(res, 500, { error: String(error) });
    }
}

function logServer(port, ir, ref, open) {
    const url = `http://127.0.0.1:${port}`;
    const diff = ref ? `, diff vs ${ref}` : '';
    console.log(`[uml] ${ir.modules.length} modules, ${ir.edges.length} edges${diff} → ${url}`);
    if (open) spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true });
}

function serve(port, open, ref) {
    const snapshot = ref ? baseSnapshot(ref) : null;
    const build = () => (snapshot ? annotate(scan(), snapshot, ref) : scan());
    const state = { ir: build() };
    writeJsonAtomic(IR_FILE, state.ir);
    watchSources(startRescan(build, state));
    createServer((req, res) => handleRequest(state, snapshot, req, res)).listen(port, '127.0.0.1', () => {
        logServer(port, state.ir, ref, open);
    });
}

const ref = flag('--diff');
if (args.includes('--json') || args.includes('--summary')) {
    const ir = ref ? annotate(scan(), baseSnapshot(ref), ref) : scan();
    process.stdout.write(
        args.includes('--summary') && ir.diff ? `${summary(ir)}\n` : `${JSON.stringify(ir, null, 2)}\n`,
    );
} else if (args.includes('--show')) {
    enqueue(TO_VIEWER, {
        op: 'show',
        path: flag('--show').startsWith('--') ? '' : flag('--show'),
        diagram: flag('--diagram') ?? 'real',
        select: flag('--select') ?? null,
    });
} else serve(Number(flag('--port') ?? 4815), args.includes('--open'), ref);
