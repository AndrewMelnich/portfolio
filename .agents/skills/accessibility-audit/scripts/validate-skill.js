#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_FILES = [
  "SKILL.md",
  "README.md",
  "package.json",
  "agents/openai.yaml",
  "references/output-contract.md",
  "schemas/a11y-audit.schema.json"
];

function validateFrontmatter(skillText) {
  const match = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return ["SKILL.md is missing YAML frontmatter."];
  }
  const body = match[1];
  const errors = [];
  if (!/^name:\s+[a-z0-9-]+$/m.test(body)) {
    errors.push("Frontmatter must include a lowercase hyphenated name.");
  }
  if (!/^description:\s+.+$/m.test(body)) {
    errors.push("Frontmatter must include a non-empty description.");
  }
  return errors;
}

function main() {
  const root = process.cwd();
  const errors = [];

  for (const relativePath of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      errors.push(`Missing required file: ${relativePath}`);
    }
  }

  if (fs.existsSync(path.join(root, "SKILL.md"))) {
    errors.push(...validateFrontmatter(fs.readFileSync(path.join(root, "SKILL.md"), "utf8")));
  }

  if (errors.length > 0) {
    process.stderr.write(`Skill validation failed:\n- ${errors.join("\n- ")}\n`);
    process.exit(1);
  }

  process.stdout.write("Skill structure is valid.\n");
}

if (require.main === module) {
  main();
}
