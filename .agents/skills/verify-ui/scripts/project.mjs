import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { checkoutPort } from "./ports.mjs";

function findRoot() {
  if (process.env.FSTACK_PROJECT_DIR) return resolve(process.env.FSTACK_PROJECT_DIR);
  const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : process.cwd();
}

export const ROOT = findRoot();
export const CONFIG_FILE = join(ROOT, ".cursor/fstack/config.json");

if (!existsSync(CONFIG_FILE)) {
  console.error(`fstack: ${CONFIG_FILE} is missing. Run /setup-fstack in this project first.`);
  process.exit(2);
}

export const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
export const APP = resolve(ROOT, config.app ?? ".");
export const requireFromApp = createRequire(join(APP, "package.json"));

function readDotEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export const DOTENV = readDotEnv(join(APP, ".env"));

function resolvePort(verifyPort, dotenv) {
  const raw =
    process.env.FSTACK_VERIFY_PORT ??
    checkoutPort({ root: ROOT, role: "verify", main: verifyPort ?? dotenv.PORT });
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(
      "fstack: no verify port. Set PORT in the app .env, or verify.port to that value.",
    );
    process.exit(2);
  }
  return port;
}

const verify = config.verify ?? {};
export const VERIFY = {
  host: process.env.FSTACK_VERIFY_HOST ?? verify.host ?? "127.0.0.1",
  port: resolvePort(verify.port, DOTENV),
  build: verify.build ?? null,
  buildOutput: verify.buildOutput ?? null,
  serve: verify.serve ?? null,
  prepare: verify.prepare ?? null,
  dataDir: verify.dataDir ?? null,
  env: verify.env ?? {},
  readyText: verify.readyText ?? null,
  appReady: verify.appReady ?? null,
  sourcePaths: verify.sourcePaths ?? ["src"],
  sourceExclude: verify.sourceExclude ?? [],
  sectionSharedPaths: verify.sectionSharedPaths ?? [],
};

export const baseUrl = (port = VERIFY.port) => `http://${VERIFY.host}:${port}`;

export const targetOrigin = () => process.env.VERIFY_BASE_URL || baseUrl();

export const isVerifyOrigin = (origin) => origin === baseUrl();

export const devPort = () =>
  Number(process.env.FSTACK_DEV_PORT ?? checkoutPort({ root: ROOT, role: "dev", main: 4321 }));

export const isDevOrigin = (origin) => origin === baseUrl(devPort());

export function fill(template, port = VERIFY.port) {
  return String(template)
    .replaceAll("{host}", VERIFY.host)
    .replaceAll("{port}", String(port))
    .replaceAll("{url}", baseUrl(port))
    .replaceAll("{dataDir}", VERIFY.dataDir ?? "");
}

export function resolveDataDir() {
  if (!VERIFY.dataDir) return null;
  const abs = resolve(APP, fill(VERIFY.dataDir));
  const rel = relative(APP, abs);
  if (!rel || rel.startsWith("..")) {
    console.error(
      `fstack: verify.dataDir must be a directory inside the app, got ${VERIFY.dataDir}`,
    );
    process.exit(2);
  }
  return abs;
}

export function commandEnv(port = VERIFY.port) {
  const fromFile = Object.fromEntries(
    Object.entries(DOTENV).filter(([key]) => process.env[key] === undefined),
  );
  return {
    ...process.env,
    ...fromFile,
    ...Object.fromEntries(Object.entries(VERIFY.env).map(([key, value]) => [key, fill(value, port)])),
  };
}

const rootId = createHash("sha1").update(ROOT).digest("hex").slice(0, 8);
export const STATE_DIR =
  process.env.FSTACK_STATE_DIR ?? join(tmpdir(), "fstack-verify", `${basename(ROOT)}-${rootId}`);
export const ARTIFACTS = process.env.FSTACK_ARTIFACTS_DIR ?? join(ROOT, ".cursor/fstack/artifacts");

export const VIEWPORTS = Object.fromEntries(
  Object.entries(config.viewports ?? { default: { width: 1280, height: 800 } }).map(
    ([name, { width, height, ...rest }]) => [name, { viewport: { width, height }, ...rest }],
  ),
);
export const DEFAULT_VIEWPORT = config.defaultViewport ?? Object.keys(VIEWPORTS)[0];
export const OVERFLOW_WIDTHS = config.overflowWidths ?? [1440, 1024, 768, 375];

export { isMain } from "./cli-help.mjs";
