import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { answerHelp } from "./cli-help.mjs";
import {
  JUDGE_MAX_ROUNDS,
  VERDICTS,
  carriedEntries,
  entryKey,
  judgeProblems,
  judgeRecordProblems,
  judgeState,
  validateEntry,
} from "./receipt-schema.mjs";
import { ARTIFACTS, ROOT, config, isDevOrigin, isMain, isVerifyOrigin } from "./project.mjs";
import { currentBranch, ticketScope } from "./scope.mjs";
import { readBuildSource, sourceHash } from "./source-stamp.mjs";

export const RECEIPT_FILE = join(ARTIFACTS, "receipt.json");

const PROOF_SETS = [["layout-proof"], ["console-check", "overflow-check"]];

let assemblyDevNoticed = false;

export function recordableOrigin(origin) {
  if (isVerifyOrigin(origin)) return "verify";
  if (!isDevOrigin(origin)) return null;
  if (ticketScope().kind === "section") return "dev";
  if (!assemblyDevNoticed) {
    assemblyDevNoticed = true;
    console.error(
      "receipt: dev-origin proof is not recorded on assembly scope; run it on the verify origin (build + preview). Only a *_section branch counts dev-origin proof.",
    );
  }
  return null;
}

const emptyReceipt = (stamp) => ({ stamp, entries: [], screenshots: [] });

export function readReceipt() {
  if (!existsSync(RECEIPT_FILE)) return null;
  try {
    const receipt = JSON.parse(readFileSync(RECEIPT_FILE, "utf8"));
    return receipt.branch && receipt.branch !== currentBranch() ? null : receipt;
  } catch {
    return null;
  }
}

function writeReceipt(receipt) {
  mkdirSync(dirname(RECEIPT_FILE), { recursive: true });
  const temp = `${RECEIPT_FILE}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ ...receipt, branch: currentBranch() }, null, 2)}\n`);
  renameSync(temp, RECEIPT_FILE);
}

const currentReceipt = (stamp) => {
  const previous = readReceipt();
  if (previous?.stamp === stamp && Array.isArray(previous.entries)) return previous;
  return {
    ...emptyReceipt(stamp),
    entries: Array.isArray(previous?.entries) ? carriedEntries(previous.entries) : [],
  };
};

function updateReceipt(update) {
  const stamp = sourceHash();
  const receipt = currentReceipt(stamp);
  update(receipt, { at: new Date().toISOString(), previewStale: readBuildSource() !== stamp });
  writeReceipt(receipt);
}

const repoRelative = (path) => relative(ROOT, resolve(path));

const fileHash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function recordEntry(fields) {
  const stamp = sourceHash();
  const artifacts = fields.artifacts.map(repoRelative);
  const entry = {
    ...fields,
    stamp,
    at: new Date().toISOString(),
    previewStale: fields.origin !== "dev" && readBuildSource() !== stamp,
    artifacts,
    artifactHashes: Object.fromEntries(
      artifacts
        .filter((artifact) => existsSync(join(ROOT, artifact)))
        .map((artifact) => [artifact, fileHash(join(ROOT, artifact))]),
    ),
  };
  const problems = validateEntry(entry);
  if (problems.length > 0) {
    throw new Error(`receipt entry rejected: ${problems.join("; ")}`);
  }
  const receipt = currentReceipt(stamp);
  receipt.entries.push(entry);
  writeReceipt(receipt);
  return entry;
}

export function recordJudge({ requirement, verdict, sheet, reference = false, userQuote }) {
  const stamp = sourceHash();
  const { entries } = currentReceipt(stamp);
  const refusals = judgeRecordProblems(entries, requirement, verdict, stamp, userQuote);
  if (refusals.length > 0) {
    throw new Error(refusals.join("; "));
  }
  const entry = recordEntry({
    kind: "judge",
    requirement,
    round: Math.min(judgeState(entries, requirement).rounds + 1, JUDGE_MAX_ROUNDS),
    verdict,
    sheetHash: fileHash(resolve(sheet)),
    reference,
    artifacts: [resolve(sheet)],
    ...(userQuote ? { userQuote } : {}),
  });
  const judged = [...entries, entry].filter((item) => item.requirement === requirement);
  return { ...entry, problems: judgeProblems(judged) };
}

export function recordScreenshot(path, pageUrl) {
  const file = repoRelative(path);
  const dev = pageUrl ? recordableOrigin(new URL(pageUrl).origin) === "dev" : false;
  updateReceipt((receipt, { at, previewStale }) => {
    receipt.screenshots = [
      ...receipt.screenshots.filter((shot) => shot.path !== file),
      dev ? { path: file, at, previewStale: false, origin: "dev" } : { path: file, at, previewStale },
    ];
  });
}

const describeEntry = (entry) =>
  [
    entry.kind,
    entry.frameId ? `frame ${entry.frameId}` : null,
    entry.route ?? null,
    entry.viewport ? `@${entry.viewport}` : null,
  ]
    .filter(Boolean)
    .join(" ");

const FRAME_WIDTHS = Object.values(config.viewports ?? {}).map((viewport) => viewport.width);

const frameProblems = (frameIds, entries) =>
  frameIds
    .filter(
      (frameId) =>
        !entries.some(
          (entry) =>
            entry.kind === "layout-proof" &&
            entry.frameId === frameId &&
            entry.verdict === "pass" &&
            FRAME_WIDTHS.includes(entry.viewport),
        ),
    )
    .map(
      (frameId) =>
        `frame ${frameId}: no passing layout-proof at a frame width (${FRAME_WIDTHS.join("/")}) on this stamp (Figma node in the chat)`,
    );

const isCarried = (entry, stamp) => Boolean(entry.stamp) && entry.stamp !== stamp;

const unresolvedBlockers = (entries, stamp) => {
  const unresolved = new Map();
  for (const entry of entries) {
    const key = entryKey(entry);
    const current = unresolved.get(key);
    if (entry.verdict !== "pass") {
      unresolved.set(key, { blocker: entry, changed: false, carried: isCarried(entry, stamp) });
      continue;
    }
    if (!current) continue;
    const changed =
      Boolean(entry.manifestHash) &&
      Boolean(current.blocker.manifestHash) &&
      entry.manifestHash !== current.blocker.manifestHash;
    if ((changed && entry.reason) || (current.carried && !changed)) {
      unresolved.delete(key);
      continue;
    }
    current.changed = changed;
  }
  return [...unresolved.values()].filter(({ carried, changed }) => !carried || changed);
};

const motionProblems = (motionFiles, entries) => {
  if (motionFiles.length === 0) return [];
  const probed = entries.some(
    (entry) => entry.kind === "motion-probe" && entry.verdict === "pass" && entry.motion === true,
  );
  return probed
    ? []
    : [
        `motion-touching diff in ${motionFiles.join(", ")} (transition, animation, keyframes, scroll or rAF): no passing motion-probe with real motion on this stamp`,
      ];
};

export function receiptProblems(receipt, stamp, scope = {}) {
  const frameIds = scope.frameIds ?? [];
  const motionFiles = scope.motionFiles ?? [];
  if (!receipt) {
    return [
      `no verify-ui receipt at ${repoRelative(RECEIPT_FILE)}`,
      ...frameProblems(frameIds, []),
      ...motionProblems(motionFiles, []),
    ];
  }
  if (receipt.stamp !== stamp) {
    return [
      "receipt is stale: runtime source changed after the last proof",
      ...frameProblems(frameIds, []),
      ...motionProblems(motionFiles, []),
      ...judgeProblems(receipt.entries ?? []),
    ];
  }
  const section = ticketScope().kind === "section";
  const recorded = receipt.entries ?? [];
  const entries = section ? recorded : recorded.filter((entry) => entry.origin !== "dev");
  const problems = [];
  for (const entry of recorded.filter((item) => !entries.includes(item))) {
    problems.push(
      `${describeEntry(entry)}: dev-origin proof does not count on assembly scope (needs the build + preview verify origin)`,
    );
  }
  for (const { blocker, changed } of unresolvedBlockers(
    entries.filter((entry) => entry.kind !== "judge"),
    stamp,
  )) {
    problems.push(`${describeEntry(blocker)}: ${blocker.verdict}`);
    if (changed) {
      problems.push(
        `${describeEntry(blocker)}: manifest changed after ${blocker.verdict.toUpperCase()} without a recorded reason (stale)`,
      );
    }
  }
  for (const entry of entries.filter((item) => item.kind === "judge" || !isCarried(item, stamp))) {
    if (entry.previewStale && entry.kind !== "judge") {
      problems.push(`${describeEntry(entry)} ran against a stale preview build`);
    }
    for (const artifact of entry.artifacts ?? []) {
      if (!existsSync(join(ROOT, artifact))) {
        problems.push(`recorded artifact missing (receipt stale): ${artifact}`);
      }
    }
  }
  const lastHashes = new Map(
    entries
      .filter((entry) => !isCarried(entry, stamp))
      .flatMap((entry) => Object.entries(entry.artifactHashes ?? {})),
  );
  for (const [artifact, hash] of lastHashes) {
    const path = join(ROOT, artifact);
    if (existsSync(path) && fileHash(path) !== hash) {
      problems.push(`recorded artifact changed after its run (receipt stale): ${artifact}`);
    }
  }
  const passed = (name) => entries.some((entry) => entry.kind === name && entry.verdict === "pass");
  problems.push(...frameProblems(frameIds, entries));
  problems.push(...motionProblems(motionFiles, entries));
  problems.push(...judgeProblems(entries, { stamp, userTexts: scope.userTexts }));
  if (frameIds.length === 0 && !PROOF_SETS.some((set) => set.every(passed))) {
    problems.push(
      `missing proof: ${PROOF_SETS.map((set) => set.join(" + ")).join(" or ")} with exit 0`,
    );
  }
  const screenshots = (receipt.screenshots ?? []).filter(
    (shot) =>
      !shot.previewStale &&
      (section || shot.origin !== "dev") &&
      existsSync(join(ROOT, shot.path)),
  );
  if (screenshots.length === 0) {
    problems.push("no screenshot from `control browser screenshot` on the fresh preview");
  }
  return problems;
}

if (isMain(import.meta.url)) {
  answerHelp(`Usage: receipt.mjs
       receipt.mjs --judge <requirement> <pass|fail|incomplete> --sheet <sheet.png> [--reference] [--user-quote <text>]

Prints the verify-ui receipt for the current source as JSON, with the fresh-proof verdict.
Each entry is one proof run: kind (layout-proof, console-check, overflow-check, motion-probe, judge), route, viewport, verdict pass|fail|incomplete.
Exit 0: fresh proof (layout-proof, or console-check + overflow-check, every entry pass on a fresh preview; a screenshot exists).
Exit 1: the problems are listed in the output.
A receipt belongs to the branch that recorded it; on another branch it reads as missing.

Ticket scope comes from the branch name. A front/feature-<page>-<section>_section branch is section scope; every other branch is assembly scope.
Section scope: a run on the dev origin (astro dev on this checkout's dev port, FSTACK_DEV_PORT) is recorded with origin "dev" and counts, with its screenshots, like a verify-origin run. The source stamp covers only the section slice, its assets and shared styles (source-stamp.mjs --help), so merging assembly into an unchanged section keeps the receipt fresh.
Assembly scope: only the build + preview verify origin counts. A dev-origin run is not recorded, and a dev-origin entry found in a receipt is listed as a problem.

--judge records one visual-judge verdict for a requirement as its next round (rounds 1 to 3). A FAIL stands until a pass on a newer source stamp; round 3 without a pass prints ESCALATE, and a further round is refused.
--user-quote records the user's own decision on a failing or escalated requirement and starts its rounds over. The quote is the user's own words, copied from their message.

Examples:
  node .agents/skills/verify-ui/scripts/receipt.mjs
  node .agents/skills/verify-ui/scripts/receipt.mjs && echo "fresh proof"
  node .agents/skills/verify-ui/scripts/receipt.mjs --judge "hero heading weight" fail --sheet .cursor/fstack/artifacts/hero/sheet.png --reference
`);
  const [mode, requirement, verdict, sheetFlag, sheet] = process.argv.slice(2);
  const flagValue = (flag) => {
    const index = process.argv.indexOf(flag);
    return index > 0 ? process.argv[index + 1] : undefined;
  };
  if (mode === "--judge") {
    if (!requirement || !VERDICTS.includes(verdict) || sheetFlag !== "--sheet" || !sheet) {
      console.error("usage: receipt.mjs --judge <requirement> <pass|fail|incomplete> --sheet <sheet.png> [--reference] [--user-quote <text>]");
      process.exit(2);
    }
    try {
      const recorded = recordJudge({
        requirement,
        verdict,
        sheet,
        reference: process.argv.includes("--reference"),
        userQuote: flagValue("--user-quote"),
      });
      console.log(JSON.stringify({ ok: true, requirement, round: recorded.round, verdict, problems: recorded.problems }, null, 2));
      process.exit(0);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  const receipt = readReceipt();
  const problems = receiptProblems(receipt, sourceHash());
  console.log(JSON.stringify({ ok: problems.length === 0, problems, receipt }, null, 2));
  process.exit(problems.length === 0 ? 0 : 1);
}
