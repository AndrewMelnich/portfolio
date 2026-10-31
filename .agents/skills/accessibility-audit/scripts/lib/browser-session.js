"use strict";

const fs = require("fs");
const path = require("path");
const { URL } = require("url");

function requirePlaywright() {
  return require("playwright");
}

function requireAxeSource() {
  return fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
}

function loadSessionConfig(configPath) {
  if (!configPath) {
    return null;
  }
  const absolutePath = path.resolve(configPath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  parsed.__path = absolutePath;
  return parsed;
}

function resolveMaybeUrl(value, baseUrl) {
  if (!value) {
    return value;
  }
  try {
    return new URL(value, baseUrl || undefined).toString();
  } catch (_) {
    return value;
  }
}

function resolveActionValue(value, sessionConfig) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\$\{([^}]+)\}/g, (_, token) => {
    if (token.startsWith("secret:")) {
      const secretName = token.slice("secret:".length);
      const mappedEnv = sessionConfig && sessionConfig.secrets ? sessionConfig.secrets[secretName] : undefined;
      return process.env[mappedEnv || secretName] || "";
    }
    if (token.startsWith("env:")) {
      return process.env[token.slice("env:".length)] || "";
    }
    if (token === "baseUrl") {
      return sessionConfig && sessionConfig.baseUrl ? sessionConfig.baseUrl : "";
    }
    if (sessionConfig && sessionConfig.variables && sessionConfig.variables[token] !== undefined) {
      return String(sessionConfig.variables[token]);
    }
    return "";
  });
}

function expandAction(action, sessionConfig, stack = []) {
  if (!action) {
    return [];
  }
  if (action.use) {
    if (stack.includes(action.use)) {
      throw new Error(`Session action reference cycle detected: ${[...stack, action.use].join(" -> ")}`);
    }
    const referenced = sessionConfig && sessionConfig.actionLibrary ? sessionConfig.actionLibrary[action.use] : undefined;
    if (!Array.isArray(referenced)) {
      throw new Error(`Unknown action library reference "${action.use}".`);
    }
    return referenced.flatMap((child) => expandAction(child, sessionConfig, [...stack, action.use]));
  }
  return [action];
}

function expandActions(actions, sessionConfig) {
  return (actions || []).flatMap((action) => expandAction(action, sessionConfig));
}

function resolveRouteProfile(sessionConfig, targetUrl) {
  if (!sessionConfig || !sessionConfig.routeProfiles || !targetUrl) {
    return null;
  }
  const target = String(targetUrl);
  for (const profile of sessionConfig.routeProfiles) {
    if (profile.match && new RegExp(profile.match).test(target)) {
      return profile;
    }
  }
  return null;
}

async function runAction(page, action, sessionConfig) {
  const baseUrl = sessionConfig && sessionConfig.baseUrl ? sessionConfig.baseUrl : undefined;
  const resolvedValue = resolveActionValue(action.value, sessionConfig);
  switch (action.type) {
    case "goto":
      await page.goto(resolveMaybeUrl(action.url || resolvedValue, baseUrl), { waitUntil: action.waitUntil || "networkidle" });
      return;
    case "fill":
      await page.locator(action.selector).fill(String(resolvedValue || ""));
      return;
    case "fillEnv":
      if (!action.env) {
        throw new Error("fillEnv action requires an env field.");
      }
      await page.locator(action.selector).fill(String(process.env[action.env] || ""));
      return;
    case "click":
      await page.locator(action.selector).click();
      return;
    case "press":
      await page.locator(action.selector).press(action.key || "Enter");
      return;
    case "waitForSelector":
      await page.locator(action.selector).waitFor({ state: action.state || "visible", timeout: action.timeout || 15000 });
      return;
    case "waitForURL":
      await page.waitForURL(resolvedValue || action.url, { timeout: action.timeout || 15000 });
      return;
    case "waitForTimeout":
      await page.waitForTimeout(resolvedValue || action.timeout || 1000);
      return;
    case "check":
      await page.locator(action.selector).waitFor({ state: action.state || "visible", timeout: action.timeout || 15000 });
      return;
    case "setViewport":
      await page.setViewportSize({
        width: Number(action.width || 1440),
        height: Number(action.height || 960)
      });
      return;
    default:
      throw new Error(`Unsupported session action "${action.type}".`);
  }
}

async function runActions(page, actions, sessionConfig) {
  for (const action of expandActions(actions, sessionConfig)) {
    await runAction(page, action, sessionConfig);
  }
}

async function applySession(page, sessionConfig, options = {}) {
  if (!sessionConfig) {
    return;
  }

  const entryUrl = sessionConfig.startUrl || sessionConfig.loginUrl || sessionConfig.baseUrl;
  if (entryUrl) {
    await page.goto(resolveMaybeUrl(entryUrl, sessionConfig.baseUrl), { waitUntil: sessionConfig.waitUntil || "networkidle" });
  }

  await runActions(page, sessionConfig.actions || [], sessionConfig);

  const routeProfile = resolveRouteProfile(sessionConfig, options.targetUrl);
  if (routeProfile && Array.isArray(routeProfile.afterLogin)) {
    await runActions(page, routeProfile.afterLogin, sessionConfig);
  }
}

async function createBrowserContext(options = {}) {
  const { chromium } = requirePlaywright();
  const browser = await chromium.launch({ headless: options.headless !== false });
  const context = await browser.newContext({
    storageState: options.storageStatePath && fs.existsSync(options.storageStatePath) ? options.storageStatePath : undefined,
    viewport: options.viewport || { width: 1440, height: 960 }
  });
  return { browser, context };
}

async function bootstrapSession(options = {}) {
  const sessionConfig = loadSessionConfig(options.sessionConfigPath);
  const { browser, context } = await createBrowserContext(options);
  const page = await context.newPage();

  if (sessionConfig || options.primeSession) {
    await applySession(page, sessionConfig || {}, { targetUrl: options.targetUrl });
  }

  if (options.storageStatePath) {
    fs.mkdirSync(path.dirname(options.storageStatePath), { recursive: true });
    await context.storageState({ path: options.storageStatePath });
  }

  return { browser, context, page, sessionConfig };
}

async function collectSameOriginLinks(page, rootUrl) {
  const base = new URL(rootUrl);
  const sameOrigin = `${base.protocol}//${base.host}`;
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors.map((anchor) => anchor.getAttribute("href")).filter(Boolean)
  );

  const urls = [];
  for (const href of links) {
    try {
      const resolved = new URL(href, rootUrl);
      if (`${resolved.protocol}//${resolved.host}` === sameOrigin) {
        urls.push(resolved.toString());
      }
    } catch (_) {
      continue;
    }
  }
  return Array.from(new Set(urls));
}

async function runAxeInPage(page, tags) {
  const axeSource = requireAxeSource();
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (selectedTags) => {
    return window.axe.run(document, {
      runOnly: selectedTags && selectedTags.length > 0 ? { type: "tag", values: selectedTags } : undefined
    });
  }, tags);
}

async function captureFindingScreenshot(page, finding, outputDir, index) {
  fs.mkdirSync(outputDir, { recursive: true });
  const fileName = `finding-${String(index + 1).padStart(3, "0")}-${slugify(finding.ruleId || "issue")}.png`;
  const outputPath = path.join(outputDir, fileName);
  try {
    if (finding.selector) {
      const locator = page.locator(finding.selector).first();
      if (await locator.count()) {
        await locator.screenshot({ path: outputPath });
        return outputPath;
      }
    }
  } catch (_) {

  }

  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

module.exports = {
  applySession,
  bootstrapSession,
  captureFindingScreenshot,
  collectSameOriginLinks,
  expandActions,
  loadSessionConfig,
  resolveActionValue,
  resolveRouteProfile,
  runAxeInPage,
  runActions,
  slugify
};
