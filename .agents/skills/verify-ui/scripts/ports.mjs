#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { answerHelp, isMain } from "./cli-help.mjs";

/** @type {Record<'verify' | 'dev' | 'storybook', [number, number]>} */
export const WORKTREE_PORTS = {
  verify: [4500, 4799],
  dev: [5100, 5399],
  storybook: [6500, 6799],
};

export function isLinkedWorktree(root) {
  const result = spawnSync(
    "git",
    [
      "-C",
      root,
      "rev-parse",
      "--path-format=absolute",
      "--git-dir",
      "--git-common-dir",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return false;
  const [gitDir, commonDir] = result.stdout.trim().split("\n");
  return resolve(gitDir) !== resolve(commonDir);
}

/**
 * @param {string} root
 * @param {[number, number]} range
 */
export function derivedPort(root, [min, max]) {
  const digest = createHash("sha1").update(resolve(root)).digest();
  return min + (digest.readUInt32BE(0) % (max - min + 1));
}

export function checkoutPort({
  root,
  role,
  main,
  linked = isLinkedWorktree(root),
}) {
  return linked ? derivedPort(root, WORKTREE_PORTS[role]) : main;
}

const topLevel = () => {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : process.cwd();
};

if (isMain(import.meta.url)) {
  answerHelp(`Usage: ports.mjs <verify|dev|storybook> --main <port> [--root <path>]

Prints the dev port for this checkout. The main checkout prints --main (verify: verify.port in .cursor/fstack/config.json; dev: 4321; storybook: 6006).
A linked worktree prints a port derived from its path inside the reserved range (verify 4500-4799, dev 5100-5399, storybook 6500-6799), so parallel worktrees do not collide.
--root defaults to the git top level of the current directory.

Examples:
  node .agents/skills/verify-ui/scripts/ports.mjs verify --main 4327
  node .agents/skills/verify-ui/scripts/ports.mjs storybook --main 6006 --root /path/to/worktree
`);

  const [role, ...rest] = process.argv.slice(2);
  const flag = (name) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
  };
  const main = Number(flag("--main"));
  const root = flag("--root") ?? topLevel();

  if (
    !Object.hasOwn(WORKTREE_PORTS, role) ||
    !Number.isInteger(main) ||
    main <= 0
  ) {
    console.error(
      "Usage: ports.mjs <verify|dev|storybook> --main <port> [--root <path>]",
    );
    process.exit(2);
  }

  console.log(checkoutPort({ root, role, main }));
}
