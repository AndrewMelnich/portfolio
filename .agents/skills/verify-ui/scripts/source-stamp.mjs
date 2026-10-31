import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerHelp } from "./cli-help.mjs";
import { APP, ROOT, STATE_DIR, VERIFY, isMain } from "./project.mjs";
import { ticketScope } from "./scope.mjs";

const BUILD_SOURCE_FILE = join(STATE_DIR, "build-source.json");

const repoPath = (path) => relative(ROOT, join(APP, path)) || ".";
const RUNTIME_PATHS = VERIFY.sourcePaths.map(repoPath);
const IGNORED = VERIFY.sourceExclude.map((glob) => `:(exclude,glob)${repoPath(glob)}`);
const SECTION_SHARED_PATHS = VERIFY.sectionSharedPaths.map(repoPath);

const git = (args, env = {}) => {
  const result = spawnSync("git", ["-C", ROOT, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.trim();
};

export function sourceHash() {
  const realIndex = resolve(ROOT, git(["rev-parse", "--git-path", "index"]));
  const tempIndex = join(tmpdir(), `fstack-source-index-${process.pid}`);
  copyFileSync(realIndex, tempIndex);
  try {
    const env = { GIT_INDEX_FILE: tempIndex };
    git(["add", "-A", "--", ...RUNTIME_PATHS, ...IGNORED], env);
    const { slice } = ticketScope();
    if (slice) {
      const listing = git(["ls-files", "-s", "--", ...slice, ...SECTION_SHARED_PATHS], env);
      return `section:${createHash("sha1").update(listing).digest("hex")}`;
    }
    const tree = git(["write-tree"], env);
    return RUNTIME_PATHS.map((path) => {
      try {
        return git(["rev-parse", `${tree}:${path}`]);
      } catch {
        return "missing";
      }
    }).join(":");
  } finally {
    rmSync(tempIndex, { force: true });
  }
}

const EXCLUDE_GLOBS = VERIFY.sourceExclude.map(repoPath);

export const isRuntimeSource = (file) =>
  RUNTIME_PATHS.some((path) => file === path || file.startsWith(`${path}/`)) &&
  !EXCLUDE_GLOBS.some((glob) => matchesGlob(file, glob));

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);

const writeJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
};

export const readBuildSource = () => readJson(BUILD_SOURCE_FILE)?.hash ?? null;

export const writeBuildSource = (hash) =>
  writeJson(BUILD_SOURCE_FILE, { hash, at: new Date().toISOString() });

if (isMain(import.meta.url)) {
  answerHelp(`Usage: source-stamp.mjs

Prints the source hash behind doctor's stale flag: the git tree of config verify.sourcePaths minus verify.sourceExclude.
On a section branch (front/feature-<page>-<section>_section) the hash covers only that section's slice (frontend/src/_pages/<Page>/ui/<Page>View/sections/<Section>/), its assets (frontend/public/static/<kind>/<page>/) and config verify.sectionSharedPaths (shared styles), prefixed "section:". Merging assembly files outside those paths leaves it unchanged. The page is the longest branch prefix whose frontend/src/_pages/<Page>/ exists; with none, the full hash applies.

Examples:
  node .agents/skills/verify-ui/scripts/source-stamp.mjs
`);
  console.log(sourceHash());
}
