#!/usr/bin/env node
"use strict";

const path = require("path");
const { execSync } = require("child_process");
const {
  STANDARD_MAP,
  SUPPORTED_TOOLS,
  buildAuditEnvelope,
  parseCliArgs,
  printUsage,
  writeJson,
} = require("./lib/contracts");

function extractWcagReferences(value) {
  if (!value) {
    return [];
  }
  return Array.from(new Set((value.match(/WCAG2[A-Z]*\.\d+\.\d+\.\d+/gi) || []).map((entry) => entry.toLowerCase())));
}

function normalizeAxe(rawJson, pageUrl) {
  let data;
  if (typeof rawJson === "string") {
    try {
      data = JSON.parse(rawJson);
    } catch (parseError) {
      const hint = rawJson.trim().slice(0, 400);
      throw new Error(
        `axe-core did not return JSON (often Chrome/ChromeDriver version mismatch). ` +
          `Try: node scripts/audit.js --tool pa11y ...\n\naxe output:\n${hint}`
      );
    }
  } else {
    data = rawJson;
  }
  const pages = Array.isArray(data) ? data : [data];
  const findings = [];

  for (const page of pages) {
    const currentUrl = page.url || pageUrl;
    for (const issue of page.violations || []) {
      for (const node of issue.nodes || []) {
        findings.push({
          source: "automated",
          tool: "axe-core",
          status: "violation",
          impact: issue.impact || "moderate",
          pageUrl: currentUrl,
          ruleId: issue.id,
          wcag: (issue.tags || []).filter((tag) => tag.startsWith("wcag") || tag.startsWith("section")),
          selector: Array.isArray(node.target) ? node.target.join(" ") : "",
          html: node.html || "",
          summary: issue.help || issue.description || issue.id,
          evidence: node.failureSummary || "",
          remediation: issue.helpUrl || "",
          helpUrl: issue.helpUrl || "",
        });
      }
    }
    for (const issue of page.incomplete || []) {
      for (const node of issue.nodes || []) {
        findings.push({
          source: "automated",
          tool: "axe-core",
          status: "needs-review",
          impact: issue.impact || "moderate",
          pageUrl: currentUrl,
          ruleId: issue.id,
          wcag: (issue.tags || []).filter((tag) => tag.startsWith("wcag") || tag.startsWith("section")),
          selector: Array.isArray(node.target) ? node.target.join(" ") : "",
          html: node.html || "",
          summary: issue.help || issue.description || issue.id,
          evidence: node.failureSummary || "",
          remediation: "Manually verify this condition before treating it as a confirmed defect.",
          helpUrl: issue.helpUrl || "",
        });
      }
    }
  }

  return findings;
}

function normalizePa11y(rawJson, pageUrl) {
  const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  const issues = Array.isArray(data) ? data : data.issues || [];
  return issues.map((issue) => ({
    source: "automated",
    tool: "pa11y",
    status: issue.type === "error" ? "violation" : issue.type === "notice" || issue.type === "warning" ? "needs-review" : "pass",
    impact: issue.type === "error" ? "serious" : issue.type === "warning" ? "moderate" : "minor",
    pageUrl,
    ruleId: issue.code || "unknown-rule",
    wcag: extractWcagReferences(issue.code),
    selector: issue.selector || "",
    html: issue.context || "",
    summary: issue.message || issue.code || "Pa11y finding",
    evidence: issue.message || "",
    remediation: "Review the reported markup and correct the underlying accessibility issue.",
    helpUrl: "",
  }));
}

function normalizeLighthouse(rawJson, pageUrl) {
  const data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  const findings = [];

  for (const [ruleId, audit] of Object.entries(data.audits || {})) {
    if (audit.score === null || audit.score >= 1) {
      continue;
    }
    const items = audit.details && Array.isArray(audit.details.items) && audit.details.items.length
      ? audit.details.items
      : [{}];
    for (const item of items) {
      findings.push({
        source: "automated",
        tool: "lighthouse",
        status: "violation",
        impact: audit.score === 0 ? "serious" : "moderate",
        pageUrl,
        ruleId,
        wcag: [],
        selector: item.node && item.node.selector ? item.node.selector : "",
        html: item.node && item.node.snippet ? item.node.snippet : "",
        summary: audit.title || audit.description || ruleId,
        evidence: audit.description || "",
        remediation: audit.helpUrl || "Review the Lighthouse accessibility guidance for this audit.",
        helpUrl: audit.helpUrl || "",
      });
    }
  }

  return findings;
}

function runCommand(command, label) {
  try {
    return execSync(command, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 180000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.stdout) {
      return error.stdout;
    }
    const stderr = error.stderr ? String(error.stderr) : "";
    throw new Error(`${label} failed. ${stderr || error.message}`.trim());
  }
}

function runAxe(url, standard) {
  const tags = STANDARD_MAP[standard].axeTags.join(",");
  return normalizeAxe(runCommand(`npx @axe-core/cli "${url}" --tags ${tags} --stdout`, "axe-core"), url);
}

function runPa11y(url, standard, waitMs, options = {}) {
  let command = `npx pa11y "${url}" --reporter json --standard ${STANDARD_MAP[standard].pa11yStandard}`;
  if (waitMs > 0) {
    command += ` --wait ${waitMs}`;
  }
  if (options.includeWarnings) {
    command += " --include-warnings";
  }
  if (options.includeNotices) {
    command += " --include-notices";
  }
  return normalizePa11y(runCommand(command, "pa11y"), url);
}

function runLighthouse(url) {
  return normalizeLighthouse(
    runCommand(
      `npx lighthouse "${url}" --output json --quiet --only-categories=accessibility --chrome-flags="--headless --no-sandbox"`,
      "lighthouse"
    ),
    url
  );
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printUsage("Usage: node scripts/audit.js --url <URL> [--tool axe|pa11y|lighthouse] [--standard wcag22aa] [--wait <ms>] [--output <path>]");
    process.exit(args.help ? 0 : 1);
  }

  if (!SUPPORTED_TOOLS.includes(args.tool)) {
    throw new Error(`Unsupported tool "${args.tool}". Supported tools: ${SUPPORTED_TOOLS.join(", ")}`);
  }
  if (!STANDARD_MAP[args.standard]) {
    throw new Error(`Unsupported standard "${args.standard}". Supported values: ${Object.keys(STANDARD_MAP).join(", ")}`);
  }

  const findings = args.tool === "axe"
    ? runAxe(args.url, args.standard)
    : args.tool === "pa11y"
      ? runPa11y(args.url, args.standard, args.wait, {
          includeWarnings: args.includeWarnings,
          includeNotices: args.includeNotices,
        })
      : runLighthouse(args.url);

  const envelope = buildAuditEnvelope({
    url: args.url,
    tool: args.tool,
    standard: args.standard,
    waitMs: args.wait,
    findings,
    runId: args.runId,
    runLabel: args.runLabel,
    mode: "cli",
    session: null
  });

  if (args.output) {
    writeJson(args.output, envelope);
    process.stderr.write(`[audit] Wrote ${envelope.findings.length} findings to ${path.resolve(args.output)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
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
  extractWcagReferences,
  normalizeAxe,
  normalizeLighthouse,
  normalizePa11y,
};
