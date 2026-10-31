import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseMcpDump, snapshotToYaml } from '../figma-mcp-parse.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'figma-section-css-tree.mjs');
const fixtureHtml = path.join(root, '__fixtures__/figma-css-tree/section.html');
const miniSnap = path.join(root, '__fixtures__/figma-mcp/mini.figma.yml');
const miniMcp = path.join(root, '__fixtures__/figma-mcp/mini.figma.mcp.yml');
const hasChromium = fs.existsSync(chromium.executablePath());

beforeAll(() => {
    const snap = parseMcpDump(fs.readFileSync(miniMcp, 'utf8'));

    fs.writeFileSync(miniSnap, snapshotToYaml(snap));
});

describe.skipIf(!hasChromium)('figma:css-tree CLI', () => {
    it('dumps tree from fixture HTML at designedWidth viewport', { timeout: 60_000 }, () => {
        const res = spawnSync(
            process.execPath,
            [cli, '--url', fixtureHtml, '--selector', '.fixture-block', '--snapshot', miniSnap, '--frame', 'desktop'],
            { encoding: 'utf8', cwd: root, timeout: 60_000 },
        );

        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toMatch(/viewportWidth:\s*963/);
        expect(res.stdout).toContain('fixture-block');
        expect(res.stdout).toMatch(/\bgap:\s*['"]?30px/);
    });

    it('unreachable --url → non-zero exit + message', () => {
        const res = spawnSync(
            process.execPath,
            [cli, '--url', 'http://127.0.0.1:9/', '--selector', '.x', '--width', '390'],
            { encoding: 'utf8', cwd: root },
        );

        expect(res.status).not.toBe(0);
        expect(`${res.stderr}${res.stdout}`).toMatch(/unreachable|ECONNREFUSED|Timeout/i);
    });
});
