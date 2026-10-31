#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

const MEASURE_PY = `
from fontTools.ttLib import TTFont
import sys
path = sys.argv[1]
font = TTFont(path)
upem = font["head"].unitsPerEm
cmap = font.getBestCmap()
if cmap is None or ord("0") not in cmap:
    raise SystemExit("font has no cmap entry for digit 0")
g = cmap[ord("0")]
name = font.getGlyphOrder()[g] if isinstance(g, int) else g
adv, _ = font["hmtx"][name]
print(adv / upem)
`;

function usage(exitCode = 2) {
    console.error(`Usage:
  ch-from-px.mjs <px> --size <fontSizePx> --font <ttf|otf|woff|woff2>
  ch-from-px.mjs <px> --size <fontSizePx> --zero-em <n>
  ch-from-px.mjs --measure-zero-em --font <path>
  ch-from-px.mjs --self-test

Formula: ch = px / (fontSizePx × zeroAdvanceEm)
  zeroAdvanceEm = hmtx("0") / unitsPerEm  (from --font, or pass --zero-em)

Never use px / fontSize — that treats ch as em.`);
    process.exit(exitCode);
}

function takeFlag(argv, name) {
    const i = argv.indexOf(name);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    argv.splice(i, 2);
    return v;
}

function parseArgs(argv) {
    const args = [...argv];
    if (args.includes('--self-test')) {
        return { mode: 'self-test' };
    }

    const measure = args.includes('--measure-zero-em');
    if (measure) {
        args.splice(args.indexOf('--measure-zero-em'), 1);
    }

    const font = takeFlag(args, '--font');
    const zeroEmRaw = takeFlag(args, '--zero-em');
    const sizeRaw = takeFlag(args, '--size');

    if (args.some((a) => a.startsWith('-'))) {
        usage();
    }

    if (measure) {
        if (!font || args.length) usage();
        return { mode: 'measure', font };
    }

    const px = Number(args[0]);
    const size = sizeRaw === undefined ? NaN : Number(sizeRaw);
    const zeroEm = zeroEmRaw === undefined ? undefined : Number(zeroEmRaw);

    if (args.length !== 1 || !Number.isFinite(px) || px <= 0) usage();
    if (!Number.isFinite(size) || size <= 0) {
        console.error('Error: --size <fontSizePx> is required');
        usage();
    }
    if (font && zeroEmRaw !== undefined) {
        console.error('Error: pass either --font or --zero-em, not both');
        usage();
    }
    if (!font && zeroEmRaw === undefined) {
        console.error('Error: pass --font <path> or --zero-em <n> for the text face');
        usage();
    }
    if (zeroEmRaw !== undefined && (!Number.isFinite(zeroEm) || zeroEm <= 0)) {
        console.error('Error: --zero-em must be a positive number (e.g. 0.5 or 0.8)');
        usage();
    }

    return { mode: 'convert', px, size, font, zeroEm };
}

function assertReadable(path) {
    try {
        accessSync(path, constants.R_OK);
    } catch {
        console.error(`Error: cannot read font file: ${path}`);
        process.exit(2);
    }
}

function measureZeroEm(fontPath) {
    assertReadable(fontPath);
    const result = spawnSync('python3', ['-c', MEASURE_PY, fontPath], {
        encoding: 'utf8',
    });
    if (result.error) {
        console.error(`Error: python3 failed: ${result.error.message}`);
        process.exit(2);
    }
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim();
        console.error(
            `Error: measuring "0" advance failed${detail ? `: ${detail}` : ''}\n` +
                'Install: python3 -m pip install "fonttools[woff]"',
        );
        process.exit(2);
    }
    const zeroEm = Number(result.stdout.trim());
    if (!Number.isFinite(zeroEm) || zeroEm <= 0) {
        console.error(`Error: invalid zero-em from font: ${result.stdout.trim()}`);
        process.exit(2);
    }
    return zeroEm;
}

function pxToCh(px, fontSizePx, zeroEm) {
    return px / (fontSizePx * zeroEm);
}

function formatCh(ch) {
    return `${Number(ch.toFixed(4))}ch`;
}

function selfTest() {
    let failed = 0;
    const cases = [
        { px: 315, size: 12, zeroEm: 0.8, expect: 32.8125 },
        { px: 270, size: 18, zeroEm: 0.8, expect: 18.75 },
        { px: 100, size: 10, zeroEm: 0.5, expect: 20 },
    ];

    for (const { px, size, zeroEm, expect } of cases) {
        const got = pxToCh(px, size, zeroEm);
        const wrongEm = px / size;
        if (Math.abs(got - expect) > 1e-9) {
            console.error(`FAIL px=${px} size=${size} zeroEm=${zeroEm}: got ${got}, expect ${expect}`);
            failed += 1;
        }
        if (Math.abs(got - wrongEm) < 1e-9 && zeroEm !== 1) {
            console.error(`FAIL px=${px}: result equals px/fontSize (ch≠em bug)`);
            failed += 1;
        }
    }

    const mono = pxToCh(120, 12, 1);
    if (Math.abs(mono - 10) > 1e-9) {
        console.error(`FAIL zeroEm=1: got ${mono}, expect 10`);
        failed += 1;
    }

    if (failed) process.exit(1);
    console.log('ok');
}

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'self-test') {
    selfTest();
} else if (args.mode === 'measure') {
    process.stdout.write(`${Number(measureZeroEm(args.font).toFixed(6))}\n`);
} else {
    const zeroEm = args.font ? measureZeroEm(args.font) : args.zeroEm;
    process.stdout.write(`${formatCh(pxToCh(args.px, args.size, zeroEm))}\n`);
}
