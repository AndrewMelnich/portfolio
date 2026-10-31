#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseArgs } from './figma-diff-args.mjs';
import { runDiff } from './figma-diff-run.mjs';
import { writeVisualDiff } from './figma-diff-visual.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(frontendRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(frontendRoot, '.env.local'), quiet: true });

function fail(code, err) {
    console.error(err.message);
    process.exitCode = code;
}

function readArgs(argv) {
    try {
        return parseArgs(argv);
    } catch (err) {
        fail(2, err);
        return null;
    }
}

function writeOutput(args, output) {
    process.stdout.write(output);
    if (!args.out) {
        return;
    }
    const abs = path.resolve(args.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, output);
}

function visualAfterVersion(args, model) {
    if (!args.until) {
        return null;
    }
    return model.current.id;
}

async function emitVisual(args, model) {
    if (!args.visual) {
        return;
    }
    if (args.fixtureMode) {
        throw new Error('--visual needs a live Figma file, not --before/--after');
    }
    const visual = await writeVisualDiff({
        afterVersion: visualAfterVersion(args, model),
        beforeVersion: model.baseline.id,
        model,
        outDir: args.visualDir,
    });
    process.stderr.write(visual);
}

async function emitDiff(args) {
    const { model, output } = await runDiff(args);
    writeOutput(args, output);
    await emitVisual(args, model);
}

async function runMain(args) {
    if (args.help) {
        process.stdout.write(args.usage);
        return;
    }
    try {
        await emitDiff(args);
    } catch (err) {
        fail(1, err);
    }
}

async function main(argv) {
    const args = readArgs(argv);
    if (!args) {
        return;
    }
    await runMain(args);
}

await main(process.argv.slice(2).filter((arg) => arg !== '--'));
