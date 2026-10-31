"use strict";

const fs = require("fs");
const path = require("path");

const STANDARD_MAP = {
  wcag22a: { axeTags: ["wcag2a", "wcag22a"], pa11yStandard: "WCAG2A" },
  wcag22aa: { axeTags: ["wcag2a", "wcag2aa", "wcag22aa"], pa11yStandard: "WCAG2AA" },
  wcag22aaa: { axeTags: ["wcag2a", "wcag2aa", "wcag2aaa", "wcag22aaa"], pa11yStandard: "WCAG2AAA" },
  wcag21a: { axeTags: ["wcag2a", "wcag21a"], pa11yStandard: "WCAG2A" },
  wcag21aa: { axeTags: ["wcag2a", "wcag2aa", "wcag21aa"], pa11yStandard: "WCAG2AA" },
  wcag21aaa: { axeTags: ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aaa"], pa11yStandard: "WCAG2AAA" },
  wcag20a: { axeTags: ["wcag2a"], pa11yStandard: "WCAG2A" },
  wcag20aa: { axeTags: ["wcag2a", "wcag2aa"], pa11yStandard: "WCAG2AA" },
  wcag20aaa: { axeTags: ["wcag2a", "wcag2aa", "wcag2aaa"], pa11yStandard: "WCAG2AAA" },
  section508: { axeTags: ["section508", "wcag2a", "wcag2aa"], pa11yStandard: "Section508" },
  en301549: { axeTags: ["wcag2a", "wcag2aa", "wcag21aa"], pa11yStandard: "WCAG2AA" }
};

const SUPPORTED_TOOLS = ["axe", "pa11y", "lighthouse"];
const IMPACTS = ["critical", "serious", "moderate", "minor"];
const STATUSES = ["violation", "needs-review", "pass"];

function parseCliArgs(argv) {
  const options = {
    tool: "axe",
    standard: "wcag22aa",
    wait: 0,
    maxPages: 12,
    headless: true,
    captureScreenshots: false,
    includeWarnings: false,
    includeNotices: false,
    deep: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--help") {
      options.help = true;
    } else if (token === "--url") {
      options.url = next;
      index += 1;
    } else if (token === "--tool") {
      options.tool = next;
      index += 1;
    } else if (token === "--standard") {
      options.standard = next;
      index += 1;
    } else if (token === "--wait") {
      options.wait = Number(next) || 0;
      index += 1;
    } else if (token === "--output") {
      options.output = next;
      index += 1;
    } else if (token === "--html-output") {
      options.htmlOutput = next;
      index += 1;
    } else if (token === "--max-pages") {
      options.maxPages = Number(next) || 12;
      index += 1;
    } else if (token === "--session-config") {
      options.sessionConfig = next;
      index += 1;
    } else if (token === "--storage-state") {
      options.storageState = next;
      index += 1;
    } else if (token === "--run-id") {
      options.runId = next;
      index += 1;
    } else if (token === "--run-label") {
      options.runLabel = next;
      index += 1;
    } else if (token === "--input-dir" || token === "--dir" || token === "--input") {
      options.inputDir = next;
      index += 1;
    } else if (token === "--baseline-run") {
      options.baselineRun = next;
      index += 1;
    } else if (token === "--screenshots-dir") {
      options.screenshotsDir = next;
      index += 1;
    } else if (token === "--capture-screenshots") {
      options.captureScreenshots = true;
    } else if (token === "--headed") {
      options.headless = false;
    } else if (token === "--include-warnings") {
      options.includeWarnings = true;
    } else if (token === "--include-notices") {
      options.includeNotices = true;
    } else if (token === "--deep") {
      options.deep = true;
      options.includeWarnings = true;
      options.includeNotices = true;
    }
  }

  return options;
}

function summarizeFindings(findings) {
  const summary = {
    total: findings.length,
    byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    byStatus: { violation: 0, "needs-review": 0, pass: 0 }
  };

  for (const finding of findings) {
    if (summary.byImpact[finding.impact] !== undefined) {
      summary.byImpact[finding.impact] += 1;
    }
    if (summary.byStatus[finding.status] !== undefined) {
      summary.byStatus[finding.status] += 1;
    }
  }

  return summary;
}

function buildAuditEnvelope({ url, tool, standard, waitMs, findings, runId, runLabel, mode, session }) {
  return {
    schemaVersion: "1.0.0",
    metadata: {
      url,
      tool,
      standard,
      waitMs: waitMs || 0,
      generatedAt: new Date().toISOString(),
      runId: runId || null,
      runLabel: runLabel || null,
      mode: mode || "cli",
      session: session || null
    },
    summary: summarizeFindings(findings),
    findings
  };
}

function validateEnvelope(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["Envelope must be a JSON object."];
  }
  if (!value.schemaVersion) {
    errors.push("Missing schemaVersion.");
  }
  if (!value.metadata || typeof value.metadata !== "object") {
    errors.push("Missing metadata object.");
  }
  if (!Array.isArray(value.findings)) {
    errors.push("Missing findings array.");
  }
  if (Array.isArray(value.findings)) {
    value.findings.forEach((finding, index) => {
      if (!finding || typeof finding !== "object") {
        errors.push(`Finding ${index} must be an object.`);
        return;
      }
      if (!STATUSES.includes(finding.status)) {
        errors.push(`Finding ${index} has invalid status "${finding.status}".`);
      }
      if (!IMPACTS.includes(finding.impact)) {
        errors.push(`Finding ${index} has invalid impact "${finding.impact}".`);
      }
      if (!finding.ruleId) {
        errors.push(`Finding ${index} is missing ruleId.`);
      }
      if (!finding.summary) {
        errors.push(`Finding ${index} is missing summary.`);
      }
    });
  }
  return errors;
}

function findingDedupeKey(finding, mode = "pattern") {
  const ruleId = String(finding.ruleId || "");
  const summary = String(finding.summary || "");
  const selector = String(finding.selector || "");
  const status = String(finding.status || "");
  const pageUrl = String(finding.pageUrl || "");
  if (mode === "exact") {
    return [pageUrl, ruleId, selector, summary, status].join("|");
  }
  if (mode === "rule") {
    return [ruleId, summary, status].join("|");
  }
  return [ruleId, summary, selector, status].join("|");
}

function dedupeFindings(findings, mode = "pattern") {
  const map = new Map();
  for (const finding of findings) {
    const key = findingDedupeKey(finding, mode);
    if (!map.has(key)) {
      map.set(key, {
        ...finding,
        occurrenceCount: 1,
        pageUrls: finding.pageUrl ? [finding.pageUrl] : [],
      });
      continue;
    }
    const existing = map.get(key);
    existing.occurrenceCount += 1;
    if (finding.pageUrl && !existing.pageUrls.includes(finding.pageUrl)) {
      existing.pageUrls.push(finding.pageUrl);
    }
  }
  return Array.from(map.values());
}

function writeJson(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printUsage(message) {
  process.stderr.write(`${message}\n`);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  IMPACTS,
  STANDARD_MAP,
  STATUSES,
  SUPPORTED_TOOLS,
  buildAuditEnvelope,
  escapeHtml,
  parseCliArgs,
  printUsage,
  summarizeFindings,
  validateEnvelope,
  writeJson,
  findingDedupeKey,
  dedupeFindings
};
