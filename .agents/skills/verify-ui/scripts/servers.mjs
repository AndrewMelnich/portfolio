import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP,
  ARTIFACTS,
  ROOT,
  VERIFY,
  baseUrl,
  commandEnv,
  devPort,
  fill,
} from "./project.mjs";
import { checkoutPort } from "./ports.mjs";
import { listHolders, pidAlive, releaseSlotById, sleep } from "./slots.mjs";

const SERVERS_DIR = join(ARTIFACTS, "servers");
const DEFAULT_TIMEOUT_S = 120;
const LOG_TAIL_CHARS = 3_000;
const STOP_GRACE_MS = 5_000;

export const SERVER_KINDS = {
  dev: {
    defaultPort: devPort,
    command: ({ port }) =>
      `exec pnpm exec astro dev --ignore-lock --host ${VERIFY.host} --port ${port}`,
    readyPath: ({ path }) => path ?? "/",
    readyText: () => null,
  },
  preview: {
    defaultPort: () => VERIFY.port,
    precheck: () => {
      if (!VERIFY.serve) return "verify.serve is missing in .cursor/fstack/config.json.";
      if (VERIFY.buildOutput && !existsSync(join(APP, VERIFY.buildOutput))) {
        return `${join(APP, VERIFY.buildOutput)} is missing. Run \`control launch\` once to build.`;
      }
      return null;
    },
    command: ({ port }) => `exec ${fill(VERIFY.serve, port)}`,
    readyPath: ({ path }) => path ?? "/",
    readyText: () => VERIFY.readyText,
  },
  storybook: {
    role: "storybook",
    mainPort: 6006,
    portEnv: "FSTACK_STORYBOOK_PORT",
    command: () => "exec pnpm storybook --ci --no-open",
    env: ({ port, stories }) => ({
      SBCONFIG_PORT: String(port),
      ...(stories ? { STORYBOOK_STORIES: stories } : {}),
    }),
    readyPath: () => "/index.json",
    readyText: () => null,
  },
};

export function isServerKind(kind) {
  return Object.hasOwn(SERVER_KINDS, kind);
}

export function serverFiles(kind) {
  return {
    pid: join(SERVERS_DIR, `${kind}.pid`),
    meta: join(SERVERS_DIR, `${kind}.json`),
    log: join(SERVERS_DIR, `${kind}.log`),
  };
}

export function serverPort(kind, flagPort) {
  const def = SERVER_KINDS[kind];
  const raw =
    flagPort ??
    (def.portEnv ? process.env[def.portEnv] : undefined) ??
    (def.defaultPort
      ? def.defaultPort()
      : checkoutPort({ root: ROOT, role: def.role, main: def.mainPort }));
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${kind}: invalid port "${raw}".`);
  }
  return port;
}

function groupAlive(pid) {
  return pidAlive(-pid);
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {}
  }
}

export async function stopGroup(pid) {
  signalGroup(pid, "SIGTERM");
  const start = Date.now();
  while (groupAlive(pid) && Date.now() - start < STOP_GRACE_MS) {
    await sleep(150);
  }
  if (groupAlive(pid)) {
    signalGroup(pid, "SIGKILL");
    while (groupAlive(pid)) await sleep(50);
  }
}

export function isPortFree(port, host = VERIFY.host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

export async function fetchWithTimeout(url, timeoutMs = 2_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isHealthy(url, readyText) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return false;
    return !readyText || (await res.text()).includes(readyText);
  } catch {
    return false;
  }
}

function listenerDir(port) {
  const owner = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"], {
    encoding: "utf8",
  });
  const pid = owner.stdout?.split("\n").find((line) => line.startsWith("p"))?.slice(1);
  if (!pid) return null;
  const cwd = spawnSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" });
  const dir = cwd.stdout?.split("\n").find((line) => line.startsWith("n"))?.slice(1);
  return dir ? canonicalRoot(dir) : null;
}

function readRecord(kind) {
  const files = serverFiles(kind);
  if (!existsSync(files.pid)) return null;
  const pid = Number(readFileSync(files.pid, "utf8"));
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const meta = existsSync(files.meta)
    ? JSON.parse(readFileSync(files.meta, "utf8"))
    : {};
  return { pid, ...meta };
}

function clearRecord(kind) {
  const files = serverFiles(kind);
  rmSync(files.pid, { force: true });
  rmSync(files.meta, { force: true });
}

function logTail(kind) {
  const { log } = serverFiles(kind);
  return existsSync(log) ? readFileSync(log, "utf8").slice(-LOG_TAIL_CHARS) : "";
}

function describeTarget(kind, opts) {
  const def = SERVER_KINDS[kind];
  const port = serverPort(kind, opts.port);
  const url = baseUrl(port);
  return {
    def,
    port,
    url,
    healthUrl: `${url}${def.readyPath(opts)}`,
    readyText: def.readyText(opts),
  };
}

export function spawnDetached({ command, cwd, env, logFile }) {
  mkdirSync(SERVERS_DIR, { recursive: true });
  const logFd = openSync(logFile, "w");
  try {
    const child = spawn("sh", ["-c", command], {
      cwd,
      env,
      stdio: ["ignore", logFd, logFd],
      detached: true,
    });
    const exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    child.unref();
    return { pid: child.pid, exited };
  } finally {
    closeSync(logFd);
  }
}

async function waitHealthy({ healthUrl, readyText, timeoutMs, exited }) {
  let early = null;
  exited.then((result) => {
    early = result;
  });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (early) return { ok: false, early };
    if (await isHealthy(healthUrl, readyText)) return { ok: true };
    await sleep(400);
  }
  return { ok: false, early };
}

export async function up(kind, opts = {}) {
  const { def, port, url, healthUrl, readyText } = describeTarget(kind, opts);
  const files = serverFiles(kind);
  const record = readRecord(kind);

  if (record && !groupAlive(record.pid)) clearRecord(kind);

  const live = Boolean(record) && groupAlive(record.pid);
  if (live && record.port === port) {
    const settled = await waitHealthy({
      healthUrl,
      readyText,
      timeoutMs: (opts.timeoutS ?? DEFAULT_TIMEOUT_S) * 1_000,
      exited: new Promise(() => {}),
    });
    if (settled.ok) {
      return { ok: true, kind, url, port, pid: record.pid, reused: true, managed: true, log: files.log };
    }
    return {
      ok: false,
      kind,
      error: `${kind} (pid ${record.pid}) is running but ${healthUrl} never answered 200. Run \`control down ${kind}\` to restart it.`,
      logTail: logTail(kind),
      log: files.log,
    };
  }
  if (live) {
    await stopGroup(record.pid);
    clearRecord(kind);
  }

  if (!(await isPortFree(port))) {
    if (await isHealthy(healthUrl, readyText)) {
      const dir = listenerDir(port);
      if (dir && !insideRoot(dir, canonicalRoot(ROOT))) {
        return {
          ok: false,
          kind,
          error: `port ${port} is busy: it answers as a ${kind} server but runs from ${dir}, not this checkout. Free it or pass --port.`,
        };
      }
      return { ok: true, kind, url, port, pid: null, reused: true, managed: false, log: null };
    }
    return {
      ok: false,
      kind,
      error: `port ${port} is busy and does not answer as a ${kind} server. Free it or pass --port.`,
    };
  }

  const blocked = def.precheck?.(opts);
  if (blocked) return { ok: false, kind, error: blocked };

  const env = { ...commandEnv(port), ...def.env?.({ ...opts, port }) };
  const { pid, exited } = spawnDetached({
    command: def.command({ ...opts, port }),
    cwd: APP,
    env,
    logFile: files.log,
  });
  writeFileSync(files.pid, String(pid));
  writeFileSync(
    files.meta,
    JSON.stringify({ kind, port, url, startedAt: new Date().toISOString() }, null, 2),
  );

  const timeoutMs = (opts.timeoutS ?? DEFAULT_TIMEOUT_S) * 1_000;
  const waited = await waitHealthy({ healthUrl, readyText, timeoutMs, exited });
  if (waited.ok) {
    return { ok: true, kind, url, port, pid, reused: false, managed: true, log: files.log };
  }

  await stopGroup(pid);
  clearRecord(kind);
  const reason = waited.early
    ? `server exited early (code=${waited.early.code}, signal=${waited.early.signal})`
    : `${healthUrl} never answered 200 within ${timeoutMs / 1_000}s`;
  return { ok: false, kind, error: `${kind} failed: ${reason}.`, logTail: logTail(kind), log: files.log };
}

export async function down(kind, opts = {}) {
  const port = serverPort(kind, opts.port);
  const record = readRecord(kind);
  if (!record) {
    const free = await isPortFree(port);
    return {
      kind,
      stopped: false,
      port,
      note: free
        ? "no recorded server"
        : `port ${port} is busy but was not started by control; left running`,
    };
  }
  const wasAlive = groupAlive(record.pid);
  if (wasAlive) await stopGroup(record.pid);
  clearRecord(kind);
  return { kind, stopped: wasAlive, pid: record.pid, port: record.port ?? port };
}

export async function status(kind, opts = {}) {
  const { port, url, healthUrl, readyText } = describeTarget(kind, opts);
  const files = serverFiles(kind);
  const record = readRecord(kind);
  const alive = Boolean(record) && groupAlive(record.pid);
  const healthy = await isHealthy(healthUrl, readyText);
  return {
    kind,
    running: alive,
    pid: alive ? record.pid : null,
    port: alive ? (record.port ?? port) : port,
    url,
    healthy,
    log: existsSync(files.log) ? files.log : null,
  };
}

const CONTROL_SCRIPT = fileURLToPath(new URL("./control.mjs", import.meta.url));
const HOLDER_ENV_OVERRIDES = ["FSTACK_STATE_DIR", "FSTACK_ARTIFACTS_DIR"];
const HOLDER_STOP_TIMEOUT_MS = 60_000;

function canonicalRoot(path) {
  const absolute = resolve(path);
  try {
    return realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function insideRoot(root, parent) {
  return root === parent || root.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

async function waitUntilGone(pid) {
  const start = Date.now();
  while (pidAlive(pid) && Date.now() - start < STOP_GRACE_MS) await sleep(100);
}

function stopHolderThroughItsRoot(holder) {
  if (holder.kind !== "launch" || !existsSync(holder.root)) return;
  const env = { ...process.env, FSTACK_PROJECT_DIR: holder.root };
  for (const name of HOLDER_ENV_OVERRIDES) delete env[name];
  spawnSync(process.execPath, [CONTROL_SCRIPT, "cleanup"], {
    cwd: holder.root,
    env,
    stdio: "ignore",
    timeout: HOLDER_STOP_TIMEOUT_MS,
  });
}

export async function releaseForeignHolders({ allow }) {
  const allowed = allow.map(canonicalRoot);
  const released = [];
  const kept = [];
  for (const holder of await listHolders()) {
    const root = canonicalRoot(holder.root);
    if (holder.pid === process.pid || allowed.some((parent) => insideRoot(root, parent))) {
      kept.push(holder);
      continue;
    }
    stopHolderThroughItsRoot(holder);
    if (pidAlive(holder.pid)) await stopGroup(holder.pid);
    await waitUntilGone(holder.pid);
    releaseSlotById(holder.id);
    released.push({ ...holder, stopped: !pidAlive(holder.pid) });
  }
  return { released, kept };
}
