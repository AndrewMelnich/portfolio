#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { buildAuditEnvelope, summarizeFindings, writeJson, parseCliArgs, printUsage, dedupeFindings } = require("./lib/contracts");

function mergeFindings(all) {
  return dedupeFindings(all, "exact");
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.inputDir) {
    printUsage("Usage: node scripts/audit-batch.js --input-dir sandbox/runs --output sandbox/merged.json");
    process.exit(args.help ? 0 : 1);
  }

  const dir = args.inputDir;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const all = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    all.push(...(data.findings || []));
  }
  const findings = mergeFindings(all);
  const envelope = buildAuditEnvelope({
    url: args.url || "batch",
    tool: "batch",
    standard: args.standard || "wcag21aa",
    waitMs: 0,
    findings,
    mode: "batch",
    session: { sourceFiles: files, fileCount: files.length },
  });
  envelope.summary = summarizeFindings(findings);
  envelope.summary.uniqueRuleCount = new Set(findings.map((f) => f.ruleId)).size;
  envelope.summary.pages = [...new Set(findings.map((f) => f.pageUrl))].length;

  if (args.output) {
    writeJson(args.output, envelope);
    process.stderr.write(`[batch] Merged ${files.length} files → ${findings.length} unique findings → ${args.output}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }
}

main();
