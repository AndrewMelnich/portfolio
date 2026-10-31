import { parseFigmaLink } from './figma-diff-file-key.mjs';

const DEFAULT_TZ = 'Asia/Krasnoyarsk';

function usage() {
    return `Usage:
  pnpm figma:diff -- --since YYYY-MM-DD <figma-frame-or-page-url>
  pnpm figma:diff -- --since YYYY-MM-DD [options]
  pnpm figma:diff -- --before <file.json> --after <file.json> [options]

Snapshot a Figma file at --since (end of that day) and diff it against the
current file. Pass a frame or page link to diff that node in any file.
Same inputs always print byte-identical stdout.

Options:
  --since <date|iso>     Baseline instant. Dates are end-of-day in --tz.
  --until <date|iso>     Diff against this instant instead of the live file.
  --tz <iana>            Default ${DEFAULT_TZ}.
  --url <figma-url>      Frame or page link (file key + node-id). Any file.
  --file-key <key>       Override the link / AGENTS.md / FIGMA_FILE_KEY.
  --page <name|id>       Limit to one canvas.
  --node-ids <id,id>     Limit to these nodes (and descendants).
  --geometry paths       Include vector paths (off by default).
  --json                 Machine-readable report on stdout.
  --out <path>           Also write the report to a file.
  --visual               Overlay before/after screenshots and highlight the difference.
  --visual-dir <path>    Where to write those PNGs. Default <repo>/.figma-diff-cache/visual.
  --before <json>        Fixture: raw GET /v1/files JSON (skip network).
  --after <json>         Fixture: raw GET /v1/files JSON (skip network).
  --cache-dir <dir>      Default <repo>/.figma-diff-cache (gitignored).
  --no-variables         Do not call GET /v1/files/:key/variables/local.
  --help                 Print this help.

Auth: FIGMA_TOKEN, or FIGMA_ACCESS_TOKEN / FIGMA_API_KEY / PUBLIC_FIGMA_TOKEN.
File key: --file-key, else FIGMA_FILE_KEY / PUBLIC_FIGMA_FILE_ID, else the
first figma.com/design URL in AGENTS.md.

Example:
  pnpm figma:diff -- --since 2026-10-02 https://www.figma.com/design/FILE/Name?node-id=1-2
`;
}

function takeFlag(argv, name) {
    const eq = argv.findIndex((a) => a.startsWith(`${name}=`));
    if (eq !== -1) {
        const v = argv[eq].slice(name.length + 1);
        argv.splice(eq, 1);
        return v;
    }
    const i = argv.indexOf(name);
    if (i === -1) {
        return undefined;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('-')) {
        throw new Error(`${name} requires a value`);
    }
    argv.splice(i, 2);
    return v;
}

function takeBool(argv, name) {
    const i = argv.indexOf(name);
    if (i === -1) {
        return false;
    }
    argv.splice(i, 1);
    return true;
}

function readFlags(argv) {
    const since = takeFlag(argv, '--since');
    const until = takeFlag(argv, '--until');
    const timeZone = takeFlag(argv, '--tz') ?? DEFAULT_TZ;
    const urlFlag = takeFlag(argv, '--url');
    const fileKey = takeFlag(argv, '--file-key');
    const page = takeFlag(argv, '--page');
    const nodeIdsRaw = takeFlag(argv, '--node-ids');
    const geometry = takeFlag(argv, '--geometry') ?? 'off';
    const json = takeBool(argv, '--json');
    const out = takeFlag(argv, '--out');
    const visualDir = takeFlag(argv, '--visual-dir');
    const visual = takeBool(argv, '--visual') || Boolean(visualDir);
    const before = takeFlag(argv, '--before');
    const after = takeFlag(argv, '--after');
    const cacheDir = takeFlag(argv, '--cache-dir');
    const noVariables = takeBool(argv, '--no-variables');

    return {
        after,
        before,
        cacheDir,
        fileKey,
        geometry,
        json,
        noVariables,
        nodeIdsRaw,
        out,
        page,
        since,
        timeZone,
        until,
        urlFlag,
        visual,
        visualDir,
    };
}

function assertNoUnknown(argv) {
    const unknown = argv.filter((arg) => arg.startsWith('-'));
    if (unknown.length) {
        throw new Error(`Unknown flag: ${unknown[0]}\n${usage()}`);
    }
}

function takePositionalLink(argv, urlFlag) {
    if (urlFlag && argv.length) {
        throw new Error(`Unexpected argument: ${argv[0]}\n${usage()}`);
    }
    if (!urlFlag && argv.length === 1) {
        const link = argv[0];
        argv.length = 0;
        return link;
    }
    if (argv.length) {
        throw new Error(`Unexpected argument: ${argv[0]}\n${usage()}`);
    }
    return urlFlag ?? null;
}

function parseLinkOrThrow(linkRaw) {
    if (!linkRaw) {
        return null;
    }
    const link = parseFigmaLink(linkRaw);
    if (!link) {
        throw new Error(`Expected a Figma frame or page link, got: ${linkRaw}\n${usage()}`);
    }
    if (!link.nodeId) {
        throw new Error(`Link must point at a frame or page (include node-id).\n${usage()}`);
    }
    return link;
}

function assertGeometry(geometry) {
    if (geometry !== 'off' && geometry !== 'paths') {
        throw new Error('--geometry must be "off" or "paths"');
    }
}

function assertMode(before, after, since) {
    const fixtureMode = Boolean(before || after);
    if (fixtureMode && (!before || !after)) {
        throw new Error('Fixture mode needs both --before and --after');
    }
    if (!fixtureMode && !since) {
        throw new Error(`--since is required (or pass --before and --after)\n${usage()}`);
    }
    return fixtureMode;
}

function splitIds(nodeIdsRaw) {
    if (!nodeIdsRaw) {
        return [];
    }
    return nodeIdsRaw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function wantsHelp(argv) {
    return takeBool(argv, '--help') || takeBool(argv, '-h');
}

export function parseArgs(argvInput) {
    const argv = [...argvInput];
    if (wantsHelp(argv)) {
        return { help: true, usage: usage() };
    }

    const flags = readFlags(argv);
    assertNoUnknown(argv);
    const link = parseLinkOrThrow(takePositionalLink(argv, flags.urlFlag));
    assertGeometry(flags.geometry);
    const fixtureMode = assertMode(flags.before, flags.after, flags.since);
    const nodeIds = splitIds(flags.nodeIdsRaw);

    return {
        after: flags.after,
        before: flags.before,
        cacheDir: flags.cacheDir,
        fileKey: flags.fileKey,
        fixtureMode,
        geometry: flags.geometry,
        help: false,
        json: flags.json,
        link,
        noVariables: flags.noVariables,
        nodeIds,
        out: flags.out,
        page: flags.page,
        since: flags.since,
        timeZone: flags.timeZone,
        until: flags.until,
        usage: usage(),
        visual: flags.visual,
        visualDir: flags.visualDir,
    };
}
