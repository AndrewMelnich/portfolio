import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { compareCssTreeToCheck } from './figma-css-tree-compare.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = path.join(__dirname, 'assets/qa-report-template.html');

const args = process.argv.slice(2);
const snapshotArg = getArg('--snapshot');
const checkArg = getArg('--check');
const treeArg = getArg('--tree');
const frameArg = getArg('--frame');
const outArg = getArg('--out');
const templateArg = getArg('--template');

if (!snapshotArg || !checkArg || !treeArg) {
    console.error(
        'Usage: pnpm figma:css-tree-report -- --snapshot <figma.yml> --check <figma.check.yml> --tree <css-tree.yml> [--frame desktop] [--out report.html]',
    );
    process.exit(1);
}

const snapshotPath = path.resolve(snapshotArg);
const checkPath = path.resolve(checkArg);
const treePath = path.resolve(treeArg);
const templatePath = path.resolve(templateArg ?? DEFAULT_TEMPLATE);

if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
}

const snapshot = YAML.parse(fs.readFileSync(snapshotPath, 'utf8'));
const check = YAML.parse(fs.readFileSync(checkPath, 'utf8'));
const cssTree = YAML.parse(fs.readFileSync(treePath, 'utf8'));
const template = fs.readFileSync(templatePath, 'utf8');

const result = compareCssTreeToCheck({
    snapshot,
    check,
    cssTree,
    frame: frameArg ?? cssTree.frame ?? 'desktop',
});

const block = path.basename(snapshotPath).replace(/\.figma\.yml$/, '');
const outPath =
    outArg != null
        ? path.resolve(outArg)
        : treePath.replace(/(\.css-tree)?(\.dump)?\.ya?ml$/i, '.css-tree.report.html');

const html = fillTemplate(template, {
    TITLE: `Figma CSS tree · ${block} · ${result.frame}`,
    BLOCK: block,
    FRAME: result.frame,
    GENERATED_AT: new Date().toISOString().slice(0, 19),
    SNAPSHOT: rel(snapshotPath),
    CHECK: rel(checkPath),
    CSS_TREE: rel(treePath),
    URL: String(result.meta.url ?? '—'),
    SELECTOR: String(result.meta.selector ?? '—'),
    VIEWPORT: String(result.meta.viewportWidth ?? '—'),
    DESIGNED_WIDTH: String(result.meta.designedWidth ?? '—'),
    VERDICT: result.verdict,
    COUNT_PASS: String(result.counts.PASS),
    COUNT_FAIL: String(result.counts.FAIL),
    COUNT_SKIP: String(result.counts.SKIP),
    COUNT_INFO: String(result.counts.INFO),
    WARNINGS: result.warnings.length
        ? result.warnings.map((w) => `<div class="warn">${escapeHtml(w)}</div>`).join('\n')
        : '',
    ROWS: result.rows.map(renderRow).join('\n') || emptyRow('No check keys for this frame'),
    MAP_ROWS: renderMapRows(result.map),
});

fs.writeFileSync(outPath, html, 'utf8');
console.error(`Wrote ${outPath}`);
console.error(
    `Verdict: ${result.verdict} (PASS ${result.counts.PASS} / FAIL ${result.counts.FAIL} / SKIP ${result.counts.SKIP} / INFO ${result.counts.INFO})`,
);
if (result.verdict === 'FAIL') process.exitCode = 2;

function renderRow(row) {
    return `<tr>
  <td><code>${escapeHtml(row.key)}</code></td>
  <td><code>${escapeHtml(row.selector)}</code></td>
  <td><code>${escapeHtml(fmt(row.checkValue))}</code></td>
  <td><code>${escapeHtml(fmt(row.figmaValue))}</code><div class="muted">${escapeHtml(row.from)}</div></td>
  <td><code>${escapeHtml(fmt(row.liveValue))}</code><div class="muted">${escapeHtml(row.liveSource)}${row.note ? ` · ${escapeHtml(row.note)}` : ''}</div></td>
  <td>${escapeHtml(row.delta || '—')}</td>
  <td><span class="pill pill-${escapeHtml(row.verdict)}">${escapeHtml(row.verdict)}</span></td>
</tr>`;
}

function renderMapRows(map) {
    const entries = Object.entries(map ?? {});
    if (entries.length === 0) return emptyRow('No map for this frame');
    return entries
        .map(
            ([sel, id]) =>
                `<tr><td><code>${escapeHtml(sel)}</code></td><td><code>${escapeHtml(String(id))}</code></td></tr>`,
        )
        .join('\n');
}

function emptyRow(msg) {
    return `<tr><td colspan="7" class="muted">${escapeHtml(msg)}</td></tr>`;
}

function fillTemplate(tpl, vars) {
    let out = tpl;
    for (const [key, value] of Object.entries(vars)) {
        out = out.split(`{{${key}}}`).join(value);
    }
    return out;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function fmt(v) {
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

function rel(p) {
    return path.relative(process.cwd(), p) || p;
}

function getArg(name) {
    const i = args.indexOf(name);
    if (i === -1) return null;
    return args[i + 1] ?? null;
}
