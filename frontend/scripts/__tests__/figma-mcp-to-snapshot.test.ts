import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    parseAttrs,
    parseMcpDump,
    parseNodeLine,
    resolveCheckFrom,
    snapshotToYaml,
    validateCheckDoc,
} from '../figma-mcp-parse.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniMcp = readFileSync(path.join(root, '__fixtures__/figma-mcp/mini.figma.mcp.yml'), 'utf8');

describe('figma-mcp normalize contract', () => {
    it('layout=layout_* → ref string; layout={…} → object; keeps px strings', () => {
        const ref = parseNodeLine('[TEXT] #1:1 layout=layout_abc fills=Black');

        expect(ref.layout).toBe('layout_abc');

        const inline = parseNodeLine(
            '[FRAME] "Root" #1:100 layout={"mode":"none","designedWidth":"963px"} fills=Black',
        );

        expect(inline.layout).toEqual({ mode: 'none', designedWidth: '963px' });
        expect(typeof (inline.layout as { designedWidth: string }).designedWidth).toBe('string');
    });

    it('parses IMAGE-SVG type with hyphen', () => {
        const node = parseNodeLine(
            '[IMAGE-SVG] "Vector" #649:5395 layout={"mode":"none","sizing":{},"locationRelativeToParent":{"x":30,"y":20},"dimensions":{"width":182,"height":130}} fills="White BG"',
        );

        expect(node.type).toBe('IMAGE-SVG');
        expect(node.id).toBe('649:5395');
        expect((node.layout as { dimensions: { width: number } }).dimensions.width).toBe(182);
    });

    it('opacity: float as MCP emits', () => {
        const node = parseNodeLine(
            '[TEXT] #1:201 layout=layout_abc fills="White BG" opacity=0.4000000059604645 textStyle=Desktop/Txt/Body text="Label:"',
        );

        expect(node.opacity).toBe(0.4000000059604645);
    });

    it('GLOBAL_VARS via YAML types', () => {
        const snap = parseMcpDump(miniMcp);
        const body = snap.frames.desktop.globalVars['Desktop/Txt/Body'] as { fontSize: number };
        const layoutAbc = snap.frames.desktop.globalVars.layout_abc as {
            sizing: { horizontal: string };
        };

        expect(snap.frames.desktop.globalVars.Black).toEqual(['#282828']);
        expect(body.fontSize).toBe(17);
        expect(layoutAbc.sizing.horizontal).toBe('fill');
    });
});

describe('parseMcpDump (oracle = mcp)', () => {
    it('builds frames + meta; no check key', () => {
        const snap = parseMcpDump(miniMcp);

        expect(snap.fileKey).toBe('testFileKey123');
        expect(snap.fileName).toBe('Demo File');
        expect(snap.fetchedAt).toBe('2026-09-27');
        expect(snap.frames.desktop.nodeId).toBe('1:100');
        expect(snap.frames.desktop.designedWidth).toBe(963);
        expect(snap.frames.desktop.designedHeight).toBe(850);
        expect(snap.frames.tablet.designedHeight).toBe(1423);
        expect(snap).not.toHaveProperty('check');

        const intro = snap.frames.desktop.tree.children![0]!;
        const layout = intro.layout as { gap: string };

        expect(intro.id).toBe('1:200');
        expect(layout.gap).toBe('10px');
        expect(intro.children![0]!.opacity).toBe(0.4000000059604645);
        expect(intro.children![0]!.layout).toBe('layout_abc');

        const el = snap.frames.tablet.elements!['EL-aaaa'] as { type: string };

        expect(el.type).toBe('RECTANGLE');
        expect(snap.frames.tablet.tree.children![1]!.template).toBe('EL-aaaa');
    });

    it('snapshotToYaml round-trips without check', () => {
        const snap = parseMcpDump(miniMcp);
        const yml = snapshotToYaml(snap);

        expect(yml).not.toMatch(/^check:/m);
        expect(yml).toMatch(/fileKey:\s*"?testFileKey123"?/);
    });
});

describe('parseAttrs', () => {
    it('parses mixed quoted / json / bare', () => {
        const attrs = parseAttrs(
            'layout={"mode":"column","gap":"10px"} fills="White BG" opacity=0.8 textStyle=Desktop/Txt/Body text="Hi"',
        );

        expect(attrs.layout).toEqual({ mode: 'column', gap: '10px' });
        expect(attrs.fills).toBe('White BG');
        expect(attrs.opacity).toBe(0.8);
        expect(attrs.textStyle).toBe('Desktop/Txt/Body');
        expect(attrs.text).toBe('Hi');
    });
});

describe('check schema helpers', () => {
    it('resolveCheckFrom + validateCheckDoc + map (any selector↔node)', () => {
        const snap = parseMcpDump(miniMcp);
        const resolved = resolveCheckFrom(snap, '1:200.layout.gap');

        expect(resolved.ok).toBe(true);

        if (resolved.ok) expect(resolved.value).toBe('10px');

        const good = validateCheckDoc(
            {
                version: 1,
                map: {
                    desktop: {
                        '.fixture-block': '1:100',
                        '.fixture-block__intro': '1:200',
                    },
                },
                desktop: {
                    introGap: { value: '10px', from: '1:200.layout.gap' },
                },
            },
            snap,
        );

        expect(good.ok).toBe(true);

        const badOverride = validateCheckDoc(
            {
                version: 1,
                desktop: {
                    introGap: { value: '99px', from: '1:200.layout.gap', override: true },
                },
            },
            snap,
        );

        expect(badOverride.ok).toBe(false);
        expect(badOverride.errors.some((e) => e.includes('reason'))).toBe(true);

        const withAlt = validateCheckDoc(
            {
                version: 1,
                desktopAlt: { x: { value: 1, from: '1:200.layout.gap' } },
            },
            snap,
        );

        expect(withAlt.ok).toBe(false);
        expect(withAlt.errors.some((e) => e.includes('desktopAlt'))).toBe(true);

        const badMap = validateCheckDoc(
            {
                version: 1,
                map: { desktop: { '.x': '9:9' } },
                desktop: {
                    introGap: { value: '10px', from: '1:200.layout.gap' },
                },
            },
            snap,
        );

        expect(badMap.ok).toBe(false);
        expect(badMap.errors.some((e) => e.includes('map.desktop'))).toBe(true);
    });
});
