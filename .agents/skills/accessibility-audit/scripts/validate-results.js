#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { validateEnvelope } = require("./lib/contracts");

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    process.stderr.write("Usage: node scripts/validate-results.js <results.json>\n");
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const errors = validateEnvelope(parsed);
  if (errors.length > 0) {
    process.stderr.write(`Invalid results envelope:\n- ${errors.join("\n- ")}\n`);
    process.exit(1);
  }
  process.stdout.write("Results envelope is valid.\n");
}

if (require.main === module) {
  main();
}
