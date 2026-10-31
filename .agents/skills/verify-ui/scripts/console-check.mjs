#!/usr/bin/env node
import { answerHelp } from "./cli-help.mjs";
import { watchConsole } from "./console-watch.mjs";
import { gotoReady } from "./ready-wait.mjs";
import {
  DEFAULT_VIEWPORT,
  VIEWPORTS,
  requireFromApp,
  targetOrigin,
} from "./project.mjs";
import { recordEntry, recordableOrigin } from "./receipt.mjs";
import { holdRunSlot } from "./run-slot.mjs";

answerHelp(`Usage: console-check.mjs [path|url ...]

Fails when a page prints a console error or a page error, or does not answer 2xx.
Each page waits with the shared ready-wait (domcontentloaded, app-ready, fonts, images); media requests get an empty 204, so a stalled video cannot hang the check.
Paths resolve against VERIFY_BASE_URL, or the verify origin. Default: /.
Records one receipt entry per URL only when it targets the verify origin, or the dev origin on a *_section branch (FSTACK_ARTIFACTS_DIR overrides the artifacts folder).

Examples:
  node .agents/skills/verify-ui/scripts/console-check.mjs
  node .agents/skills/verify-ui/scripts/console-check.mjs /faq/ /contacts/
  VERIFY_BASE_URL=http://127.0.0.1:4328 node .agents/skills/verify-ui/scripts/console-check.mjs /
`);

const { chromium } = requireFromApp("playwright");

const CONSOLE_VIEWPORT = VIEWPORTS[DEFAULT_VIEWPORT].viewport;
const base = targetOrigin();
const origin = recordableOrigin(base);
const urls = process.argv.slice(2);
if (urls.length === 0) {
  urls.push(`${base}/`);
}

await holdRunSlot("console-check");
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const failures = [];

try {
  for (const raw of urls) {
    const url = raw.startsWith("http") ? raw : new URL(raw, base).href;
    const page = await browser.newPage({ viewport: CONSOLE_VIEWPORT });
    const errors = watchConsole(page);
    const before = failures.length;
    try {
      const response = await gotoReady(page, url);
      if (!response || !response.ok()) {
        failures.push(`${url} HTTP ${response?.status() ?? "no response"}`);
      }
    } catch (error) {
      failures.push(`${url} ${error.message}`);
    }
    for (const error of errors) {
      failures.push(`${url} ${error}`);
    }
    await page.close();
    if (origin) {
      recordEntry({
        kind: "console-check",
        origin,
        route: new URL(url).pathname,
        viewport: CONSOLE_VIEWPORT.width,
        verdict: failures.length === before ? "pass" : "fail",
        artifacts: [],
      });
    }
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("console-check FAIL");
  for (const line of failures) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log(`console-check OK (${urls.length} url)`);
