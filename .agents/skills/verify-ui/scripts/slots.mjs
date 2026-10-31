import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, totalmem } from "node:os";
import { join } from "node:path";

const GIB = 1024 ** 3;
export const SLOT_PEAK_GIB = 2.2;
export const SLOT_RAM_SHARE = 0.5;
export const GIB_PER_SLOT = SLOT_PEAK_GIB / SLOT_RAM_SHARE;
export const SLOT_DEV_GIB = 0.55;
export const IMPLEMENTER_DEV_GIB = 0.45;
export const IMPLEMENTER_MAX = 12;
const POLL_MS = 500;
const WAIT_HEARTBEAT_MS = 15_000;
const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_MS = 25;

export function defaultCap(totalBytes) {
  return Math.max(1, Math.floor(totalBytes / GIB / GIB_PER_SLOT));
}

export function defaultImplementerCap(totalBytes) {
  const gib = totalBytes / GIB;
  const heavyExtra = defaultCap(totalBytes) * (SLOT_PEAK_GIB - SLOT_DEV_GIB);
  const fit = Math.floor((gib * SLOT_RAM_SHARE - heavyExtra) / IMPLEMENTER_DEV_GIB);
  return Math.min(IMPLEMENTER_MAX, Math.max(1, fit));
}

function resolveEnvCap(name, fallback, env) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback();
  const cap = Number(raw);
  if (!Number.isInteger(cap) || cap < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return cap;
}

export function resolveImplementerCap(env = process.env, totalBytes = totalmem()) {
  return resolveEnvCap("FSTACK_MAX_IMPLEMENTERS", () => defaultImplementerCap(totalBytes), env);
}

export function resolveWaitHeartbeat(env = process.env) {
  return resolveEnvCap("FSTACK_SLOT_HEARTBEAT_MS", () => WAIT_HEARTBEAT_MS, env);
}

export function resolveCap(env = process.env, totalBytes = totalmem()) {
  return resolveEnvCap("FSTACK_MAX_HEAVY", () => defaultCap(totalBytes), env);
}

export function slotsDir(env = process.env) {
  return env.FSTACK_SLOTS_DIR ?? join(tmpdir(), "fstack-verify", "slots");
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function readEntry(file) {
  try {
    const entry = JSON.parse(readFileSync(file, "utf8"));
    return Number.isInteger(entry.pid) ? entry : null;
  } catch {
    return null;
  }
}

function listEntries(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => ({ name, file: join(dir, name), entry: readEntry(join(dir, name)) }));
  } catch {
    return [];
  }
}

function reap(dir) {
  const live = [];
  for (const item of listEntries(dir)) {
    if (item.entry && pidAlive(item.entry.pid)) live.push(item);
    else rmSync(item.file, { force: true });
  }
  return live;
}

async function withLock(root, fn) {
  const lock = join(root, "lock");
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) rmdirSync(lock);
      } catch {}
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function writeEntry(file, entry) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(entry));
  renameSync(tmp, file);
}

const ticketName = (id) => `${String(Date.now()).padStart(15, "0")}-${id}.json`;

export async function acquireSlot({
  kind,
  root,
  env = process.env,
  totalBytes = totalmem(),
  onWait = () => {},
}) {
  const base = slotsDir(env);
  const holders = join(base, "held");
  const queue = join(base, "queue");
  mkdirSync(holders, { recursive: true });
  mkdirSync(queue, { recursive: true });
  const id = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const ticket = join(queue, ticketName(id));
  const slotFile = join(holders, `${id}.json`);
  const entry = { id, pid: process.pid, kind, root, at: new Date().toISOString() };
  writeEntry(ticket, entry);

  let lastReport = "";
  let lastAnnounced = 0;
  const heartbeat = resolveWaitHeartbeat(env);
  try {
    for (;;) {
      const cap = resolveCap(env, totalBytes);
      const outcome = await withLock(base, () => {
        const held = reap(holders);
        const waiting = reap(queue);
        const position = waiting.findIndex((item) => item.entry.id === id);
        if (position === -1) throw new Error("slot queue entry vanished");
        const free = Math.max(0, cap - held.length);
        if (position < free) {
          writeEntry(slotFile, { ...entry, at: new Date().toISOString() });
          rmSync(ticket, { force: true });
          return { acquired: true };
        }
        return { acquired: false, position: position + 1 - free, held, cap };
      });
      if (outcome.acquired) return { id, file: slotFile };
      const report = `${outcome.position}/${outcome.held.length}/${outcome.cap}`;
      if (report !== lastReport || Date.now() - lastAnnounced >= heartbeat) {
        lastReport = report;
        lastAnnounced = Date.now();
        onWait({
          position: outcome.position,
          cap: outcome.cap,
          holders: outcome.held.map((item) => item.entry),
        });
      }
      await sleep(POLL_MS);
    }
  } catch (error) {
    rmSync(ticket, { force: true });
    throw error;
  }
}

export function releaseSlot(slot) {
  if (slot) rmSync(slot.file, { force: true });
}

export async function listHolders(env = process.env) {
  const base = slotsDir(env);
  const holders = join(base, "held");
  mkdirSync(holders, { recursive: true });
  return withLock(base, () => reap(holders).map((item) => item.entry));
}

export function releaseSlotById(id, env = process.env) {
  rmSync(join(slotsDir(env), "held", `${id}.json`), { force: true });
}

export function describeWait({ position, cap, holders }, label = "control") {
  const busy = holders.map((h) => `${h.kind}@${h.root}`).join(", ");
  return `${label}: waiting for a heavy-process slot, queue position ${position} (${holders.length}/${cap} slots in use: ${busy}).`;
}
