import fs from 'node:fs';
import path from 'node:path';
import { parseMcpDump, snapshotToYaml } from './figma-mcp-parse.mjs';

const args = process.argv.slice(2);
const inputArg = args.find((a) => !a.startsWith('--'));
const outArg = getArg('--out');

if (!inputArg) {
    console.error('Usage: pnpm figma:snapshot -- <Block.figma.mcp.yml|Block.figma.yml> [--out <Block.figma.yml>]');
    process.exit(1);
}

const inputPath = path.resolve(inputArg);
if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

let mcpPath = inputPath;
const base = path.basename(inputPath);

if (base.endsWith('.figma.yml') && !base.endsWith('.figma.mcp.yml') && !base.endsWith('.figma.check.yml')) {
    const text = fs.readFileSync(inputPath, 'utf8');
    if (isMcpDump(text)) {
        mcpPath = inputPath.replace(/\.figma\.yml$/, '.figma.mcp.yml');
        if (fs.existsSync(mcpPath)) {
            console.error(`Refusing to overwrite existing MCP dump: ${mcpPath}`);
            process.exit(1);
        }
        fs.renameSync(inputPath, mcpPath);
        console.error(`Renamed MCP dump: ${path.basename(inputPath)} → ${path.basename(mcpPath)}`);
    }
}

const mcpText = fs.readFileSync(mcpPath, 'utf8');
if (!isMcpDump(mcpText)) {
    console.error(`Not an MCP dump (missing NODES: / frame headers): ${mcpPath}`);
    process.exit(1);
}

const snapshot = parseMcpDump(mcpText);
if ('check' in snapshot) {
    console.error('Internal error: snapshot must not contain check');
    process.exit(1);
}

const outPath =
    outArg != null
        ? path.resolve(outArg)
        : mcpPath.replace(/\.figma\.mcp\.yml$/, '.figma.yml').replace(/\.figma\.yml$/, '.figma.yml');

if (path.resolve(outPath) === path.resolve(mcpPath)) {
    console.error('Refuse to overwrite MCP dump with structured snapshot. Pass --out.');
    process.exit(1);
}

fs.writeFileSync(outPath, snapshotToYaml(snapshot), 'utf8');
console.error(`Wrote ${outPath}`);

function getArg(name) {
    const i = args.indexOf(name);
    if (i === -1) return null;
    return args[i + 1] ?? null;
}

function isMcpDump(text) {
    return /^# frame:/m.test(text) && /^NODES:\s*$/m.test(text);
}
