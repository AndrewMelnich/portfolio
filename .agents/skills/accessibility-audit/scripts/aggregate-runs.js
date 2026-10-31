#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { escapeHtml, parseCliArgs, printUsage, summarizeFindings, writeJson } = require("./lib/contracts");

function collectJsonFiles(rootDir) {
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isAuditEnvelope(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.findings) && value.metadata;
}

function summarizePages(envelopes) {
  const pages = new Map();
  for (const envelope of envelopes) {
    const url = envelope.metadata.url;
    const findings = envelope.findings || [];
    pages.set(url, {
      url,
      summary: summarizeFindings(findings),
      files: [...(pages.get(url)?.files || []), envelope.__file]
    });
  }
  return Array.from(pages.values()).sort((left, right) => left.url.localeCompare(right.url));
}

function groupRuns(envelopes) {
  const grouped = new Map();
  for (const envelope of envelopes) {
    const runId = envelope.metadata.runId || path.basename(envelope.__file, ".json");
    if (!grouped.has(runId)) {
      grouped.set(runId, []);
    }
    grouped.get(runId).push(envelope);
  }

  return Array.from(grouped.entries()).map(([runId, items]) => {
    const allFindings = items.flatMap((item) => item.findings || []);
    items.sort((left, right) => String(left.metadata.generatedAt).localeCompare(String(right.metadata.generatedAt)));
    return {
      runId,
      runLabel: items[0].metadata.runLabel || runId,
      generatedAt: items[items.length - 1].metadata.generatedAt,
      pageCount: items.length,
      summary: summarizeFindings(allFindings),
      pages: summarizePages(items)
    };
  }).sort((left, right) => String(left.generatedAt).localeCompare(String(right.generatedAt)));
}

function compareRuns(baselineRun, latestRun) {
  const summaryDelta = {};
  for (const impact of ["critical", "serious", "moderate", "minor"]) {
    summaryDelta[impact] = (latestRun.summary.byImpact[impact] || 0) - (baselineRun.summary.byImpact[impact] || 0);
  }

  const baselinePages = new Map(baselineRun.pages.map((page) => [page.url, page]));
  const latestPages = new Map(latestRun.pages.map((page) => [page.url, page]));
  const pageUrls = Array.from(new Set([...baselinePages.keys(), ...latestPages.keys()])).sort();
  const pageDelta = pageUrls.map((url) => {
    const baselinePage = baselinePages.get(url);
    const latestPage = latestPages.get(url);
    return {
      url,
      baselineViolations: baselinePage ? baselinePage.summary.byStatus.violation || 0 : 0,
      latestViolations: latestPage ? latestPage.summary.byStatus.violation || 0 : 0,
      deltaViolations: (latestPage ? latestPage.summary.byStatus.violation || 0 : 0) - (baselinePage ? baselinePage.summary.byStatus.violation || 0 : 0)
    };
  });

  return {
    baselineRunId: baselineRun.runId,
    latestRunId: latestRun.runId,
    summaryDelta,
    pageDelta
  };
}

function generateAggregateHtml(aggregate) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Accessibility Trend Report</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; background: #f6f4ef; color: #1f2933; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .panel { background: #fffdfa; border: 1px solid #d9d2c3; border-radius: 18px; padding: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-top: 1px solid #e6dfd1; padding: 10px; text-align: left; }
    th { font-size: 0.8rem; text-transform: uppercase; color: #5b6470; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="panel">
      <h1>Accessibility Trend Report</h1>
      <p>Runs analyzed: ${aggregate.runs.length}</p>
    </div>
    <div class="panel">
      <h2>Runs</h2>
      <table>
        <thead><tr><th>Run</th><th>Generated</th><th>Pages</th><th>Violations</th><th>Needs Review</th></tr></thead>
        <tbody>
          ${aggregate.runs.map((run) => `<tr><td>${escapeHtml(run.runLabel)}</td><td>${escapeHtml(run.generatedAt)}</td><td>${run.pageCount}</td><td>${run.summary.byStatus.violation || 0}</td><td>${run.summary.byStatus["needs-review"] || 0}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${aggregate.comparison ? `<div class="panel">
      <h2>Baseline Comparison</h2>
      <p>Baseline: ${escapeHtml(aggregate.comparison.baselineRunId)} | Latest: ${escapeHtml(aggregate.comparison.latestRunId)}</p>
      <table>
        <thead><tr><th>Page</th><th>Baseline Violations</th><th>Latest Violations</th><th>Delta</th></tr></thead>
        <tbody>
          ${aggregate.comparison.pageDelta.map((page) => `<tr><td>${escapeHtml(page.url)}</td><td>${page.baselineViolations}</td><td>${page.latestViolations}</td><td>${page.deltaViolations}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  </div>
</body>
</html>`;
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const inputDir = args.inputDir || args.dir || args.input || "sandbox";
  if (args.help || !fs.existsSync(inputDir)) {
    printUsage("Usage: node scripts/aggregate-runs.js --input-dir <dir> [--output <path>] [--html-output <path>] [--baseline-run <id>]");
    process.exit(args.help ? 0 : 1);
  }

  const envelopes = collectJsonFiles(inputDir)
    .map((filePath) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (!isAuditEnvelope(parsed)) {
          return null;
        }
        parsed.__file = filePath;
        return parsed;
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);

  const runs = groupRuns(envelopes);
  const baselineRun = runs.find((run) => run.runId === args.baselineRun) || runs[0] || null;
  const latestRun = runs[runs.length - 1] || null;

  const aggregate = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    runCount: runs.length,
    runs,
    comparison: baselineRun && latestRun && baselineRun.runId !== latestRun.runId ? compareRuns(baselineRun, latestRun) : null
  };

  if (args.output) {
    writeJson(args.output, aggregate);
  } else {
    process.stdout.write(`${JSON.stringify(aggregate, null, 2)}\n`);
  }

  if (args.htmlOutput) {
    const html = generateAggregateHtml(aggregate);
    fs.mkdirSync(path.dirname(args.htmlOutput), { recursive: true });
    fs.writeFileSync(args.htmlOutput, html, "utf8");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  collectJsonFiles,
  compareRuns,
  groupRuns
};
