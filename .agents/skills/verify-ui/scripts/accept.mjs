#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { answerHelp, isMain } from "./cli-help.mjs";
import { checkDiffInSlice, currentBranch, formatResult, stripRemote } from "./diff-in-slice.mjs";

const EXIT = { ACCEPTED: 0, REFUSED: 1, INPUT: 2 };
const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const USAGE =
  "Usage: accept.mjs --worktree <path> --section <branch> --assembly <branch> --widths <w1,w2,...> [--repo <path>] [--started-at <iso>]";
const FLAGS = ["--worktree", "--section", "--assembly", "--widths", "--repo", "--started-at"];

class StepError extends Error {}

const run = (command, args, { cwd, env } = {}) =>
  spawnSync(command, args, {
    cwd,
    env: env ?? process.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

const git = (repo, args) => run("git", ["-C", repo, ...args]);

const gitOut = (repo, args) => {
  const result = git(repo, args);
  return result.status === 0 ? result.stdout.trim() : null;
};

const worktreeEnv = (worktree) => {
  const env = { ...process.env, FSTACK_PROJECT_DIR: worktree };
  delete env.FSTACK_ARTIFACTS_DIR;
  delete env.FSTACK_STATE_DIR;
  return env;
};

const STOP_DEV = `import { down } from ${JSON.stringify(pathToFileURL(join(SCRIPTS, "servers.mjs")).href)};
console.log(JSON.stringify(await down("dev")));`;

const refSha = (repo, ref) => gitOut(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);

const isAncestor = (repo, ancestor, descendant) =>
  git(repo, ["merge-base", "--is-ancestor", ancestor, descendant]).status === 0;

const mergeMessage = (section, assembly) => `Merge branch '${section}' into ${assembly}`;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!FLAGS.includes(flag) || value === undefined || value.startsWith("--")) {
      return { error: `unknown or incomplete option "${flag}"` };
    }
    options[flag.slice(2)] = value;
  }
  const missing = ["worktree", "section", "assembly", "widths"].filter((name) => !options[name]);
  if (missing.length > 0) {
    return { error: `missing ${missing.map((name) => `--${name}`).join(", ")}` };
  }
  const widths = options.widths.split(",").map((width) => Number(width.trim()));
  if (widths.some((width) => !Number.isInteger(width) || width <= 0)) {
    return { error: `--widths "${options.widths}" must be comma-separated pixel widths` };
  }
  if (options["started-at"] && Number.isNaN(Date.parse(options["started-at"]))) {
    return { error: `--started-at "${options["started-at"]}" is not a date` };
  }
  return {
    options: {
      worktree: resolve(options.worktree),
      section: stripRemote(options.section),
      assembly: stripRemote(options.assembly),
      widths: [...new Set(widths)],
      repo: options.repo ? resolve(options.repo) : null,
      startedAt: options["started-at"] ?? null,
    },
  };
}

function resolveRepo(options) {
  if (options.repo) return options.repo;
  if (!existsSync(options.worktree)) return null;
  const common = gitOut(options.worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return common && basename(common) === ".git" ? dirname(common) : common;
}

function checkedOutWorktree(repo, branch) {
  const listing = git(repo, ["worktree", "list", "--porcelain"]);
  if (listing.status !== 0) return null;
  let path = null;
  for (const line of listing.stdout.split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

function findMerge(repo, refs, section, assembly) {
  for (const ref of refs.filter(Boolean)) {
    const log = gitOut(repo, [
      "log",
      "--first-parent",
      "--merges",
      "--fixed-strings",
      `--grep=${mergeMessage(section, assembly)}`,
      "--max-count=1",
      "--format=%H%x09%cI",
      ref,
    ]);
    if (log) {
      const [sha, date] = log.split("\t");
      return { sha, date };
    }
  }
  return null;
}

function earliestAuthorDate(repo, range) {
  const log = gitOut(repo, ["log", "--format=%aI", range]);
  const dates = (log ?? "")
    .split("\n")
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));
  return dates.length === 0 ? null : new Date(Math.min(...dates));
}

function readConfig(worktree) {
  try {
    return JSON.parse(readFileSync(join(worktree, ".cursor/fstack/config.json"), "utf8"));
  } catch {
    return {};
  }
}

function dirtySource(worktree) {
  const config = readConfig(worktree);
  const app = config.app ?? ".";
  const paths = (config.verify?.sourcePaths ?? ["src"]).map((path) => join(app, path));
  const tracked = gitOut(worktree, ["status", "--porcelain", "--untracked-files=no"]) ?? "";
  const untracked = gitOut(worktree, ["ls-files", "--others", "--exclude-standard", "--", ...paths]) ?? "";
  return [...tracked.split("\n"), ...untracked.split("\n").map((file) => `?? ${file}`)].filter(
    (line) => line.trim() && line !== "?? ",
  );
}

function receiptGate(worktree, widths) {
  const result = run(process.execPath, [join(SCRIPTS, "receipt.mjs")], {
    cwd: worktree,
    env: worktreeEnv(worktree),
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = null;
  }
  const entries = parsed?.receipt?.entries ?? [];
  const stamp = parsed?.receipt?.stamp;
  const rows = widths.map((width) => {
    const proven = entries.some(
      (entry) =>
        entry.kind === "layout-proof" &&
        entry.viewport === width &&
        entry.verdict === "pass" &&
        entry.stamp === stamp,
    );
    return { width, verdict: proven ? "pass" : "missing" };
  });
  const problems = parsed?.problems ?? [(result.stderr || result.stdout).trim().split("\n").pop()];
  return { code: result.status ?? 1, problems, rows };
}

function pnpmGate(worktree, script) {
  const app = join(worktree, readConfig(worktree).app ?? ".");
  const result = run("pnpm", [script], { cwd: app });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n");
  return { code: result.status ?? 1, tail: output.slice(-15) };
}

function runGates({ worktree, section, assembly, widths }) {
  const dirty = dirtySource(worktree);
  const slice = checkDiffInSlice({ root: worktree, section, assembly, base: assembly });
  const receipt = receiptGate(worktree, widths);
  const widthsOk = receipt.rows.every((row) => row.verdict === "pass");
  const cheapOk = dirty.length === 0 && slice.code === 0 && receipt.code === 0 && widthsOk;
  return {
    dirty,
    slice,
    receipt,
    widthsOk,
    pc: cheapOk ? pnpmGate(worktree, "pc") : null,
    fallow: cheapOk ? pnpmGate(worktree, "fallow:audit") : null,
  };
}

const gatesPass = (gates) =>
  gates.dirty.length === 0 &&
  gates.slice.code === 0 &&
  gates.receipt.code === 0 &&
  gates.widthsOk &&
  gates.pc?.code === 0 &&
  gates.fallow?.code === 0;

const pad = (rows) => {
  const width = Math.max(...rows.map(([name]) => String(name).length));
  return rows.map(([name, value]) => `  ${String(name).padEnd(width)}  ${value}`);
};

const duration = (start, end) => {
  if (!start || !end) return "n/a";
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (seconds < 0) return "n/a";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${rest}s` : `${minutes}m ${rest}s`;
};

function formatReport({ options, gates, steps, start, startSource, end }) {
  const lines = [`accept ${options.section} -> ${options.assembly}`];
  if (gates) {
    lines.push("width -> verdict", ...pad(gates.receipt.rows.map((row) => [row.width, row.verdict])));
    lines.push(
      "check -> exit",
      ...pad([
        ["clean-tree", gates.dirty.length === 0 ? 0 : 1],
        ["diff-in-slice", gates.slice.code],
        ["receipt", gates.receipt.code],
        ["layout-proof", gates.widthsOk ? 0 : 1],
        ["pc", gates.pc ? gates.pc.code : "not run"],
        ["fallow-audit", gates.fallow ? gates.fallow.code : "not run"],
      ]),
    );
  } else {
    lines.push("checks: skipped, already merged by accept");
  }
  lines.push(`wall time (ticket start -> accept): ${duration(start, end)} (start: ${startSource})`);
  if (steps.length > 0) {
    lines.push("step -> result", ...pad(steps.map((step) => [step.name, step.result])));
  }
  return lines.join("\n");
}

function refusalDetails(gates) {
  const lines = [];
  if (gates.dirty.length > 0) {
    lines.push(
      "uncommitted source in the worktree (commit it and prove again):",
      ...gates.dirty.map((line) => `  ${line}`),
    );
  }
  if (gates.slice.code !== 0) lines.push(formatResult(gates.slice));
  if (gates.receipt.code !== 0) {
    lines.push("receipt:", ...gates.receipt.problems.map((problem) => `  ${problem}`));
  }
  const missing = gates.receipt.rows.filter((row) => row.verdict !== "pass");
  if (missing.length > 0) {
    lines.push(
      `no passing layout-proof on this stamp at width ${missing.map((row) => row.width).join(", ")}`,
    );
  }
  if (gates.pc && gates.pc.code !== 0) {
    lines.push("pnpm pc output (tail):", ...gates.pc.tail.map((line) => `  ${line}`));
  }
  if (gates.fallow && gates.fallow.code !== 0) {
    lines.push("pnpm fallow:audit output (tail):", ...gates.fallow.tail.map((line) => `  ${line}`));
  }
  return lines;
}

function mergeStep({ repo, section, assembly, tip }) {
  const local = refSha(repo, `refs/heads/${assembly}`);
  const remote = refSha(repo, `refs/remotes/origin/${assembly}`);
  if (isAncestor(repo, tip, local) || (remote && isAncestor(repo, tip, remote))) {
    return "skip (already merged)";
  }
  const holder = checkedOutWorktree(repo, assembly);
  if (holder && gitOut(holder, ["status", "--porcelain", "--untracked-files=no"]) !== "") {
    throw new StepError(`assembly worktree ${holder} has uncommitted tracked changes`);
  }
  const tree = git(repo, ["merge-tree", "--write-tree", local, tip]);
  if (tree.status === 1) {
    throw new StepError(
      `merge conflict, nothing changed; resolve it in the section branch:\n${tree.stdout.trim()}`,
    );
  }
  if (tree.status !== 0) {
    throw new StepError(`git merge-tree --write-tree failed (git 2.38 or newer needed): ${tree.stderr.trim()}`);
  }
  const commit = git(repo, [
    "commit-tree",
    tree.stdout.split("\n")[0],
    "-p",
    local,
    "-p",
    tip,
    "-m",
    mergeMessage(section, assembly),
  ]);
  if (commit.status !== 0) {
    throw new StepError(`git commit-tree failed: ${commit.stderr.trim()}`);
  }
  const sha = commit.stdout.trim();
  const advance = holder
    ? git(holder, ["merge", "--ff-only", "--quiet", sha])
    : git(repo, ["update-ref", `refs/heads/${assembly}`, sha, local]);
  if (advance.status !== 0) {
    throw new StepError(`cannot advance ${assembly}: ${advance.stderr.trim()}`);
  }
  return `done (${sha.slice(0, 9)})`;
}

function pushStep({ repo, assembly, tip }) {
  const remote = refSha(repo, `refs/remotes/origin/${assembly}`);
  if (remote && isAncestor(repo, tip, remote)) return "skip (already pushed)";
  const cwd = checkedOutWorktree(repo, assembly) ?? repo;
  const push = git(cwd, ["push", "origin", `refs/heads/${assembly}:refs/heads/${assembly}`]);
  if (push.status !== 0) {
    throw new StepError(`push failed (fetch and merge origin/${assembly}, then re-run): ${push.stderr.trim()}`);
  }
  return "done";
}

function closeMrStep({ repo, section, assembly }) {
  const list = run("glab", ["mr", "list", "--source-branch", section, "--target-branch", assembly, "-F", "json"], {
    cwd: repo,
  });
  if (list.status !== 0) {
    throw new StepError(`glab mr list failed: ${(list.stderr || list.error?.message || "").trim()}`);
  }
  let open;
  try {
    open = JSON.parse(list.stdout.trim() || "[]");
  } catch {
    throw new StepError("glab mr list did not return JSON");
  }
  if (open.length === 0) return "skip (no open MR)";
  for (const mr of open) {
    const close = run("glab", ["mr", "close", String(mr.iid)], { cwd: repo });
    if (close.status !== 0) {
      throw new StepError(`glab mr close ${mr.iid} failed: ${(close.stderr || "").trim()}`);
    }
  }
  return `done (${open.map((mr) => `!${mr.iid}`).join(", ")})`;
}

function stopDevStep({ worktree }) {
  if (!existsSync(worktree)) return "skip (already removed)";
  const result = run(process.execPath, ["--input-type=module", "-e", STOP_DEV], {
    cwd: worktree,
    env: worktreeEnv(worktree),
  });
  if (result.status !== 0) {
    throw new StepError(`stopping the dev server failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const report = JSON.parse(result.stdout.trim().split("\n").pop());
  return report.stopped ? `done (pid ${report.pid})` : "skip (no dev server)";
}

function removeWorktreeStep({ repo, worktree }) {
  if (!existsSync(worktree)) return "skip (already removed)";
  const remove = git(repo, ["worktree", "remove", "--force", worktree]);
  if (remove.status !== 0) {
    throw new StepError(`git worktree remove failed: ${remove.stderr.trim()}`);
  }
  return "done";
}

function deleteLocalStep({ repo, section, assembly }) {
  const local = refSha(repo, `refs/heads/${section}`);
  if (!local) return "skip (no local branch)";
  const holders = [`refs/heads/${assembly}`, `refs/remotes/origin/${assembly}`];
  if (!holders.some((ref) => refSha(repo, ref) && isAncestor(repo, local, ref))) {
    throw new StepError(`local ${section} has commits that are not in ${assembly}; kept`);
  }
  const remove = git(repo, ["branch", "-D", section]);
  if (remove.status !== 0) {
    throw new StepError(`git branch -D failed: ${remove.stderr.trim()}`);
  }
  return "done";
}

function deleteRemoteStep({ repo, section, assembly }) {
  const listing = git(repo, ["ls-remote", "--heads", "origin", `refs/heads/${section}`]);
  if (listing.status !== 0) {
    throw new StepError(`git ls-remote failed: ${listing.stderr.trim()}`);
  }
  const remoteTip = listing.stdout.split(/\s/)[0];
  if (!remoteTip) return "skip (no remote branch)";
  const merged = refSha(repo, `refs/remotes/origin/${assembly}`);
  if (!merged || !isAncestor(repo, remoteTip, merged)) {
    throw new StepError(`origin/${section} has commits that are not in origin/${assembly}; kept`);
  }
  const remove = git(repo, ["push", "origin", "--delete", section]);
  if (remove.status !== 0) {
    throw new StepError(`git push --delete failed: ${remove.stderr.trim()}`);
  }
  return "done";
}

function accept(options) {
  const { worktree, section, assembly } = options;
  const repo = resolveRepo(options);
  if (!repo || !existsSync(repo)) {
    console.error("accept: the worktree is gone, pass --repo <main checkout>");
    return EXIT.INPUT;
  }
  const fetch = git(repo, ["fetch", "--prune", "--quiet", "origin"]);
  if (fetch.status !== 0) {
    console.error(`accept: git fetch origin failed: ${fetch.stderr.trim()}`);
    return EXIT.INPUT;
  }
  if (!refSha(repo, `refs/heads/${assembly}`)) {
    console.error(`accept: no local branch ${assembly} in ${repo}`);
    return EXIT.INPUT;
  }
  const refs = [`refs/heads/${assembly}`, `refs/remotes/origin/${assembly}`];
  let merge = findMerge(repo, refs, section, assembly);
  const tip =
    refSha(repo, `refs/heads/${section}`) ??
    refSha(repo, `refs/remotes/origin/${section}`) ??
    (merge ? refSha(repo, `${merge.sha}^2`) : null);
  if (!merge && !tip) {
    console.error(`accept: no branch ${section} locally or on origin, and no accept merge into ${assembly}`);
    return EXIT.INPUT;
  }
  const worktreeExists = existsSync(worktree);
  if (!merge && !worktreeExists) {
    console.error(`accept: worktree ${worktree} is gone before the section was merged; nothing proves it`);
    return EXIT.INPUT;
  }
  if (worktreeExists && currentBranch(worktree) !== section) {
    console.error(`accept: ${worktree} is not on ${section}`);
    return EXIT.INPUT;
  }

  let startSource = options.startedAt ? "--started-at" : "first commit of the section branch";
  const startRange = () =>
    merge ? `${merge.sha}^1..${merge.sha}^2` : `refs/heads/${assembly}..${tip}`;
  const start = options.startedAt
    ? new Date(options.startedAt)
    : tip || merge
      ? earliestAuthorDate(repo, startRange())
      : null;
  if (!start) startSource = "unknown, pass --started-at";

  let gates = null;
  if (!merge) {
    gates = runGates(options);
    if (!gatesPass(gates)) {
      console.log(formatReport({ options, gates, steps: [], start, startSource, end: new Date() }));
      console.log(["refused:", ...refusalDetails(gates)].join("\n"));
      return gates.slice.code === 2 ? EXIT.INPUT : EXIT.REFUSED;
    }
  }

  const steps = [];
  const context = { repo, worktree, section, assembly, tip };
  const sequence = [
    ["merge", mergeStep],
    ["push", pushStep],
    ["close-mr", closeMrStep],
    ["stop-dev-server", stopDevStep],
    ["remove-worktree", removeWorktreeStep],
    ["delete-local-branch", deleteLocalStep],
    ["delete-remote-branch", deleteRemoteStep],
  ];
  let failure = null;
  for (const [name, step] of sequence) {
    try {
      steps.push({ name, result: step(context) });
    } catch (error) {
      if (!(error instanceof StepError)) throw error;
      steps.push({ name, result: "failed" });
      failure = error.message;
      break;
    }
    if (name === "merge") merge = findMerge(repo, refs, section, assembly);
  }
  const end = merge ? new Date(merge.date) : new Date();
  console.log(formatReport({ options, gates, steps, start, startSource, end }));
  if (failure) {
    console.error(`accept: step ${steps.at(-1).name} failed: ${failure}\nRe-run the same command after fixing it; finished steps are skipped.`);
    return EXIT.REFUSED;
  }
  return EXIT.ACCEPTED;
}

if (isMain(import.meta.url)) {
  answerHelp(`${USAGE}

Accepts one section: checks it, merges it into the assembly branch, closes its MR and removes it. Idempotent: every step reads the current git, remote and glab state first, so re-running after a drop finishes the job without a second merge or MR action.

Required:
  --worktree   the section's worktree
  --section    section branch (front/feature-<page>-<section>_section)
  --assembly   assembly branch (front/feature-<page>_page); must exist locally
  --widths     every frame width assigned to the section, comma-separated (1440,768,375)
Optional:
  --repo         the repository that owns the branches (default: the checkout the worktree belongs to); required when the worktree is already gone
  --started-at   ticket start as an ISO date, the time the section's Task was launched; overrides the default

Checks (all run, the table lists each; any failure refuses and changes nothing):
  clean-tree     no uncommitted tracked change and no untracked file under verify.sourcePaths
  diff-in-slice  diff-in-slice.mjs against the assembly branch
  receipt        receipt.mjs in the worktree exits 0 (fresh stamp, this branch)
  layout-proof   one pass entry on the receipt stamp for every --widths value
  pc             pnpm pc in the worktree app directory; runs only when the other checks pass
  fallow-audit   pnpm fallow:audit in the worktree app directory (the CI gate); runs only when the other checks pass
Steps, in order: merge into the assembly branch (no checkout, a merge commit "Merge branch '<section>' into <assembly>"), push the assembly branch, close the open section MR with glab, stop the section's dev server (control down dev, run for the worktree), remove the worktree, delete the local branch, delete the remote branch. A finished step prints skip.
Once the merge commit exists the checks are not run again, so re-runs work after the worktree is gone.

Wall time: ticket start -> accept. The start is the author date of the section branch's first commit (the earliest commit not on the assembly branch, read from the merge commit on a re-run) unless --started-at is given. The end is the time of the accept merge commit.

Output: width -> verdict, check -> exit, wall time, step -> result. Refusal details follow after "refused:".

Exit codes:
  0  accepted, or already accepted
  1  refused by a check, or a step failed (merge conflict, push rejected, glab error); re-run after fixing
  2  cannot decide: bad flags, worktree not on the section branch, worktree gone before the merge, unknown branch, diff-in-slice exit 2, fetch failed

Examples:
  node .agents/skills/verify-ui/scripts/accept.mjs --worktree ../plenum-wt/gallery --section front/feature-team-gallery_section --assembly front/feature-team_page --widths 1440,768,375
  node .agents/skills/verify-ui/scripts/accept.mjs --worktree ../plenum-wt/gallery --section front/feature-team-gallery_section --assembly front/feature-team_page --widths 1440,375 --started-at 2026-10-26T09:00:00Z
`);

  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`accept: ${parsed.error}\n${USAGE}`);
    process.exit(EXIT.INPUT);
  }
  process.exit(accept(parsed.options));
}
