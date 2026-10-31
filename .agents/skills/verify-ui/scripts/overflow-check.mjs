#!/usr/bin/env node

import { answerHelp } from "./cli-help.mjs";
import { gotoReady } from "./ready-wait.mjs";
import { documentOverflow } from "./overflow-lib.mjs";
import { OVERFLOW_WIDTHS, requireFromApp, targetOrigin } from "./project.mjs";
import { recordEntry, recordableOrigin } from "./receipt.mjs";
import { holdRunSlot } from "./run-slot.mjs";

answerHelp(`Usage: overflow-check.mjs <url|path> [width[:height] ...]

Fails when the page scrolls horizontally at a viewport width. Default widths: config overflowWidths.
Paths resolve against VERIFY_BASE_URL, or the verify origin.
Each page waits with the shared ready-wait; media requests get an empty 204.
Records one receipt entry per viewport only when it targets the verify origin, or the dev origin on a *_section branch.

Examples:
  node .agents/skills/verify-ui/scripts/overflow-check.mjs /faq/
  node .agents/skills/verify-ui/scripts/overflow-check.mjs /faq/ 390 768:1024
`);

const { chromium } = requireFromApp("playwright");

const base = targetOrigin();
const origin = recordableOrigin(base);
const url = process.argv[2] && new URL(process.argv[2], base).href;
const widthArgs = process.argv.slice(3);
const viewports = (widthArgs.length ? widthArgs : OVERFLOW_WIDTHS.map(String)).map((spec) => {
  const [w, h = "900"] = spec.split(":");
  return { width: Number(w), height: Number(h) };
});

if (!url || viewports.some((viewport) => !Number.isFinite(viewport.width) || viewport.width <= 0)) {
  console.error("Usage: overflow-check.mjs <url> [width[:height] ...]");
  process.exit(2);
}

const route = new URL(url).pathname;
const recordVerdict = (width, verdict) => {
  if (!origin) return;
  recordEntry({ kind: "overflow-check", origin, route, viewport: width, verdict, artifacts: [] });
};

await holdRunSlot("overflow-check");
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const fails = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const response = await gotoReady(page, url);
    if (!response?.ok()) {
      fails.push(`${viewport.width}: HTTP ${response?.status() ?? "none"}`);
      recordVerdict(viewport.width, "fail");
      await page.close();
      continue;
    }
    const report = await documentOverflow(page);
    const overflow = report.scrollW > report.clientW + 1;
    const line = `${viewport.width}x${viewport.height}: scroll=${report.scrollW} client=${report.clientW}`;
    if (overflow) {
      fails.push(line);
      console.error(`FAIL ${line}`);
    } else {
      console.log(`OK   ${line}`);
    }
    recordVerdict(viewport.width, overflow ? "fail" : "pass");
    await page.close();
  }
} finally {
  await browser.close();
}

if (fails.length) {
  console.error(`overflow-check FAIL (${fails.length})`);
  process.exit(1);
}

console.log(`overflow-check OK (${viewports.length} viewport)`);
