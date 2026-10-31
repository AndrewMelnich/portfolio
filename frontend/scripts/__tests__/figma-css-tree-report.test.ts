import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { compareCssTreeToCheck } from '../figma-css-tree-compare.mjs';
import { parseMcpDump, snapshotToYaml } from '../figma-mcp-parse.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'figma-css-tree-report.mjs');
const template = path.join(root, 'assets/qa-report-template.html');
const miniMcp = path.join(root, '__fixtures__/figma-mcp/mini.figma.mcp.yml');
const miniSnap = path.join(root, '__fixtures__/figma-mcp/mini.figma.yml');
const miniCheck = path.join(root, '__fixtures__/figma-mcp/mini.figma.check.yml');
const miniTree = path.join(root, '__fixtures__/figma-css-tree/mini.css-tree.yml');
const outHtml = path.join(root, '__fixtures__/figma-css-tree/mini.css-tree.report.html');

beforeAll(() => {
    const snap = parseMcpDump(fs.readFileSync(miniMcp, 'utf8'));

    fs.writeFileSync(miniSnap, snapshotToYaml(snap));
    fs.writeFileSync(
        miniCheck,
        YAML.stringify({
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
        }),
    );
    fs.writeFileSync(
        miniTree,
        YAML.stringify({
            url: 'file://fixture',
            selector: '.fixture-block',
            frame: 'desktop',
            viewportWidth: 1440,
            designedWidth: 963,
            fetchedAt: '2026-09-27',
            tree: {
                tag: 'section',
                classes: ['fixture-block'],
                box: { x: 0, y: 0, width: 963, height: 200 },
                styles: {
                    display: 'flex',
                    gap: '30px',
                    'row-gap': '30px',
                    'column-gap': '30px',
                    opacity: '1',
                    color: 'rgb(243, 243, 243)',
                    'max-width': 'none',
                    'text-transform': 'none',
                    'padding-top': '0px',
                    'padding-right': '0px',
                },
                children: [
                    {
                        tag: 'div',
                        classes: ['fixture-block__intro'],
                        box: { x: 0, y: 0, width: 200, height: 100 },
                        styles: {
                            display: 'flex',
                            gap: '10px',
                            'row-gap': '10px',
                            'column-gap': '10px',
                            opacity: '1',
                            color: 'rgba(243, 243, 243, 0.4)',
                            'font-family': '"Inter Tight", sans-serif',
                            'font-size': '17px',
                            'font-weight': '400',
                            'line-height': '18.7px',
                            'letter-spacing': '-0.34px',
                            'max-width': '365px',
                            'text-transform': 'none',
                            'padding-top': '0px',
                            'padding-right': '0px',
                        },
                        children: [],
                    },
                ],
            },
        }),
    );
});

describe('figma-css-tree-compare', () => {
    it('PASSes matching gap via map selector', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = YAML.parse(fs.readFileSync(miniCheck, 'utf8'));
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const result = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' });

        expect(result.verdict).toBe('PASS');
        expect(result.rows.find((r) => r.key === 'introGap')?.verdict).toBe('PASS');
    });

    it('sorts rows FAIL → INFO → SKIP → PASS', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = {
            version: 1,
            map: { desktop: { '.fixture-block__intro': '1:200', '.fixture-block': '1:100' } },
            desktop: {
                introGap: { value: '10px', from: '1:200.layout.gap' },
                badWidth: { value: 999, from: '1:200.layout.gap' },
                sectionSize: {
                    value: '963×200',
                    from: '1:100.layout.designedWidth',
                },
                orphan: { value: 1, from: '9:9.layout.dimensions.width' },
            },
        };
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const result = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' });
        const order = result.rows.map((r) => r.verdict);

        expect(order.indexOf('FAIL')).toBeLessThan(order.indexOf('INFO'));
        expect(order.indexOf('INFO')).toBeLessThan(order.indexOf('SKIP'));
        expect(order.indexOf('SKIP')).toBeLessThan(order.indexOf('PASS'));
    });

    it('reads opacity from rgba/hsla color alpha when styles.opacity is 1', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = {
            version: 1,
            map: { desktop: { '.fixture-block__intro': '1:200' } },
            desktop: {
                labelOpacity: {
                    value: 0.4,
                    from: '1:200.opacity',
                    selector: '.fixture-block__intro',
                },
            },
        };
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const row = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' }).rows[0];

        expect(row.verdict).toBe('PASS');
        expect(row.liveValue).toBe(0.4);
        expect(row.liveSource).toBe('styles.color alpha');
    });

    it('compares *Font keys via textStyle globalVars (size/weight/lh/ls/family)', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = {
            version: 1,
            map: { desktop: { '.fixture-block__intro': '1:201' } },
            desktop: {
                bodyFont: {
                    value: 'Desktop/Txt/Body 17/1.1 -0.02em',
                    from: '1:201.textStyle',
                    selector: '.fixture-block__intro',
                },
            },
        };
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const row = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' }).rows[0];

        expect(row.verdict).toBe('PASS');
        expect(row.liveSource).toMatch(/font/);
        expect(String(row.figmaValue)).toMatch(/Desktop\/Txt\/Body/);
    });

    it('does not guess selector from key name — unmapped → SKIP', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = {
            version: 1,
            map: { desktop: { '.fixture-block': '1:100' } },
            desktop: {
                chromeWidth: { value: 365, from: '1:200.layout.dimensions.width' },
            },
        };
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const row = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' }).rows[0];

        expect(row.verdict).toBe('SKIP');
        expect(row.note).toMatch(/unmapped nodeId 1:200/);
        expect(row.selector).toBe('—');
    });

    it('honors entry.selector over map', () => {
        const snapshot = YAML.parse(fs.readFileSync(miniSnap, 'utf8'));
        const check = {
            version: 1,
            map: { desktop: { '.fixture-block': '1:200' } },
            desktop: {
                introGap: {
                    value: '10px',
                    from: '1:200.layout.gap',
                    selector: '.fixture-block__intro',
                },
            },
        };
        const cssTree = YAML.parse(fs.readFileSync(miniTree, 'utf8'));
        const row = compareCssTreeToCheck({ snapshot, check, cssTree, frame: 'desktop' }).rows[0];

        expect(row.selector).toBe('.fixture-block__intro');
        expect(row.verdict).toBe('PASS');
    });
});

describe('figma:css-tree-report CLI', () => {
    it('fills skill template into HTML report', () => {
        expect(fs.existsSync(template)).toBe(true);

        const res = spawnSync(
            process.execPath,
            [
                cli,
                '--snapshot',
                miniSnap,
                '--check',
                miniCheck,
                '--tree',
                miniTree,
                '--frame',
                'desktop',
                '--out',
                outHtml,
                '--template',
                template,
            ],
            { encoding: 'utf8', cwd: root },
        );

        expect(res.status, res.stderr).toBe(0);
        expect(fs.existsSync(outHtml)).toBe(true);

        const html = fs.readFileSync(outHtml, 'utf8');

        expect(html).toContain('Figma CSS tree');
        expect(html).toContain('introGap');
        expect(html).toContain('pill-PASS');
        expect(html).toContain('.fixture-block__intro');
        expect(html).not.toContain('{{ROWS}}');
        expect(html).not.toContain('{{VERDICT}}');
    });
});
