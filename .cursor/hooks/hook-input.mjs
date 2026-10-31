import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const readStdinJson = () => {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
};

export const gitRoot = (cwd = process.cwd()) => {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
};

export const projectRoot = (input = {}) => {
  const candidates = [
    ...(input.workspace_roots ?? []),
    process.env.CURSOR_PROJECT_DIR,
    process.cwd(),
  ].filter(Boolean);
  for (const dir of candidates) {
    const root = gitRoot(dir) ?? dir;
    if (existsSync(join(root, "frontend/package.json"))) return root;
  }
  return gitRoot() ?? process.cwd();
};
