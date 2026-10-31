import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../figma-diff-args.mjs';
import { parseFigmaLink, parseFileKeyFromText, resolveFileKey } from '../figma-diff-file-key.mjs';
import { runDiff } from '../figma-diff-run.mjs';
import { parseInstant, zonedEndOfDayMs } from '../figma-diff-time.mjs';
import { pageExhaustsSearch, pickLatestOnOrBefore } from '../figma-diff-versions.mjs';

const scripts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(scripts, '__fixtures__/figma-diff');
const cli = path.join(scripts, 'figma-diff.mjs');

function runCli(args: string[]) {
    return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

describe('time', () => {
    it('maps YYYY-MM-DD to end of day in Asia/Krasnoyarsk', () => {
        expect(zonedEndOfDayMs('2026-09-28', 'Asia/Krasnoyarsk')).toBe(Date.parse('2026-09-28T16:59:59.999Z'));
        expect(zonedEndOfDayMs('2026-09-28', 'UTC')).toBe(Date.parse('2026-09-28T23:59:59.999Z'));
        expect(parseInstant('2026-09-28T10:00:00Z', 'UTC', '--since').instantMs).toBe(
            Date.parse('2026-09-28T10:00:00Z'),
        );
    });
});

describe('pickLatestOnOrBefore', () => {
    const versions = JSON.parse(readFileSync(path.join(fixtures, 'versions.json'), 'utf8')).versions;

    it('picks the latest version at or before the instant', () => {
        const end = Date.parse('2026-09-28T16:59:59.999Z');

        expect(pickLatestOnOrBefore(versions, end).id).toBe('100');
        expect(pickLatestOnOrBefore(versions, Date.parse('2026-09-27T23:59:59.999Z')).id).toBe('90');
        expect(pickLatestOnOrBefore(versions, Date.parse('2026-09-01T00:00:00Z'))).toBeNull();
        expect(pickLatestOnOrBefore(versions, Date.parse('2026-10-12T09:00:00Z')).id).toBe('200');
    });

    it('stops pagination only once order and the since boundary are known', () => {
        const since = Date.parse('2026-09-28T16:59:59.999Z');

        expect(pageExhaustsSearch(versions, since)).toBe(true);
        expect(pageExhaustsSearch([versions[0], versions[1]], since)).toBe(false);
        expect(pageExhaustsSearch([...versions].reverse(), since)).toBe(true);
        expect(pageExhaustsSearch([versions[3], versions[2]], since)).toBe(false);
        expect(pageExhaustsSearch([versions[0]], since)).toBe(false);
    });
});

describe('file key', () => {
    it('reads the first figma.com/design key from AGENTS.md text', () => {
        const text = '# Monorepo\n\nFile: https://www.figma.com/design/u7u8ZErBchKM06eoxWOF9p/Lux\n';

        expect(parseFileKeyFromText(text)).toBe('u7u8ZErBchKM06eoxWOF9p');
        expect(
            resolveFileKey({
                agentsTexts: [text],
                env: {},
                flag: 'flagKey',
            }),
        ).toBe('flagKey');
        expect(
            resolveFileKey({
                agentsTexts: [text],
                env: { FIGMA_FILE_KEY: 'envKey' },
                flag: undefined,
            }),
        ).toBe('envKey');
        expect(resolveFileKey({ agentsTexts: [text], env: {}, flag: undefined })).toBe('u7u8ZErBchKM06eoxWOF9p');
    });
});

describe('figma link', () => {
    it('reads a frame or page node from any file url', () => {
        expect(parseFigmaLink('https://www.figma.com/design/abcDEF123/Any?node-id=12-34')).toEqual({
            fileKey: 'abcDEF123',
            nodeId: '12:34',
        });
        expect(parseFigmaLink('https://www.figma.com/design/abcDEF123/Any?node-id=0%3A1')).toEqual({
            fileKey: 'abcDEF123',
            nodeId: '0:1',
        });
        expect(parseFigmaLink('https://www.figma.com/design/fileKey/branch/branchKey/Any?node-id=8-8')).toEqual({
            fileKey: 'branchKey',
            nodeId: '8:8',
        });
        expect(parseFigmaLink('https://www.figma.com/design/abcDEF123/Any')).toEqual({
            fileKey: 'abcDEF123',
            nodeId: null,
        });
        expect(parseFigmaLink('https://example.com/design/abcDEF123/Any?node-id=1-2')).toBeNull();
    });

    it('scopes a frame link and a page link to different nodes', () => {
        const frame = runCli([
            '--before',
            path.join(fixtures, 'before.json'),
            '--after',
            path.join(fixtures, 'after.json'),
            '--since',
            '2026-09-28',
            'https://www.figma.com/design/fromLinkKey/Any?node-id=1-1',
        ]);
        const page = runCli([
            '--before',
            path.join(fixtures, 'before.json'),
            '--after',
            path.join(fixtures, 'after.json'),
            '--since',
            '2026-09-28',
            '--url',
            'https://www.figma.com/design/fromLinkKey/Any?node-id=0-2',
        ]);

        expect(frame.status).toBe(0);
        expect(frame.stdout).toContain('File: `fromLinkKey`');
        expect(frame.stdout).toContain('Scope: frame `Hero` (`1:1`)');
        expect(frame.stdout).toContain('NewBadge');
        expect(frame.stdout).not.toContain('Parked');

        expect(page.status).toBe(0);
        expect(page.stdout).toContain('Scope: page `Unused` (`0:2`)');
        expect(page.stdout).not.toContain('NewBadge');
        expect(page.stdout).toBe(
            runCli([
                '--before',
                path.join(fixtures, 'before.json'),
                '--after',
                path.join(fixtures, 'after.json'),
                '--since',
                '2026-09-28',
                '--url',
                'https://www.figma.com/design/fromLinkKey/Any?node-id=0-2',
            ]).stdout,
        );
    });

    it('exits 1 when the linked node is missing', () => {
        const r = runCli([
            '--before',
            path.join(fixtures, 'before.json'),
            '--after',
            path.join(fixtures, 'after.json'),
            'https://www.figma.com/design/fromLinkKey/Any?node-id=99-99',
        ]);

        expect(r.status).toBe(1);
        expect(r.stderr).toContain('99:99');
    });

    it('rejects a file link with no node-id', () => {
        expect(() => parseArgs(['--since', '2026-10-02', 'https://www.figma.com/design/abc/Any'])).toThrow(/node-id/);
    });
});

describe('cli fixtures', () => {
    const common = [
        '--before',
        path.join(fixtures, 'before.json'),
        '--after',
        path.join(fixtures, 'after.json'),
        '--file-key',
        'testFileKey123',
        '--since',
        '2026-09-28',
        '--tz',
        'Asia/Krasnoyarsk',
    ];

    it('prints byte-identical markdown on two runs', () => {
        const a = runCli(common);
        const b = runCli(common);

        expect(a.status).toBe(0);
        expect(a.stderr).toBe('');
        expect(a.stdout).toBe(b.stdout);
        expect(a.stdout.startsWith('# Figma diff\n')).toBe(true);
        expect(a.stdout).toContain('added: 1');
        expect(a.stdout).toContain('`Title` → `Headline` (`1:2`)');
    });

    it('prints byte-identical JSON on two runs', () => {
        const a = runCli([...common, '--json']);
        const b = runCli([...common, '--json']);

        expect(a.status).toBe(0);
        expect(a.stdout).toBe(b.stdout);
        const parsed = JSON.parse(a.stdout);

        expect(parsed.schemaVersion).toBe(1);
        expect(parsed.fileKey).toBe('testFileKey123');
        expect(parsed.sinceInstant).toBe('2026-09-28T16:59:59.999Z');
        expect(parsed.summary).toEqual({ added: 1, changed: 2, moved: 1, removed: 1, renamed: 1 });
    });

    it('ignores a leftover -- from pnpm', () => {
        const r = runCli([
            '--',
            '--before',
            path.join(fixtures, 'before.json'),
            '--after',
            path.join(fixtures, 'after.json'),
            '--file-key',
            'testFileKey123',
            '--since',
            '2026-09-28',
        ]);

        expect(r.status).toBe(0);
        expect(r.stdout).toContain('added: 1');
    });

    it('exits 2 without --since in live mode', () => {
        const r = runCli([]);

        expect(r.status).toBe(2);
        expect(r.stderr).toContain('--since is required');
    });
});

describe('runDiff mocked Figma API', () => {
    it('selects the latest version on or before --since and diffs against current', async () => {
        const before = JSON.parse(readFileSync(path.join(fixtures, 'before.json'), 'utf8'));
        const after = JSON.parse(readFileSync(path.join(fixtures, 'after.json'), 'utf8'));
        const versions = JSON.parse(readFileSync(path.join(fixtures, 'versions.json'), 'utf8'));
        const cacheDir = mkdtempSync(path.join(tmpdir(), 'figma-diff-'));
        const fetchImpl = async (url: string) => {
            const u = String(url);

            if (u.includes('/versions')) {
                return jsonRes(versions);
            }

            if (u.includes('version=100')) {
                return jsonRes(before);
            }

            if (/\/v1\/files\/[^/?]+$/.test(u) || /\/v1\/files\/[^?]+$/.test(u.split('?')[0] ?? '')) {
                return jsonRes(after);
            }
            throw new Error(`unexpected fetch ${u}`);
        };
        const args = parseArgs([
            '--since',
            '2026-09-28',
            '--file-key',
            'testFileKey123',
            '--json',
            '--no-variables',
            '--cache-dir',
            cacheDir,
        ]);
        const first = await runDiff(args, { agentsTexts: [], env: { FIGMA_TOKEN: 'test' }, fetchImpl });
        const second = await runDiff(args, { agentsTexts: [], env: { FIGMA_TOKEN: 'test' }, fetchImpl });

        expect(first.model.baseline.id).toBe('100');
        expect(first.model.current.id).toBe('200');
        expect(first.output).toBe(second.output);
        expect(JSON.parse(first.output).summary.added).toBe(1);
    });
});

function jsonRes(body: unknown) {
    return {
        headers: { get: () => null },
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
    };
}
