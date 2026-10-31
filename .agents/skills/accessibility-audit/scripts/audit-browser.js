#!/usr/bin/env node
"use strict";

const path = require("path");
const { STANDARD_MAP, buildAuditEnvelope, parseCliArgs, printUsage, writeJson } = require("./lib/contracts");
const {
  bootstrapSession,
  captureFindingScreenshot,
  resolveRouteProfile,
  runActions,
  runAxeInPage,
  slugify
} = require("./lib/browser-session");

function normalizeBrowserAxe(results, pageUrl) {
  const findings = [];

  for (const issue of results.violations || []) {
    for (const node of issue.nodes || []) {
      findings.push({
        source: "automated",
        tool: "axe-core-playwright",
        status: "violation",
        impact: issue.impact || "moderate",
        pageUrl,
        ruleId: issue.id,
        wcag: (issue.tags || []).filter((tag) => tag.startsWith("wcag") || tag.startsWith("section")),
        selector: Array.isArray(node.target) ? node.target.join(" ") : "",
        html: node.html || "",
        summary: issue.help || issue.description || issue.id,
        evidence: node.failureSummary || "",
        remediation: issue.helpUrl || "",
        helpUrl: issue.helpUrl || ""
      });
    }
  }

  for (const issue of results.incomplete || []) {
    for (const node of issue.nodes || []) {
      findings.push({
        source: "automated",
        tool: "axe-core-playwright",
        status: "needs-review",
        impact: issue.impact || "moderate",
        pageUrl,
        ruleId: issue.id,
        wcag: (issue.tags || []).filter((tag) => tag.startsWith("wcag") || tag.startsWith("section")),
        selector: Array.isArray(node.target) ? node.target.join(" ") : "",
        html: node.html || "",
        summary: issue.help || issue.description || issue.id,
        evidence: node.failureSummary || "",
        remediation: "Manually verify this condition before treating it as a confirmed defect.",
        helpUrl: issue.helpUrl || ""
      });
    }
  }

  return findings;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printUsage("Usage: node scripts/audit-browser.js --url <URL> [--standard wcag22aa] [--session-config <path>] [--storage-state <path>] [--capture-screenshots] [--output <path>]");
    process.exit(args.help ? 0 : 1);
  }
  if (!STANDARD_MAP[args.standard]) {
    throw new Error(`Unsupported standard "${args.standard}". Supported values: ${Object.keys(STANDARD_MAP).join(", ")}`);
  }

  const outputPath = args.output || path.join("sandbox", `${slugify(args.url)}-browser-audit.json`);
  const screenshotDir = args.screenshotsDir || path.join(path.dirname(outputPath), "screenshots");
  const { browser, context, page, sessionConfig } = await bootstrapSession({
    sessionConfigPath: args.sessionConfig,
    storageStatePath: args.storageState,
    headless: args.headless !== false,
    targetUrl: args.url
  });

  try {
    await page.goto(args.url, { waitUntil: "networkidle" });
    if (args.wait > 0) {
      await page.waitForTimeout(args.wait);
    }

    const routeProfile = resolveRouteProfile(sessionConfig, page.url());
    if (routeProfile && Array.isArray(routeProfile.beforeAudit)) {
      await runActions(page, routeProfile.beforeAudit, sessionConfig);
    }

    const axeResults = await runAxeInPage(page, STANDARD_MAP[args.standard].axeTags);
    const findings = normalizeBrowserAxe(axeResults, page.url());

    if (args.captureScreenshots) {
      for (let index = 0; index < findings.length; index += 1) {
        const absolute = await captureFindingScreenshot(page, findings[index], screenshotDir, index);
        findings[index].screenshot = path.relative(path.dirname(outputPath), absolute).replace(/\\/g, "/");
      }
    }

    const envelope = buildAuditEnvelope({
      url: page.url(),
      tool: "axe-browser",
      standard: args.standard,
      waitMs: args.wait,
      findings,
      runId: args.runId,
      runLabel: args.runLabel,
      mode: "browser",
      session: {
        used: Boolean(args.sessionConfig || args.storageState),
        sessionConfigPath: args.sessionConfig || null,
        storageStatePath: args.storageState || null,
        screenshotsCaptured: Boolean(args.captureScreenshots),
        routeProfile: routeProfile ? routeProfile.name || routeProfile.match : null
      }
    });

    writeJson(outputPath, envelope);
    process.stderr.write(`[audit-browser] Wrote ${findings.length} findings to ${path.resolve(outputPath)}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  normalizeBrowserAxe
};
