import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { filterSnapshot, normalizeFile } from '../figma-diff-normalize.mjs';
import { stableStringify } from '../figma-diff-util.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const beforeRaw = JSON.parse(readFileSync(path.join(root, '__fixtures__/figma-diff/before.json'), 'utf8'));

describe('normalizeFile', () => {
    it('drops volatile file and node fields, rounds floats, flattens children', () => {
        const snap = normalizeFile(beforeRaw, { fileKey: 'testFileKey123' });

        expect(snap.schemaVersion).toBe(1);
        expect(snap.fileKey).toBe('testFileKey123');
        expect(snap.fileName).toBe('Lux');
        expect(snap.versionId).toBe('100');
        expect(snap.lastModified).toBe('2026-09-28T10:00:00Z');
        expect(snap).not.toHaveProperty('thumbnailUrl');
        expect(snap).not.toHaveProperty('role');

        const hero = snap.nodes['1:1'];

        expect(hero.parentId).toBe('0:1');
        expect(hero.pageId).toBe('0:1');
        expect(hero.children).toEqual(['1:2', '1:3']);
        expect(hero.fills[0].color.r).toBe(0.4);
        expect(hero).not.toHaveProperty('absoluteRenderBounds');
        expect(hero).not.toHaveProperty('pluginData');

        expect(snap.nodes['1:2'].parentId).toBe('1:1');
        expect(snap.nodes['0:1'].type).toBe('CANVAS');
        expect(snap.components['2:1'].name).toBe('Button');
    });

    it('emits byte-identical JSON for the same fixture, even if key order changes', () => {
        const shuffled = {
            version: beforeRaw.version,
            document: beforeRaw.document,
            name: beforeRaw.name,
            styles: beforeRaw.styles,
            lastModified: beforeRaw.lastModified,
            thumbnailUrl: beforeRaw.thumbnailUrl,
            components: beforeRaw.components,
            role: beforeRaw.role,
            variables: beforeRaw.variables,
            editorType: beforeRaw.editorType,
            linkAccess: beforeRaw.linkAccess,
            componentSets: beforeRaw.componentSets,
            variableCollections: beforeRaw.variableCollections,
        };
        const a = stableStringify(normalizeFile(beforeRaw, { fileKey: 'k' }));
        const b = stableStringify(normalizeFile(shuffled, { fileKey: 'k' }));
        const c = stableStringify(normalizeFile(beforeRaw, { fileKey: 'k' }));

        expect(a).toBe(b);
        expect(a).toBe(c);
        expect(a.endsWith('\n')).toBe(true);
        expect(a.includes('thumbnailUrl')).toBe(false);
        expect(a.includes('absoluteRenderBounds')).toBe(false);
    });

    it('filterSnapshot --page keeps that canvas subtree only', () => {
        const snap = normalizeFile(beforeRaw, { fileKey: 'k' });
        const home = filterSnapshot(snap, { page: 'Home' });

        expect(home.nodes['0:1'].name).toBe('Home');
        expect(home.nodes['1:1']).toBeTruthy();
        expect(home.nodes['9:1']).toBeUndefined();
        expect(home.nodes['0:2']).toBeUndefined();
    });
});
