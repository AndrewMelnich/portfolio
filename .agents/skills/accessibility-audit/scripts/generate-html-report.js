#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { escapeHtml, summarizeFindings, dedupeFindings } = require("./lib/contracts");

function readEnvelope(inputPath) {
  const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return {
      schemaVersion: "1.0.0",
      metadata: {
        url: "Unknown URL",
        tool: "unknown",
        standard: "unknown",
        generatedAt: new Date().toISOString(),
      },
      summary: summarizeFindings(parsed),
      findings: parsed,
    };
  }
  return parsed;
}

function renderLocationCell(finding) {
  const pages = Array.isArray(finding.pageUrls) && finding.pageUrls.length
    ? finding.pageUrls
    : finding.pageUrl
      ? [finding.pageUrl]
      : [];
  const pagesHtml = pages.map((url) => `<div>${escapeHtml(url)}</div>`).join("");
  const countHtml = finding.occurrenceCount > 1
    ? `<div class="meta">${finding.occurrenceCount} occurrences</div>`
    : "";
  return `${countHtml}${pagesHtml}<div class="code">${escapeHtml(finding.selector || "")}</div>`;
}

function renderFindingRow(finding) {
  return `
    <tr>
      <td><span class="pill status-${escapeHtml(finding.status || "unknown")}">${escapeHtml(finding.status || "unknown")}</span></td>
      <td><span class="pill impact-${escapeHtml(finding.impact || "moderate")}">${escapeHtml(finding.impact || "moderate")}</span></td>
      <td>
        <strong>${escapeHtml(finding.summary || finding.ruleId || "Finding")}</strong>
        <div class="meta">${escapeHtml(finding.ruleId || "")}</div>
        <div class="meta">${escapeHtml((finding.wcag || []).join(", "))}</div>
      </td>
      <td>
        ${renderLocationCell(finding)}
      </td>
      <td>
        <div>${escapeHtml(finding.evidence || "")}</div>
        ${finding.html ? `<div class="code">${escapeHtml(finding.html)}</div>` : ""}
      </td>
      <td>
        <div>${escapeHtml(finding.remediation || "")}</div>
        ${finding.helpUrl ? `<div><a href="${escapeHtml(finding.helpUrl)}">Reference</a></div>` : ""}
      </td>
    </tr>
  `;
}

function filterFindings(findings, options = {}) {
  const exclude = new Set((options.excludeImpact || []).map((value) => String(value).toLowerCase()));
  if (!exclude.size) {
    return findings;
  }
  return findings.filter((finding) => !exclude.has(String(finding.impact || "").toLowerCase()));
}

function generateHtml(envelope, options = {}) {
  const allFindings = Array.isArray(envelope.findings) ? envelope.findings : [];
  let findings = filterFindings(allFindings, options);
  const afterFilter = findings.length;
  if (options.dedupe !== false) {
    findings = dedupeFindings(findings, options.dedupeMode || "pattern");
  }
  const summary = summarizeFindings(findings);
  const metadata = envelope.metadata || {};
  const notes = [];
  if (options.excludeImpact && options.excludeImpact.length) {
    notes.push(`Excluded impact: ${options.excludeImpact.join(", ")} (${allFindings.length} → ${afterFilter})`);
  }
  if (options.dedupe !== false) {
    notes.push(`Deduplicated: ${afterFilter} → ${findings.length}`);
  }
  const filterNote = notes.join(" | ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accessibility Audit Report</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --ink: #1f2933;
      --muted: #5b6470;
      --border: #d8d2c3;
      --critical: #b42318;
      --serious: #dd6b20;
      --moderate: #b98900;
      --minor: #1d6fa5;
      --review: #6b46c1;
      --pass: #287d3c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at top left, rgba(180, 35, 24, 0.08), transparent 35%),
        radial-gradient(circle at bottom right, rgba(29, 111, 165, 0.08), transparent 30%),
        var(--bg);
      color: var(--ink);
    }
    .wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    .hero, .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 14px 30px rgba(31, 41, 51, 0.06);
      margin-bottom: 24px;
    }
    h1, h2 {
      margin: 0 0 12px;
      line-height: 1.1;
    }
    p { color: var(--muted); }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .stat {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      background: #fff;
    }
    .stat strong {
      display: block;
      font-size: 2rem;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    th, td {
      border-top: 1px solid var(--border);
      padding: 12px;
      vertical-align: top;
      text-align: left;
    }
    th {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #fff;
    }
    .impact-critical { background: var(--critical); }
    .impact-serious { background: var(--serious); }
    .impact-moderate { background: var(--moderate); }
    .impact-minor { background: var(--minor); }
    .status-violation { background: var(--critical); }
    .status-needs-review { background: var(--review); }
    .status-pass { background: var(--pass); }
    .meta {
      color: var(--muted);
      font-size: 0.85rem;
      margin-top: 4px;
    }
    .code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 0.85rem;
      margin-top: 6px;
      color: #3e4c59;
      white-space: pre-wrap;
      word-break: break-word;
    }
    a { color: #0f5f8c; }
    @media (max-width: 720px) {
      table, thead, tbody, tr, th, td { display: block; }
      th { border-top: none; padding-bottom: 0; }
      td { padding-top: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>Accessibility Audit Report</h1>
      <p>${escapeHtml(metadata.url || "Unknown URL")}</p>
      <p>Tool: ${escapeHtml(metadata.tool || "unknown")} | Standard: ${escapeHtml(metadata.standard || "unknown")} | Generated: ${escapeHtml(metadata.generatedAt || "")}</p>
      ${filterNote ? `<p>${escapeHtml(filterNote)}</p>` : ""}
    </section>

    <section class="panel">
      <h2>Summary</h2>
      <div class="grid">
        <div class="stat"><strong>${summary.total}</strong><span>Total findings</span></div>
        <div class="stat"><strong>${summary.byStatus.violation || 0}</strong><span>Violations</span></div>
        <div class="stat"><strong>${summary.byStatus["needs-review"] || 0}</strong><span>Needs review</span></div>
        <div class="stat"><strong>${summary.byImpact.critical || 0}</strong><span>Critical</span></div>
        <div class="stat"><strong>${summary.byImpact.serious || 0}</strong><span>Serious</span></div>
        <div class="stat"><strong>${summary.byImpact.moderate || 0}</strong><span>Moderate</span></div>
      </div>
    </section>

    <section class="panel">
      <h2>Method</h2>
      <p>This report separates machine-detected findings from items that still need human verification. Treat the results as an audit artifact, not as a certification statement.</p>
    </section>

    <section class="panel">
      <h2>Findings</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Impact</th>
            <th>Rule</th>
            <th>Location</th>
            <th>Evidence</th>
            <th>Remediation</th>
          </tr>
        </thead>
        <tbody>
          ${findings.map(renderFindingRow).join("")}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
}

function parseReportArgs(argv) {
  const positional = [];
  const options = { excludeImpact: [], dedupe: true, dedupeMode: "pattern" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--no-dedupe") {
      options.dedupe = false;
    } else if (token === "--dedupe-mode") {
      options.dedupeMode = next;
      index += 1;
    } else if (token === "--exclude-impact") {
      options.excludeImpact = String(argv[index + 1] || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      index += 1;
    } else {
      positional.push(token);
    }
  }
  return { positional, options };
}

function main() {
  const { positional, options } = parseReportArgs(process.argv.slice(2));
  const inputPath = positional[0];
  const outputPath = positional[1];
  if (!inputPath || !outputPath) {
    process.stderr.write(
      "Usage: node scripts/generate-html-report.js <input.json> <output.html> [--exclude-impact minor,moderate]\n"
    );
    process.exit(1);
  }
  const envelope = readEnvelope(inputPath);
  const html = generateHtml(envelope, options);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  process.stderr.write(`[report] Generated ${path.resolve(outputPath)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  generateHtml,
  readEnvelope,
  filterFindings,
};
