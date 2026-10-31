#!/usr/bin/env node
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP,
  ARTIFACTS,
  DEFAULT_VIEWPORT,
  STATE_DIR,
  VERIFY,
  VIEWPORTS,
  baseUrl,
  commandEnv,
  devPort,
  fill,
  isMain,
  requireFromApp,
  resolveDataDir,
  ROOT,
} from "./project.mjs";
import {
  down,
  fetchWithTimeout,
  isPortFree,
  isServerKind,
  releaseForeignHolders,
  status,
  up,
} from "./servers.mjs";
import {
  GIB_PER_SLOT,
  IMPLEMENTER_DEV_GIB,
  IMPLEMENTER_MAX,
  SLOT_PEAK_GIB,
  SLOT_RAM_SHARE,
  defaultCap,
  defaultImplementerCap,
  acquireSlot,
  describeWait,
  listHolders,
  pidAlive,
  releaseSlot,
  resolveCap,
  resolveImplementerCap,
  sleep,
  slotsDir,
} from "./slots.mjs";
import {
  readBuildSource,
  sourceHash,
  writeBuildSource,
} from "./source-stamp.mjs";
import { recordScreenshot } from "./receipt.mjs";
import { ticketScope } from "./scope.mjs";
import { gotoReady, waitPageReady } from "./ready-wait.mjs";

const playwright = requireFromApp("playwright");
const PID_FILE = join(STATE_DIR, "server.pid");
const META_FILE = join(STATE_DIR, "server.meta.json");
const DEFAULT_PORT = VERIFY.port;

function capSummary(resolve) {
  try {
    return String(resolve());
  } catch (error) {
    return error.message;
  }
}

function usage(exit = 1) {
  const write = exit === 0 ? console.log : console.error;
  write(`Usage:
  control launch [--port N] [--skip-build]
  control relaunch [--port N] [--skip-build]
  control doctor [--user-origin <url>]
  control cleanup
  control up <dev|preview|storybook> [--port N] [--path /route] [--stories <glob>] [--timeout S]
  control down <dev|preview|storybook> [--port N]
  control status <dev|preview|storybook> [--port N] [--path /route]
  control holders
  control release-foreign [--allow <root>]...
  control browser [context flags] <step> | flow [--file F]

Servers (up|down|status, one idempotent command per kind; do not write your own launch, kill or wait logic):
  up      reuses a healthy server on the port; otherwise spawns it detached in its own process group, writes <kind>.pid and <kind>.log under ${join(ARTIFACTS, "servers")},
          waits for readiness (dev, preview: HTTP 200 on --path, default /; storybook: /index.json) and prints JSON with the url.
          Exits 1 with the log tail when the server exits early or is not ready within --timeout (default 120 s).
  down    kills the whole process group from the pidfile and removes it; exits 0 when nothing is running
  status  prints JSON (running, pid, port, url, healthy, log); exits 1 unless the server is healthy
  Kinds and ports: dev = astro dev, port main 4321 / worktree 5100-5399 (FSTACK_DEV_PORT overrides);
  preview = verify.serve on the verify port without build (run launch first);
  storybook = pnpm storybook --ci --no-open, port main 6006 / worktree 6500-6799 (FSTACK_STORYBOOK_PORT overrides).
  --stories sets STORYBOOK_STORIES, a comma-separated list of story globs relative to the app root.

Implementer cap (machine-wide count of Section implementers a page fan-out runs at once; it limits agents, takes no slot, and is not the heavy cap below):
  Implementer cap now: ${capSummary(resolveImplementerCap)}. Default: the RAM share left after the default heavy slots, divided by ${IMPLEMENTER_DEV_GIB} GB per idle dev server, at most ${IMPLEMENTER_MAX} (${defaultImplementerCap(16 * 1024 ** 3)} on a 16 GB machine, see slot-sizing.md). FSTACK_MAX_IMPLEMENTERS=<n> overrides it and leaves the heavy cap alone.

Heavy-process cap (machine-wide, shared by all worktrees):
  A slot is held only while Chromium or a build runs. launch/relaunch hold one while they prepare and build, and release it before the preview starts. layout-proof, token-check, visual-compare, motion-probe, console-check and overflow-check hold one per invocation around their work (a layout-proof run over several manifests or --dir is one), released when the script exits or dies. up/down/status of dev, preview and storybook never take a slot. At the cap a command waits and prints its queue position and the holders on stderr, repeated every 15 s (FSTACK_SLOT_HEARTBEAT_MS), instead of failing.
  Slots now: ${capSummary(resolveCap)}. Default: one slot per ${GIB_PER_SLOT} GB of RAM (${SLOT_PEAK_GIB} GB peak per slot over ${SLOT_RAM_SHARE} of RAM, see slot-sizing.md), minimum 1 (${defaultCap(16 * 1024 ** 3)} on a 16 GB machine). FSTACK_MAX_HEAVY=<n> overrides it and leaves the implementer cap alone.
  A dead holder's slot is reclaimed by pid liveness. Slot files live in ${slotsDir()} (FSTACK_SLOTS_DIR overrides).

Slot holders (who holds the heavy-process slots):
  holders          prints JSON {cap, holders[]}; each holder has id, pid, kind (launch, layout-proof, token-check, visual-compare, motion-probe, console-check or overflow-check), root (the checkout that took the slot), at (when it took it) and ageSeconds. Dead holders are dropped first.
  release-foreign  frees the slots whose root is outside the allowed checkouts and stops the process that holds each one. A launch holder goes through its checkout's cleanup first; every holder's process that is still alive is then stopped by pid group (or by pid when it leads no group). Holders with an allowed root are left untouched.
                   Allowed checkouts: each --allow <root> (repeatable; a root inside an allowed one counts). Without --allow, only this checkout is allowed. With --allow, this checkout is allowed only when it is listed.
                   Prints JSON {released[], kept[]}; each released holder carries stopped (true when its process is gone). Exits 0 when nothing is foreign.
                   Run it from any checkout before a fan-out so a stuck build or browser run of another checkout cannot hold a slot. Servers hold no slot, so it leaves them running.

Context flags (before the step; one context for the whole flow):
  --viewport ${Object.keys(VIEWPORTS).join("|")}|<W>x<H>   default ${DEFAULT_VIEWPORT}
  --motion                  reducedMotion: no-preference (default: reduce)
  --engine chromium|webkit|firefox
  --device "<Playwright device>"   e.g. "iPhone 15" (pair with --engine webkit)

Steps (target = --selector S | --role R --name N | --name N | --aria-label L, plus --nth i):
  goto <path|absolute url>
  click <target>
  hover <target>
  leave                     moves the pointer off the bottom-right corner (the other half of a hover)
  fill --name <label> --value <value>
  press --key <key>
  scroll [--selector S] (--by N | --to N | --into S2) [--repeat K]   scrolls S (scrollport) or the window; --repeat = one step per frame
  wait --ms N | --selector S [--state visible|hidden|attached] | --js <expression>
  snapshot --aria --path <file>
  screenshot --path <file> [--selector S [--nth i]] [--full]
  eval --js <expression>

Examples:
  node .agents/skills/verify-ui/scripts/control.mjs up dev --path /team/
  node .agents/skills/verify-ui/scripts/control.mjs up storybook --stories "src/shared/ui/Tabs/Tabs.stories.ts"
  node .agents/skills/verify-ui/scripts/control.mjs status dev
  node .agents/skills/verify-ui/scripts/control.mjs down dev
  node .agents/skills/verify-ui/scripts/control.mjs launch --port 4328
  node .agents/skills/verify-ui/scripts/control.mjs holders
  node .agents/skills/verify-ui/scripts/control.mjs release-foreign --allow ~/.cursor/worktrees/plenum/1 --allow ~/.cursor/worktrees/plenum/2
  node .agents/skills/verify-ui/scripts/control.mjs doctor
  node .agents/skills/verify-ui/scripts/control.mjs doctor --user-origin http://localhost:3000
  node .agents/skills/verify-ui/scripts/control.mjs browser --viewport 375 goto /faq/
  node .agents/skills/verify-ui/scripts/control.mjs browser --viewport 375 screenshot --path .cursor/fstack/artifacts/faq/mobile.png --full
  node .agents/skills/verify-ui/scripts/control.mjs browser flow --file .cursor/fstack/artifacts/faq/steps.txt
  node .agents/skills/verify-ui/scripts/control.mjs cleanup
`);
  process.exit(exit);
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function resetDataDir() {
  const dir = resolveDataDir();
  if (!dir) return;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function runCommand(command, env) {
  const child = spawn("sh", ["-c", command], {
    cwd: APP,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => {
    log += d.toString();
  });
  child.stderr.on("data", (d) => {
    log += d.toString();
  });
  return new Promise((resolve) => {
    child.on("close", (code) => resolve({ code, log }));
  });
}

function readMeta() {
  if (!existsSync(META_FILE)) return null;
  return JSON.parse(readFileSync(META_FILE, "utf8"));
}

async function waitReady(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const body = await res.text();
        if (!VERIFY.readyText || body.includes(VERIFY.readyText)) return true;
      }
    } catch {
    }
    await sleep(400);
  }
  return false;
}

async function killPortListeners(port) {
  const lsof = spawn("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  let out = "";
  lsof.stdout.on("data", (d) => {
    out += d.toString();
  });
  const code = await new Promise((resolve) => lsof.on("close", resolve));
  if (code !== 0 || !out.trim()) return [];

  const pids = [
    ...new Set(
      out
        .split(/\s+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
    }
  }
  const start = Date.now();
  while (Date.now() - start < 3_000) {
    if (await isPortFree(port)) break;
    await sleep(150);
  }
  if (!(await isPortFree(port))) {
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
      }
    }
  }
  return pids;
}

function failLaunch(slot) {
  releaseSlot(slot);
  process.exit(1);
}

async function cmdLaunch(args) {
  const portFlag = args.indexOf("--port");
  const port = portFlag >= 0 ? Number(args[portFlag + 1]) : DEFAULT_PORT;
  if (!Number.isFinite(port)) usage();

  ensureDir(STATE_DIR);
  if (existsSync(PID_FILE)) {
    const old = Number(readFileSync(PID_FILE, "utf8"));
    if (pidAlive(old)) {
      console.error(
        `Refusing launch: verify instance already running (pid ${old}). Run cleanup first.`,
      );
      process.exit(2);
    }
  }

  if (!(await isPortFree(port))) {
    console.error(
      `Refusing launch: port ${port} is busy (orphan preview?). Run cleanup first.`,
    );
    process.exit(2);
  }

  const url = baseUrl(port);
  if (!VERIFY.serve) {
    console.error("launch: verify.serve is missing in .cursor/fstack/config.json.");
    process.exit(2);
  }
  const env = commandEnv(port);
  const skipBuild =
    process.env.FSTACK_VERIFY_SKIP_BUILD === "1" || args.includes("--skip-build") || !VERIFY.build;
  const buildMarker = VERIFY.buildOutput ? join(APP, VERIFY.buildOutput) : null;
  if (skipBuild && VERIFY.build && buildMarker && !existsSync(buildMarker)) {
    console.error(
      `launch: --skip-build requested but ${buildMarker} is missing. Run a full launch once.`,
    );
    process.exit(1);
  }
  const slot = await acquireSlot({
    kind: "launch",
    root: ROOT,
    onWait: (wait) => console.error(describeWait(wait)),
  });
  const source = sourceHash();
  if (skipBuild && VERIFY.build && readBuildSource() !== source) {
    console.error(
      "launch: --skip-build refused: the build is older than the current source. Run launch without --skip-build.",
    );
    failLaunch(slot);
  }
  resetDataDir();
  if (VERIFY.prepare) {
    console.error(`launch: preparing (${VERIFY.prepare})…`);
    const prepared = await runCommand(fill(VERIFY.prepare, port), env);
    if (prepared.code !== 0) {
      console.error("Launch failed: prepare exited non-zero.");
      console.error(prepared.log.slice(-3000));
      failLaunch(slot);
    }
  }
  if (!skipBuild) {
    console.error(`launch: building (${VERIFY.build})…`);
    const built = await runCommand(fill(VERIFY.build, port), env);
    if (built.code !== 0) {
      console.error("Launch failed: build exited non-zero.");
      console.error(built.log.slice(-3000));
      failLaunch(slot);
    }
  } else {
    console.error("launch: skipping build");
  }
  writeBuildSource(source);
  releaseSlot(slot);

  const child = spawn("sh", ["-c", `exec ${fill(VERIFY.serve, port)}`], {
    cwd: APP,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  let log = "";
  child.stdout.on("data", (d) => {
    log += d.toString();
  });
  child.stderr.on("data", (d) => {
    log += d.toString();
  });

  writeFileSync(PID_FILE, String(child.pid));
  writeFileSync(
    META_FILE,
    JSON.stringify(
      {
        pid: child.pid,
        port,
        url,
        mode: "preview",
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  let exitedEarly = null;
  child.once("exit", (code, signal) => {
    exitedEarly = { code, signal };
  });

  const ready = await waitReady(url);
  child.stdout.removeAllListeners();
  child.stderr.removeAllListeners();
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();

  if (exitedEarly) {
    console.error(
      `Launch failed: server exited early (code=${exitedEarly.code}, signal=${exitedEarly.signal}).`,
    );
    console.error(log.slice(-2000));
    await cmdCleanup();
    process.exit(1);
  }

  if (!ready) {
    console.error(
      `Launch failed: ${url} never answered 200${VERIFY.readyText ? ` with "${VERIFY.readyText}"` : ""}.`,
    );
    console.error(log.slice(-2000));
    await cmdCleanup();
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      { ok: true, pid: child.pid, url, port, mode: "preview" },
      null,
      2,
    ),
  );
}

const LOOPBACK_NAMES = ["localhost", "127.0.0.1"];
const STAMP_TAG = /<meta\b[^>]*\bname="fstack-source-stamp"[^>]*>/;
const DEV_STAMP = "dev:";

function stampFrom(html) {
  const tag = STAMP_TAG.exec(html)?.[0];
  return tag ? (/\bcontent="([^"]*)"/.exec(tag)?.[1] ?? null) : null;
}

async function probeLoopbackName(origin, host, current) {
  const url = new URL("/", origin);
  url.hostname = host;
  try {
    const res = await fetchWithTimeout(url.href);
    const stamp = stampFrom(await res.text());
    if (stamp?.startsWith(DEV_STAMP)) {
      const root = stamp.slice(DEV_STAMP.length);
      return { url: url.href, reachable: true, httpStatus: res.status, stamp, mode: "dev", root, stale: root !== ROOT };
    }
    return { url: url.href, reachable: true, httpStatus: res.status, stamp, mode: "build", stale: stamp !== current };
  } catch (e) {
    return { url: url.href, reachable: false, error: e.message, stamp: null, stale: false };
  }
}

function parseLsofFields(out) {
  const byPid = new Map();
  let pid = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
      if (!byPid.has(pid)) byPid.set(pid, { pid, command: null });
    } else if (line.startsWith("c") && pid !== null) {
      byPid.get(pid).command = line.slice(1);
    }
  }
  return [...byPid.values()];
}

function listeningProcesses(port) {
  return new Promise((resolve) => {
    const lsof = spawn("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    lsof.stdout.on("data", (d) => {
      out += d.toString();
    });
    lsof.on("error", () => resolve([]));
    lsof.on("close", () => resolve(parseLsofFields(out)));
  });
}

async function cmdDoctorUserOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    console.error(`doctor: --user-origin expects an absolute URL, got "${origin}".`);
    process.exit(2);
  }
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const current = sourceHash();
  const names = {};
  for (const host of LOOPBACK_NAMES) {
    names[host] = await probeLoopbackName(url, host, current);
  }
  const report = {
    userOrigin: url.origin,
    port,
    sourceStamp: current,
    names,
    listeners: await listeningProcesses(port),
    stale: Object.values(names).some((name) => name.stale),
  };
  report.ok = !report.stale && Object.values(names).some((name) => name.reachable);
  console.log(JSON.stringify(report, null, 2));
  const otherRoots = Object.values(names).filter((name) => name.mode === "dev" && name.stale);
  if (otherRoots.length > 0) {
    console.error(
      `doctor: the dev server on port ${port} serves another checkout (${otherRoots.map((name) => name.root).join(", ")}), not ${ROOT}.`,
    );
  } else if (report.stale) {
    console.error(
      "doctor: the user origin serves a build that is not the current source, or has no build stamp. Restart that dev server or rebuild it, then check again.",
    );
  } else if (!report.ok) {
    console.error(`doctor: no loopback name answered on port ${port}.`);
  }
  if (!report.ok) process.exit(1);
}

async function cmdDoctor(args = []) {
  const userOriginAt = args.indexOf("--user-origin");
  if (userOriginAt >= 0) return cmdDoctorUserOrigin(args[userOriginAt + 1]);
  const meta = readMeta();
  if (!meta) {
    console.error("doctor: no verify instance meta. Run launch first.");
    process.exit(1);
  }
  if (!pidAlive(meta.pid)) {
    console.error(`doctor: pid ${meta.pid} is not alive.`);
    process.exit(1);
  }
  let res;
  try {
    res = await fetchWithTimeout(meta.url + "/");
  } catch (e) {
    console.error(`doctor: fetch failed: ${e.message}`);
    process.exit(1);
  }
  const body = await res.text();
  const hasBrand = !VERIFY.readyText || body.includes(VERIFY.readyText);
  const stale = readBuildSource() !== sourceHash();
  const report = {
    ok: res.ok && hasBrand && !stale,
    pid: meta.pid,
    url: meta.url,
    port: meta.port,
    httpStatus: res.status,
    hasBrand,
    stale,
    ownedByUs: pidAlive(meta.pid),
  };
  console.log(JSON.stringify(report, null, 2));
  if (stale) {
    console.error(
      "doctor: preview serves an older build than the current source. Run relaunch (full build).",
    );
  }
  if (!report.ok) process.exit(1);
}

function parseServerArgs(args) {
  const [kind, ...rest] = args;
  if (!isServerKind(kind)) usage();
  const value = (name) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
  };
  const timeout = value("--timeout");
  if (timeout !== undefined && !(Number(timeout) > 0)) usage();
  return {
    kind,
    opts: {
      port: value("--port"),
      path: value("--path"),
      stories: value("--stories"),
      timeoutS: timeout === undefined ? undefined : Number(timeout),
    },
  };
}

async function cmdUp(args) {
  const { kind, opts } = parseServerArgs(args);
  const report = await up(kind, opts);
  if (!report.ok) {
    console.error(report.error);
    if (report.logTail) {
      console.error(`--- tail of ${report.log} ---`);
      console.error(report.logTail);
    }
    process.exit(1);
  }
  console.log(JSON.stringify(report, null, 2));
}

async function cmdDown(args) {
  const { kind, opts } = parseServerArgs(args);
  console.log(JSON.stringify(await down(kind, opts), null, 2));
}

async function cmdStatus(args) {
  const { kind, opts } = parseServerArgs(args);
  const report = await status(kind, opts);
  console.log(JSON.stringify(report, null, 2));
  if (!report.healthy) process.exit(1);
}

async function cmdHolders() {
  const now = Date.now();
  const holders = (await listHolders()).map((holder) => ({
    ...holder,
    ageSeconds: Math.max(0, Math.round((now - Date.parse(holder.at)) / 1_000)),
  }));
  console.log(JSON.stringify({ cap: resolveCap(), holders }, null, 2));
}

async function cmdReleaseForeign(args) {
  const allow = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== "--allow" || !args[i + 1]) usage();
    allow.push(args[i + 1]);
    i += 1;
  }
  const report = await releaseForeignHolders({ allow: allow.length ? allow : [ROOT] });
  console.log(JSON.stringify(report, null, 2));
}

async function cmdRelaunch(args) {
  await cmdCleanup();
  await cmdLaunch(args);
}

async function cmdCleanup() {
  const meta = readMeta();
  const port = meta?.port ?? DEFAULT_PORT;
  if (meta?.pid && pidAlive(meta.pid)) {
    try {
      process.kill(-meta.pid, "SIGTERM");
    } catch {
      try {
        process.kill(meta.pid, "SIGTERM");
      } catch {
      }
    }
    const start = Date.now();
    while (pidAlive(meta.pid) && Date.now() - start < 5000) {
      await sleep(200);
    }
    if (pidAlive(meta.pid)) {
      try {
        process.kill(-meta.pid, "SIGKILL");
      } catch {
        try {
          process.kill(meta.pid, "SIGKILL");
        } catch {
        }
      }
    }
    console.log(`cleanup: stopped pid ${meta.pid}`);
  } else {
    console.log("cleanup: no live verify pid");
  }

  if (!(await isPortFree(port))) {
    const killed = await killPortListeners(port);
    if (killed.length) {
      console.log(
        `cleanup: freed port ${port} (killed orphan pid(s): ${killed.join(", ")})`,
      );
    }
  }

  for (const f of [PID_FILE, META_FILE]) {
    if (existsSync(f)) unlinkSync(f);
  }
  console.log(`cleanup: evidence kept at ${ARTIFACTS}`);
}

const BROWSER_STATE = join(STATE_DIR, "browser.json");

const CONTEXT_FLAGS = new Set(["--viewport", "--engine", "--device"]);

function parseContextFlags(args) {
  const flags = {
    viewport: DEFAULT_VIEWPORT,
    motion: false,
    engine: "chromium",
    device: null,
  };
  let i = 0;
  while (i < args.length) {
    if (args[i] === "--motion") {
      flags.motion = true;
      i += 1;
    } else if (CONTEXT_FLAGS.has(args[i])) {
      flags[args[i].slice(2)] = args[i + 1];
      i += 2;
    } else {
      break;
    }
  }
  return { flags, rest: args.slice(i) };
}

function contextOptions(flags) {
  if (flags.device) {
    const device = playwright.devices[flags.device];
    if (!device) throw new Error(`unknown --device "${flags.device}"`);
    return { ...device };
  }
  if (VIEWPORTS[flags.viewport]) return { ...VIEWPORTS[flags.viewport] };
  const match = /^(\d+)x(\d+)$/.exec(flags.viewport);
  if (!match)
    throw new Error(
      `--viewport expects ${Object.keys(VIEWPORTS).join("|")} or WxH`,
    );
  return { viewport: { width: Number(match[1]), height: Number(match[2]) } };
}

function launchBrowser(engineName = "chromium") {
  const engine = playwright[engineName];
  if (!engine) throw new Error(`unknown --engine ${engineName}`);
  return engine.launch({
    headless: true,
    ...(engineName === "chromium" ? { channel: "chromium" } : {}),
  });
}

async function withPage(flags, fn, { restore = true } = {}) {
  const meta =
    readMeta() ?? (ticketScope().kind === "section" ? { url: baseUrl(devPort()) } : null);
  if (!meta) throw new Error("No verify instance. Run launch + doctor first.");
  ensureDir(STATE_DIR);
  const browser = await launchBrowser(flags.engine);
  const context = await browser.newContext({
    ...contextOptions(flags),
    baseURL: meta.url,
    reducedMotion: flags.motion ? "no-preference" : "reduce",
  });
  const page = await context.newPage();
  if (restore && existsSync(BROWSER_STATE)) {
    const st = JSON.parse(readFileSync(BROWSER_STATE, "utf8"));
    if (st.url) {
      await gotoReady(page, st.url);
    }
  }
  try {
    const result = await fn(page, meta);
    writeFileSync(
      BROWSER_STATE,
      JSON.stringify(
        { url: page.url(), updatedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    return result;
  } finally {
    await browser.close();
  }
}

function getFlag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function targetLocator(page, rest) {
  const role = getFlag(rest, "--role");
  const name = getFlag(rest, "--name");
  const selector = getFlag(rest, "--selector");
  const ariaLabel = getFlag(rest, "--aria-label");
  const nth = Number(getFlag(rest, "--nth") ?? 0);
  if (!name && !selector && !ariaLabel) {
    throw new Error("target requires --name, --selector, or --aria-label");
  }
  const locator = ariaLabel
    ? page.locator(`[aria-label="${ariaLabel}"]`)
    : selector
      ? page.locator(selector)
      : role
        ? page.getByRole(role, { name })
        : page
            .getByRole("button", { name })
            .or(page.getByRole("link", { name }));
  return {
    locator: locator.nth(nth),
    force: Boolean(selector || ariaLabel),
    target: { role, name, selector, ariaLabel, nth },
  };
}

async function runBrowserStep(page, sub, rest, meta) {
  if (sub === "goto") {
    const path = rest[0];
    if (!path) throw new Error("goto requires path");
    await gotoReady(page, path);
    return { ok: true, url: page.url() };
  }

  if (sub === "click") {
    const { locator, force, target } = targetLocator(page, rest);
    await locator.click({ force });
    await page.waitForTimeout(800);
    await waitPageReady(page);
    return { ok: true, url: page.url(), clicked: target };
  }

  if (sub === "hover") {
    const { locator, target } = targetLocator(page, rest);
    await locator.scrollIntoViewIfNeeded();
    await locator.hover({ force: true });
    return { ok: true, hovered: target };
  }

  if (sub === "leave") {
    const { width, height } = page.viewportSize();
    await page.mouse.move(width - 1, height - 1);
    return { ok: true, left: true };
  }

  if (sub === "press") {
    const key = getFlag(rest, "--key");
    if (!key) throw new Error("press requires --key");
    await page.keyboard.press(key);
    return { ok: true, pressed: key };
  }

  if (sub === "scroll") {
    const selector = getFlag(rest, "--selector");
    const into = getFlag(rest, "--into");
    const by = getFlag(rest, "--by");
    const to = getFlag(rest, "--to");
    if (into) {
      await page.locator(into).first().scrollIntoViewIfNeeded();
      return { ok: true, scrolledInto: into };
    }
    if (by === undefined && to === undefined)
      throw new Error("scroll requires --by, --to, or --into");
    const scrollTop = await page.evaluate(
      async ({ selector, by, to, repeat }) => {
        const el = selector
          ? document.querySelector(selector)
          : document.scrollingElement;
        if (!el) throw new Error(`scroll: no element for ${selector}`);
        for (let i = 0; i < repeat; i++) {
          if (to !== null) el.scrollTop = to;
          else el.scrollTop += by;
          await new Promise((r) => requestAnimationFrame(r));
        }
        await new Promise((r) => requestAnimationFrame(r));
        return el.scrollTop;
      },
      {
        selector: selector ?? null,
        by: Number(by ?? 0),
        to: to === undefined ? null : Number(to),
        repeat: Number(getFlag(rest, "--repeat") ?? 1),
      },
    );
    return { ok: true, selector: selector ?? "window", scrollTop };
  }

  if (sub === "wait") {
    const ms = getFlag(rest, "--ms");
    const selector = getFlag(rest, "--selector");
    const js = getFlag(rest, "--js");
    if (ms) await page.waitForTimeout(Number(ms));
    else if (selector)
      await page
        .locator(selector)
        .first()
        .waitFor({ state: getFlag(rest, "--state") ?? "visible" });
    else if (js) await page.waitForFunction(js, null, { timeout: 15_000 });
    else throw new Error("wait requires --ms, --selector, or --js");
    return { ok: true, waited: ms ?? selector ?? js };
  }

  if (sub === "fill") {
    const name = getFlag(rest, "--name");
    const value = getFlag(rest, "--value");
    if (!name || value === undefined)
      throw new Error("fill requires --name and --value");
    await page.getByLabel(name, { exact: false }).first().fill(value);
    return { ok: true, filled: name };
  }

  if (sub === "snapshot") {
    const path = getFlag(rest, "--path");
    if (!path || !rest.includes("--aria"))
      throw new Error("snapshot requires --aria --path");
    ensureDir(dirname(resolve(path)));
    const snapshot = await page.locator("body").ariaSnapshot();
    writeFileSync(resolve(path), snapshot);
    return { ok: true, path: resolve(path), bytes: snapshot.length };
  }

  if (sub === "screenshot") {
    const path = getFlag(rest, "--path");
    if (!path) throw new Error("screenshot requires --path");
    ensureDir(dirname(resolve(path)));
    if (getFlag(rest, "--selector")) {
      const { locator } = targetLocator(page, rest);
      await locator.screenshot({ path: resolve(path) });
    } else {
      await page.screenshot({
        path: resolve(path),
        fullPage: rest.includes("--full"),
      });
    }
    recordScreenshot(path, page.url());
    return { ok: true, path: resolve(path) };
  }

  if (sub === "eval") {
    const js = getFlag(rest, "--js");
    if (!js) throw new Error("eval requires --js");
    const value = await page.evaluate(js);
    return { ok: true, value };
  }

  throw new Error(`unknown browser step: ${sub}`);
}

function parseFlowLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const tokens = [];
      const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
      let m;
      while ((m = re.exec(line))) tokens.push(m[1] ?? m[2] ?? m[3]);
      return { sub: tokens[0], rest: tokens.slice(1) };
    });
}

async function cmdBrowser(argv) {
  const { flags, rest: args } = parseContextFlags(argv);
  const sub = args[0];
  const rest = args.slice(1);
  if (!sub) usage();

  if (sub === "flow") {
    const file = getFlag(rest, "--file");
    const text = file
      ? readFileSync(file, "utf8")
      : rest.join("\n") || readFileSync(0, "utf8");
    const steps = parseFlowLines(text);
    if (!steps.length) usage();
    await withPage(
      flags,
      async (page, meta) => {
        const results = [];
        for (const step of steps) {
          results.push(await runBrowserStep(page, step.sub, step.rest, meta));
        }
        console.log(
          JSON.stringify({ ok: true, steps: results.length, results }, null, 2),
        );
      },
      { restore: steps[0].sub !== "goto" },
    );
    return;
  }

  await withPage(
    flags,
    async (page, meta) => {
      const result = await runBrowserStep(page, sub, rest, meta);
      console.log(JSON.stringify(result, null, 2));
    },
    { restore: sub !== "goto" },
  );
}

export {
  contextOptions,
  launchBrowser,
  parseContextFlags,
  parseFlowLines,
  readMeta,
  runBrowserStep,
};

if (isMain(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "--help") usage(0);

  try {
    if (cmd === "launch") await cmdLaunch(args);
    else if (cmd === "relaunch") await cmdRelaunch(args);
    else if (cmd === "doctor") await cmdDoctor(args);
    else if (cmd === "cleanup") await cmdCleanup();
    else if (cmd === "up") await cmdUp(args);
    else if (cmd === "down") await cmdDown(args);
    else if (cmd === "status") await cmdStatus(args);
    else if (cmd === "holders") await cmdHolders();
    else if (cmd === "release-foreign") await cmdReleaseForeign(args);
    else if (cmd === "browser") await cmdBrowser(args);
    else usage();
  } catch (e) {
    console.error(String(e?.stack || e));
    process.exit(1);
  }
}
