import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const stateDirOf = (root) => join(root, ".cursor/hooks/state/conversations");

const fileOf = (root, id) =>
  join(stateDirOf(root), `${String(id).replace(/[^\w-]/g, "_")}.txt`);

export const conversationIds = (input) =>
  [...new Set([input.conversation_id, input.parent_conversation_id])].filter(
    Boolean,
  );

export function recordEdits(root, id, paths) {
  const lines = paths
    .map((path) => relative(root, resolve(root, path)).replaceAll("\\", "/"))
    .filter((path) => path && !path.startsWith(".."));
  if (lines.length === 0) return;
  mkdirSync(stateDirOf(root), { recursive: true });
  appendFileSync(fileOf(root, id), `${lines.join("\n")}\n`);
}

export function readEdits(root, id) {
  const file = fileOf(root, id);
  if (!existsSync(file)) return [];
  return [...new Set(readFileSync(file, "utf8").split("\n").filter(Boolean))];
}

export const clearEdits = (root, id) =>
  rmSync(fileOf(root, id), { force: true });

export function pruneStale(root, now = Date.now()) {
  const dir = stateDirOf(root);
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (now - statSync(file).mtimeMs > STALE_MS) rmSync(file, { force: true });
  }
}
