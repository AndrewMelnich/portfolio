import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RECEIPT_FILE = ".cursor/fstack/artifacts/receipt.json";
const LEDGER_FILE = ".cursor/hooks/state/judge-quotes.json";

const normalize = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

const currentBranch = (root) => {
  const run = spawnSync("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf8",
  });
  return run.status === 0 ? run.stdout.trim() : null;
};

const quotedEntries = (root) => {
  const receipt = readJson(join(root, RECEIPT_FILE));
  if (!receipt || (receipt.branch && receipt.branch !== currentBranch(root))) return [];
  return (receipt.entries ?? []).filter(
    (entry) => entry.kind === "judge" && typeof entry.userQuote === "string" && entry.userQuote,
  );
};

const keyOf = (entry) => `${entry.at}|${entry.requirement}`;

export function judgeQuoteFindings(root, edits, facts) {
  if (facts.subagent) return [];
  const ledgerPath = join(root, LEDGER_FILE);
  const verified = new Set(readJson(ledgerPath) ?? []);
  const chat = facts.userTexts.map(normalize);
  const unverified = quotedEntries(root).filter((entry) => !verified.has(keyOf(entry)));
  const inChat = (entry) => chat.some((text) => text.includes(normalize(entry.userQuote)));
  const found = unverified.filter(inChat);
  const missing = unverified.filter((entry) => !inChat(entry));
  if (found.length > 0) {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify([...verified, ...found.map(keyOf)]));
  }
  return missing.map(
    (entry) =>
      `judge "${entry.requirement}": user quote "${entry.userQuote}" is not in this chat. A quote must be the user's own words, copied from their message. Ask the user to state this decision, then quote them exactly.`,
  );
}
