export const VERDICTS = ["pass", "fail", "incomplete"];
export const JUDGE_MAX_ROUNDS = 3;

const HASH = /^[0-9a-f]{64}$/;

const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isInt = (value, min) => Number.isInteger(value) && value >= min;
const isWidth = (value) => isInt(value, 1);
const isHash = (value) => typeof value === "string" && HASH.test(value);
const isBool = (value) => typeof value === "boolean";
const isRatio = (value) => typeof value === "number" && value >= 0 && value <= 1;
const isIsoDate = (value) => isText(value) && !Number.isNaN(Date.parse(value));
const isTextList = (value) => Array.isArray(value) && value.every(isText);
const isCoverage = (value) =>
  Boolean(value) && isInt(value.mapped, 0) && isInt(value.total, 0) && value.mapped <= value.total;
const isSteps = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);

const ORIGINS = ["verify", "dev"];

const COMMON = {
  verdict: (value) => VERDICTS.includes(value),
  origin: (value) => value === undefined || ORIGINS.includes(value),
  at: isIsoDate,
  previewStale: isBool,
  artifacts: isTextList,
};

const KINDS = {
  "layout-proof": {
    route: isText,
    viewport: isWidth,
    frameId: isText,
    manifestHash: isHash,
    skipCount: (value) => isInt(value, 0),
    coverage: isCoverage,
  },
  "console-check": { route: isText, viewport: isWidth },
  "overflow-check": { route: isText, viewport: isWidth },
  "motion-probe": {
    route: isText,
    viewport: isWidth,
    target: isText,
    steps: isSteps,
    motion: isBool,
    rangeRatio: (value) => value === null || isRatio(value),
  },
  judge: {
    requirement: isText,
    round: (value) => isInt(value, 1) && value <= JUDGE_MAX_ROUNDS,
    sheetHash: isHash,
    reference: isBool,
  },
};

export const KIND_NAMES = Object.keys(KINDS);

export function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return ["entry must be an object"];
  }
  const spec = KINDS[entry.kind];
  if (!spec) {
    return [`unknown kind ${JSON.stringify(entry.kind)}`];
  }
  const problems = Object.entries({ ...COMMON, ...spec })
    .filter(([field, check]) => !check(entry[field]))
    .map(([field]) => `${entry.kind}: ${field} is missing or invalid`);
  if (entry.reason !== undefined && !isText(entry.reason)) {
    problems.push(`${entry.kind}: reason must be a non-empty string when present`);
  }
  if (entry.userQuote !== undefined && !isText(entry.userQuote)) {
    problems.push(`${entry.kind}: userQuote must be a non-empty string when present`);
  }
  return problems;
}

const normalizeQuote = (text) => text.toLowerCase().replace(/\s+/g, " ").trim();

const judgeEntries = (entries) => entries.filter((entry) => entry.kind === "judge");

export function judgeState(entries, requirement) {
  let rounds = 0;
  let blocker = null;
  for (const entry of judgeEntries(entries)) {
    if (entry.requirement !== requirement) continue;
    if (entry.userQuote) {
      blocker = null;
      rounds = 0;
    } else if (entry.verdict !== "pass") {
      blocker = entry;
      rounds += 1;
    } else if (blocker && entry.stamp === blocker.stamp) {
      rounds += 1;
    } else {
      blocker = null;
      rounds = 0;
    }
  }
  return { rounds, blocker };
}

const escalation = (requirement, rounds, verdict) =>
  `judge "${requirement}": round ${rounds} ${verdict.toUpperCase()} → ESCALATE to the user: stop re-judging this requirement, report the visible difference, and record the user's decision with receipt.mjs --judge ... --user-quote "<their words>"`;

export function judgeProblems(entries, { stamp, userTexts } = {}) {
  const requirements = [...new Set(judgeEntries(entries).map((entry) => entry.requirement))];
  const chat = (userTexts ?? []).map(normalizeQuote);
  const unquoted = userTexts
    ? judgeEntries(entries)
        .filter((entry) => entry.userQuote && entry.stamp === stamp)
        .filter((entry) => !chat.some((text) => text.includes(normalizeQuote(entry.userQuote))))
        .map((entry) => `judge "${entry.requirement}": user quote "${entry.userQuote}" is not in this chat`)
    : [];
  return unquoted.concat(requirements.flatMap((requirement) => {
    const { rounds, blocker } = judgeState(entries, requirement);
    if (!blocker) return [];
    if (rounds >= JUDGE_MAX_ROUNDS) return [escalation(requirement, rounds, blocker.verdict)];
    return [
      `judge "${requirement}": round ${rounds} ${blocker.verdict.toUpperCase()}: fix the visible difference, then re-judge on a new source stamp`,
    ];
  }));
}

export function judgeRecordProblems(entries, requirement, verdict, stamp, userQuote) {
  const { rounds, blocker } = judgeState(entries, requirement);
  if (!blocker || userQuote) return [];
  if (rounds >= JUDGE_MAX_ROUNDS) return [escalation(requirement, rounds, blocker.verdict)];
  if (verdict === "pass" && blocker.stamp === stamp) {
    return [
      `judge "${requirement}": ${blocker.verdict.toUpperCase()} stands on this source stamp; a PASS needs a new one, or the user's decision via --user-quote`,
    ];
  }
  return [];
}

export function carriedEntries(entries) {
  const latest = new Map();
  for (const entry of entries) {
    if (entry.kind === "layout-proof") latest.set(entryKey(entry), entry);
  }
  return [
    ...judgeEntries(entries),
    ...[...latest.values()].filter((entry) => entry.verdict !== "pass"),
  ];
}

export function entryKey(entry) {
  if (entry.kind === "layout-proof") {
    return `layout-proof:${entry.frameId}@${entry.viewport}`;
  }
  if (entry.kind === "motion-probe") {
    return `motion-probe:${entry.route}@${entry.viewport}:${entry.target}`;
  }
  if (entry.kind === "judge") {
    return `judge:${entry.requirement}`;
  }
  return `${entry.kind}:${entry.route}@${entry.viewport}`;
}
