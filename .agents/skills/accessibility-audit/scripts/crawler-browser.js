#!/usr/bin/env node
"use strict";

const { parseCliArgs, printUsage, writeJson } = require("./lib/contracts");
const { bootstrapSession, collectSameOriginLinks } = require("./lib/browser-session");
const { classifyRoute, normalizePathname } = require("./crawler");

function scoreRoute(pathname) {
  const { priority } = classifyRoute(pathname);
  return priority === "critical" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

async function discoverBrowserRoutes(page, rootUrl, maxPages) {
  const visited = new Set();
  const queue = [rootUrl];
  const routes = new Map();

  while (queue.length > 0 && routes.size < maxPages) {
    const current = queue.shift();
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    await page.goto(current, { waitUntil: "networkidle" });
    const currentUrl = page.url();
    const pathname = normalizePathname(new URL(currentUrl).pathname);
    if (!routes.has(pathname)) {
      routes.set(pathname, {
        url: currentUrl,
        pathname,
        ...classifyRoute(pathname),
        score: scoreRoute(pathname)
      });
    }

    const links = await collectSameOriginLinks(page, rootUrl);
    for (const link of links) {
      if (!visited.has(link) && queue.length + routes.size < maxPages * 3) {
        queue.push(link);
      }
    }
  }

  return Array.from(routes.values())
    .sort((left, right) => right.score - left.score || left.pathname.localeCompare(right.pathname))
    .slice(0, maxPages);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printUsage("Usage: node scripts/crawler-browser.js --url <URL> [--session-config <path>] [--storage-state <path>] [--max-pages <n>] [--output <path>]");
    process.exit(args.help ? 0 : 1);
  }

  const { browser, context, page } = await bootstrapSession({
    sessionConfigPath: args.sessionConfig,
    storageStatePath: args.storageState,
    headless: args.headless !== false,
    targetUrl: args.url
  });

  try {
    const routes = await discoverBrowserRoutes(page, args.url, args.maxPages || 12);
    const payload = {
      schemaVersion: "1.0.0",
      metadata: {
        rootUrl: args.url,
        generatedAt: new Date().toISOString(),
        maxPages: args.maxPages || 12,
        routeCount: routes.length,
        authenticated: Boolean(args.sessionConfig || args.storageState)
      },
      routes
    };

    if (args.output) {
      writeJson(args.output, payload);
      process.stderr.write(`[crawler-browser] Wrote ${routes.length} routes to ${args.output}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    }
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
  discoverBrowserRoutes
};
