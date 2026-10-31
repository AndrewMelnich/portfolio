import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot, readStdinJson } from "./hook-input.mjs";

const WRITE_TOOLS = new Set(["Write", "StrReplace", "Delete"]);
const DOWNLOAD_TOOL = "download_figma_images";

const allow = { permission: "allow" };

const isMain = (url) => {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(url);
  } catch {
    return false;
  }
};

const physical = (path) => {
  let probe = resolve(path);
  const tail = [];
  while (!existsSync(probe) && dirname(probe) !== probe) {
    tail.unshift(basename(probe));
    probe = dirname(probe);
  }
  return join(realpathSync(probe), ...tail);
};

const inside = (dir, path) => {
  const rel = relative(dir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const gitPaths = (root) => {
  const run = spawnSync(
    "git",
    ["-C", root, "rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"],
    { encoding: "utf8" },
  );
  if (run.status !== 0) return null;
  const [top, gitDir, commonDir] = run.stdout.trim().split("\n");
  return { top, gitDir, commonDir };
};

export const linkedWorktree = (root) => {
  const paths = gitPaths(root);
  if (!paths || basename(paths.commonDir) !== ".git") return null;
  if (physical(paths.gitDir) === physical(paths.commonDir)) return null;
  return {
    worktree: physical(paths.top),
    main: physical(dirname(paths.commonDir)),
  };
};

const downloadArguments = (input) => {
  const toolInput = input.tool_input ?? {};
  const nested = toolInput.arguments;
  const named = [input.tool_name, input.toolName, toolInput.toolName, toolInput.tool_name];
  if (!named.some((name) => typeof name === "string" && name.endsWith(DOWNLOAD_TOOL))) return null;
  const args = nested && typeof nested === "object" ? nested : toolInput;
  return typeof args.localPath === "string" ? args : null;
};

const toHomeRelative = (home, absolute) => {
  const physicalHome = physical(home);
  return inside(physicalHome, absolute) ? relative(physicalHome, absolute) : absolute;
};

const resolveLocalPath = (home, localPath) => {
  if (localPath === "~" || localPath.startsWith("~/")) return resolve(home, localPath.slice(2));
  return isAbsolute(localPath) ? resolve(localPath) : resolve(home, localPath);
};

const writeDecision = (toolInput, session, root) => {
  const target = toolInput.path ?? toolInput.file_path ?? toolInput.target_file;
  if (typeof target !== "string" || !target) return allow;
  const absolute = physical(resolve(root, target));
  if (inside(session.worktree, absolute) || !inside(session.main, absolute)) return allow;
  const corrected = join(session.worktree, relative(session.main, absolute));
  return {
    permission: "deny",
    user_message: `This session works in a linked worktree; ${absolute} is in the main checkout.`,
    agent_message: `Do not write under the main checkout (${session.main}). You work in the worktree ${session.worktree}. Use ${corrected} instead.`,
  };
};

const downloadDecision = (args, session) => {
  const home = process.env.HOME || homedir();
  const resolved = physical(resolveLocalPath(home, args.localPath));
  if (inside(session.worktree, resolved)) return allow;
  const absoluteInput = isAbsolute(args.localPath) || args.localPath.startsWith("~");
  const repoRelative = inside(session.main, resolved)
    ? relative(session.main, resolved)
    : absoluteInput
      ? ""
      : args.localPath;
  const corrected = toHomeRelative(home, join(session.worktree, repoRelative));
  const where = inside(session.main, resolved) ? "the main checkout" : "outside this worktree";
  return {
    permission: "deny",
    user_message: `Figma download refused: localPath "${args.localPath}" resolves ${where} (${resolved}).`,
    agent_message: `localPath is $HOME-relative and "${args.localPath}" resolves to ${resolved}, ${where}. This session works in the worktree ${session.worktree}. Retry download_figma_images with localPath "${corrected}".`,
  };
};

export function guardDecision(input) {
  const root = projectRoot(input);
  const session = linkedWorktree(root);
  if (!session) return allow;
  if (WRITE_TOOLS.has(input.tool_name)) return writeDecision(input.tool_input ?? {}, session, root);
  const args = downloadArguments(input);
  return args ? downloadDecision(args, session) : allow;
}

if (isMain(import.meta.url)) {
  let decision = allow;
  try {
    decision = guardDecision(readStdinJson());
  } catch {
    decision = allow;
  }
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}
