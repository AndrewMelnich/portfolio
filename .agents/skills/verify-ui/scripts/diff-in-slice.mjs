#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { answerHelp, isMain } from "./cli-help.mjs";

export const EXIT = { PASS: 0, VIOLATIONS: 1, INPUT: 2 };

export const SECTION_BRANCH = /^(?:.*\/)?feature-(.+)_section$/;
const ASSEMBLY_BRANCH = /^(?:.*\/)?feature-(.+)_page$/;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pascal = (kebab) =>
  kebab
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

export const stripRemote = (name) => name.replace(/^(?:refs\/heads\/|origin\/)/, "");

function git(root, args) {
  return spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function sliceNames({ section, assembly }) {
  const assemblyMatch = ASSEMBLY_BRANCH.exec(stripRemote(assembly));
  if (!assemblyMatch) {
    return {
      error: `assembly branch "${assembly}" is not front/feature-<page>_page`,
    };
  }
  const sectionMatch = SECTION_BRANCH.exec(stripRemote(section));
  if (!sectionMatch) {
    return {
      error: `branch "${section}" is not a section branch (front/feature-<page>-<section>_section)`,
    };
  }
  const page = assemblyMatch[1];
  const prefix = `${page}-`;
  const name = sectionMatch[1];
  if (!name.startsWith(prefix) || name.length === prefix.length) {
    return {
      error: `section branch "${section}" does not belong to page "${page}" (expected front/feature-${page}-<section>_section)`,
    };
  }
  const sectionName = name.slice(prefix.length);
  if (!KEBAB.test(page) || !KEBAB.test(sectionName)) {
    return {
      error: `page "${page}" and section "${sectionName}" must be kebab-case`,
    };
  }
  return { page, section: sectionName };
}

export function allowList({ page, section }) {
  const Page = pascal(page);
  const Section = pascal(section);
  const sections = `frontend/src/_pages/${Page}/ui/${Page}View/sections`;
  return {
    slice: [`${sections}/${Section}/`, `${sections}/${Section}Section/`],
    assets: new RegExp(`^frontend/public/static/[^/]+/${page}/.`),
    assetsLabel: `frontend/public/static/<kind>/${page}/`,
    assetsPathspec: `:(glob)frontend/public/static/*/${page}/**`,
    sections: `${sections}/`,
    pageDir: `frontend/src/_pages/${Page}/`,
  };
}

export function sectionOfBranch(branch, pageDirExists) {
  const match = SECTION_BRANCH.exec(stripRemote(branch));
  if (!match || !KEBAB.test(match[1])) {
    return null;
  }
  const words = match[1].split("-");
  for (let cut = words.length - 1; cut >= 1; cut -= 1) {
    const names = {
      page: words.slice(0, cut).join("-"),
      section: words.slice(cut).join("-"),
    };
    if (pageDirExists(allowList(names).pageDir)) {
      return names;
    }
  }
  return null;
}

function classify(file, allow) {
  const [sliceDir, sectionSuffixDir] = allow.slice;
  if (file.startsWith(sliceDir) || file.startsWith(sectionSuffixDir)) {
    return null;
  }
  if (allow.assets.test(file)) {
    return null;
  }
  if (file.startsWith("frontend/src/pages/")) {
    return {
      owner: "assembly",
      reason: "route file, owned by the assembly ticket",
    };
  }
  if (file.startsWith(allow.sections)) {
    return {
      owner: "other-section",
      reason: "another section's slice, owned by that section's ticket",
    };
  }
  if (file.startsWith(allow.pageDir)) {
    return {
      owner: "assembly",
      reason: "page view or page barrel, owned by the assembly ticket",
    };
  }
  return {
    owner: "outside",
    reason: "outside the section slice; the assembly ticket owns shared files",
  };
}

function changedFiles(root, base, head) {
  const mergeBase = git(root, ["merge-base", base, head]);
  if (mergeBase.status !== 0) {
    return { error: `no merge-base between ${base} and ${head}` };
  }
  const diff = git(root, [
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    mergeBase.stdout.trim(),
    head,
  ]);
  if (diff.status !== 0) {
    return { error: `git diff failed: ${diff.stderr.trim()}` };
  }
  return { files: diff.stdout.split("\0").filter(Boolean) };
}

export function currentBranch(root) {
  const result = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return result.status === 0 ? result.stdout.trim() : "";
}

/** @param {{ root?: string, section?: string, assembly: string, base?: string, head?: string }} options */
export function checkDiffInSlice({
  root = process.cwd(),
  section = currentBranch(root),
  assembly,
  base = assembly,
  head = "HEAD",
}) {
  const names = sliceNames({ section, assembly });
  if (names.error) {
    return { code: EXIT.INPUT, error: names.error, violations: [] };
  }
  const diff = changedFiles(root, base, head);
  if (diff.error) {
    return { code: EXIT.INPUT, error: diff.error, violations: [] };
  }
  const allow = allowList(names);
  const violations = diff.files.flatMap((file) => {
    const verdict = classify(file, allow);
    return verdict ? [{ file, ...verdict }] : [];
  });
  return {
    code: violations.length === 0 ? EXIT.PASS : EXIT.VIOLATIONS,
    page: names.page,
    section: names.section,
    allowed: [...allow.slice, allow.assetsLabel],
    files: diff.files,
    violations,
  };
}

export function formatResult(result) {
  if (result.error) {
    return `diff-in-slice: ${result.error}`;
  }
  const head = `diff-in-slice: ${result.page}/${result.section}, ${result.files.length} changed file(s)`;
  if (result.violations.length === 0) {
    return `${head}, all inside the slice`;
  }
  return [
    `${head}, ${result.violations.length} outside the slice`,
    ...result.violations.map(
      ({ file, reason }) => `  FAIL ${file}: ${reason}`,
    ),
    `allowed: ${result.allowed.join(", ")}`,
  ].join("\n");
}

if (isMain(import.meta.url)) {
  answerHelp(`Usage: diff-in-slice.mjs --assembly <branch> [--section <branch>] [--base <ref>] [--root <path>]

Checks that a section branch only changes its own slice. Compares HEAD of --root with the merge-base of --base, so commits merged in from the assembly branch do not count.
The allow-list comes from the branch names alone, no per-page config:
  page     --assembly front/feature-<page>_page
  section  --section  front/feature-<page>-<section>_section (defaults to the checked-out branch)
  slice    frontend/src/_pages/<Page>/ui/<Page>View/sections/<Section>/ (also <Section>Section/)
  assets   frontend/public/static/<kind>/<page>/ (any file under it)
The route, page view, page barrel and every other path fail. The message names the file and its owner (assembly).

--base is the ref to diff against (default: --assembly). In CI HEAD is detached: pass --section, and --base origin/<assembly>.

Exit codes:
  0  slice-only diff
  1  files outside the slice (listed with their owner)
  2  cannot decide: not a *_section branch, section does not belong to the assembly page, unresolvable ref, bad flags

Importable: checkDiffInSlice({ root, section, assembly, base, head }) returns { code, violations, files, allowed } or { code: 2, error }.

Examples:
  node .agents/skills/verify-ui/scripts/diff-in-slice.mjs --assembly front/feature-team_page
  node .agents/skills/verify-ui/scripts/diff-in-slice.mjs --section front/feature-team-gallery_section --assembly front/feature-team_page --base origin/front/feature-team_page --root /path/to/worktree
`);

  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  const assembly = flag("--assembly");
  const root = flag("--root") ?? process.cwd();

  if (!assembly) {
    console.error(
      "Usage: diff-in-slice.mjs --assembly <branch> [--section <branch>] [--base <ref>] [--root <path>]",
    );
    process.exit(EXIT.INPUT);
  }

  const result = checkDiffInSlice({
    root,
    assembly,
    section: flag("--section"),
    base: flag("--base"),
  });
  const output = formatResult(result);
  if (result.code === EXIT.INPUT) {
    console.error(output);
  } else {
    console.log(output);
  }
  process.exit(result.code);
}
