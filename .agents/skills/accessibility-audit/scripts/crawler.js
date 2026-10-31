#!/usr/bin/env node
"use strict";

const axios = require("axios");
const { URL } = require("url");
const { parseCliArgs, printUsage, writeJson } = require("./lib/contracts");

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

function classifyRoute(pathname) {
  const value = pathname.toLowerCase();
  if (value === "/") {
    return { type: "landing", priority: "high" };
  }
  if (/(login|signin|signup|register|password|auth)/.test(value)) {
    return { type: "authentication", priority: "critical" };
  }
  if (/(contact|support|help|feedback|form)/.test(value)) {
    return { type: "form", priority: "high" };
  }
  if (/(search|results|catalog|products|services|listing|category)/.test(value)) {
    return { type: "listing", priority: "high" };
  }
  if (/(cart|checkout|payment|billing)/.test(value)) {
    return { type: "transaction", priority: "critical" };
  }
  if (/(product|item|detail|article|blog|news)/.test(value)) {
    return { type: "detail", priority: "medium" };
  }
  if (/(settings|profile|account|dashboard)/.test(value)) {
    return { type: "application", priority: "high" };
  }
  return { type: "content", priority: "medium" };
}

function scoreRoute(pathname) {
  const { priority } = classifyRoute(pathname);
  return priority === "critical" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function parseHtmlLinks(html, baseUrl) {
  const links = new Set();
  const pattern = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const candidate = new URL(match[1], baseUrl);
      if (/^https?:$/.test(candidate.protocol)) {
        links.add(candidate.toString());
      }
    } catch (_) {
      continue;
    }
  }
  return Array.from(links);
}

function parseSitemapUrls(xml) {
  const matches = xml.match(/<loc>(.*?)<\/loc>/gi) || [];
  return matches.map((entry) => entry.replace(/<\/?loc>/gi, "").trim()).filter(Boolean);
}

async function fetchText(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
}

async function discoverRoutes(rootUrl, maxPages) {
  const base = new URL(rootUrl);
  const sameOrigin = `${base.protocol}//${base.host}`;
  const candidates = new Map();

  const homeHtml = await fetchText(rootUrl);
  for (const href of parseHtmlLinks(homeHtml, rootUrl)) {
    const parsed = new URL(href);
    if (`${parsed.protocol}//${parsed.host}` !== sameOrigin) {
      continue;
    }
    candidates.set(normalizePathname(parsed.pathname), parsed.toString());
  }

  try {
    const sitemapXml = await fetchText(new URL("/sitemap.xml", rootUrl).toString());
    for (const href of parseSitemapUrls(sitemapXml)) {
      try {
        const parsed = new URL(href);
        if (`${parsed.protocol}//${parsed.host}` !== sameOrigin) {
          continue;
        }
        candidates.set(normalizePathname(parsed.pathname), parsed.toString());
      } catch (_) {
        continue;
      }
    }
  } catch (_) {

  }

  candidates.set("/", new URL("/", rootUrl).toString());

  return Array.from(candidates.entries())
    .map(([pathname, absoluteUrl]) => ({
      url: absoluteUrl,
      pathname,
      ...classifyRoute(pathname),
      score: scoreRoute(pathname),
    }))
    .sort((left, right) => right.score - left.score || left.pathname.localeCompare(right.pathname))
    .slice(0, maxPages);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    printUsage("Usage: node scripts/crawler.js --url <URL> [--max-pages <n>] [--output <path>]");
    process.exit(args.help ? 0 : 1);
  }

  const routes = await discoverRoutes(args.url, args.maxPages || 12);
  const payload = {
    schemaVersion: "1.0.0",
    metadata: {
      rootUrl: args.url,
      generatedAt: new Date().toISOString(),
      maxPages: args.maxPages || 12,
      routeCount: routes.length,
    },
    routes,
  };

  if (args.output) {
    writeJson(args.output, payload);
    process.stderr.write(`[crawler] Wrote ${routes.length} routes to ${args.output}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  classifyRoute,
  discoverRoutes,
  normalizePathname,
  parseHtmlLinks,
  parseSitemapUrls,
};
