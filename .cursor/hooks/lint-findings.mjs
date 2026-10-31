import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const MAX_BYTES = 200 * 1024;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 6000;
const FRONTEND = "frontend/";

export function lintFindings(root, edits) {
  const frontendDir = join(root, "frontend");
  const files = edits
    .filter((path) => path.startsWith(FRONTEND))
    .map((path) => path.slice(FRONTEND.length))
    .filter((rel) => {
      const absolute = join(frontendDir, rel);
      return existsSync(absolute) && statSync(absolute).size <= MAX_BYTES;
    });
  if (files.length === 0) return [];
  const result = spawnSync("bash", ["./scripts/verify-files.sh", ...files], {
    cwd: frontendDir,
    encoding: "utf8",
    shell: false,
    maxBuffer: MAX_BUFFER_BYTES,
    env: { ...process.env, SKIP_TSC: "1", VERIFY_DIRECT_BIN: "1" },
  });
  if (result.status === 0) return [];
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const shown = output.length > MAX_OUTPUT_CHARS ? `${output.slice(0, MAX_OUTPUT_CHARS)}\n…` : output;
  return [
    `Lint failed on files this chat edited (eslint, stylelint, oxfmt). Fix before finishing.\n\n${shown || `verify-files exited ${result.status ?? "unknown"}`}`,
  ];
}
