import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { diffSnapshots } from '../figma-diff-differ.mjs';
import { normalizeFile } from '../figma-diff-normalize.mjs';
import { buildReportModel, renderJson, renderMarkdown } from '../figma-diff-report.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (name: string) => JSON.parse(readFileSync(path.join(root, '__fixtures__/figma-diff', name), 'utf8'));

function loadPair() {
    const before = normalizeFile(fixture('before.json'), { fileKey: 'testFileKey123' });
    const after = normalizeFile(fixture('after.json'), { fileKey: 'testFileKey123' });

    return { after, before, diff: diffSnapshots(before, after) };
}

describe('diffSnapshots', () => {
    it('classifies added, removed, renamed, moved, and property paths', () => {
        const { diff } = loadPair();

        expect(diff.added).toEqual([{ id: '1:4', name: 'NewBadge', type: 'FRAME' }]);
        expect(diff.removed).toEqual([{ id: '1:3', name: 'OldButton', type: 'FRAME' }]);
        expect(diff.renamed).toEqual([{ after: 'Headline', before: 'Title', id: '1:2', type: 'TEXT' }]);
        expect(diff.moved).toEqual([
            {
                from: { pageId: '0:1', parentId: '1:10', parentName: 'Footer' },
                id: '1:11',
                name: 'Copy',
                to: { pageId: '0:1', parentId: '1:1', parentName: 'Hero' },
                type: 'TEXT',
            },
        ]);

        const hero = diff.changed.find((c) => c.id === '1:1');

        expect(hero?.paths).toEqual([{ after: 0.5, before: 0.4, path: 'fills[0].color.r' }]);

        const title = diff.changed.find((c) => c.id === '1:2');

        expect(title?.paths).toEqual([{ after: 'Hi', before: 'Hello', path: 'characters' }]);

        expect(diff.changed.some((c) => c.paths.some((p) => p.path === 'children'))).toBe(false);
        expect(diff.changed.some((c) => c.id === '1:11')).toBe(false);
        expect(diff.changed.some((c) => c.id === '9:1')).toBe(false);

        expect(diff.components.changed[0]).toMatchObject({ id: '2:1', name: 'Button' });
        expect(diff.components.changed[0].paths).toEqual([{ after: 'Primary', before: '', path: 'description' }]);
        expect(diff.styles.added[0]).toMatchObject({ id: 'S:2', name: 'White' });
        expect(diff.variables.added[0]).toMatchObject({ id: 'VariableID:2', name: 'fg' });
        expect(diff.variables.changed[0].paths).toEqual([{ after: 0.9, before: 1, path: 'valuesByMode.m1.r' }]);
    });

    it('treats sibling reorder of the same child set as a children path change', () => {
        const before = {
            nodes: {
                p: { children: ['a', 'b'], id: 'p', name: 'P', pageId: '0:1', parentId: '0:1', type: 'FRAME' },
                a: { children: [], id: 'a', name: 'A', pageId: '0:1', parentId: 'p', type: 'TEXT' },
                b: { children: [], id: 'b', name: 'B', pageId: '0:1', parentId: 'p', type: 'TEXT' },
            },
            components: {},
            componentSets: {},
            styles: {},
            variables: {},
            variableCollections: {},
        };
        const after = {
            ...before,
            nodes: {
                ...before.nodes,
                p: { ...before.nodes.p, children: ['b', 'a'] },
            },
        };

        const diff = diffSnapshots(before, after);

        expect(diff.moved).toEqual([]);
        expect(diff.added).toEqual([]);
        expect(diff.removed).toEqual([]);
        expect(diff.changed).toEqual([
            {
                id: 'p',
                name: 'P',
                paths: [{ after: ['b', 'a'], before: ['a', 'b'], path: 'children' }],
                type: 'FRAME',
            },
        ]);
    });
});

describe('report', () => {
    it('groups by page/frame, prints deep links, and is byte-identical across renders', () => {
        const { after, before, diff } = loadPair();
        const model = buildReportModel({
            after,
            baseline: { createdAt: before.lastModified, id: before.versionId, label: null },
            before,
            current: { createdAt: after.lastModified, id: after.versionId, label: null },
            diff,
            fileKey: 'testFileKey123',
            fileName: after.fileName,
            since: '2026-09-28',
            sinceInstantMs: Date.parse('2026-09-28T16:59:59.999Z'),
            timeZone: 'Asia/Krasnoyarsk',
        });
        const md = renderMarkdown(model);
        const json = renderJson(model);

        expect(md).toBe(renderMarkdown(model));
        expect(json).toBe(renderJson(model));
        expect(md).toContain('https://www.figma.com/design/testFileKey123?node-id=1-1');
        expect(md).toContain('https://www.figma.com/design/testFileKey123?node-id=1-4');
        expect(md).toContain('## Page: Home (`0:1`)');
        expect(md).toContain('### Frame: Hero (`1:1`)');
        expect(md).toContain('`Title` → `Headline` (`1:2`)');
        expect(md).not.toContain('Parked');
        expect(json).toContain('"schemaVersion": 1');
        expect(json.endsWith('\n')).toBe(true);
    });
});
