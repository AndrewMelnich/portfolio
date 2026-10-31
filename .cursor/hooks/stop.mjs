import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clearEdits, pruneStale, readEdits } from "./conversation-edits.mjs";
import { projectRoot, readStdinJson } from "./hook-input.mjs";
import { overrideFindings } from "./design-review-overrides.mjs";
import { judgeQuoteFindings } from "./judge-quotes.mjs";
import { lintFindings } from "./lint-findings.mjs";
import { readChat, STOP_FOLLOWUP_MARK } from "./proof-scope.mjs";
import { tamperFindings } from "./tamper-guard.mjs";

const HOOKS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../hooks.json",
);
const DEFAULT_LOOP_LIMIT = 3;
const RELEVANT = /^(frontend\/|\.agents\/skills\/verify-ui\/scripts\/)/;
const CHECKS = [
  ["lint", lintFindings],
  ["verify-ui-tamper", tamperFindings],
  ["design-review-override", overrideFindings],
  ["judge-user-quote", judgeQuoteFindings],
];
const LAST_ATTEMPT =
  "This is the last automatic follow-up. If a check still cannot pass, do not report the task as done: list each red or missing proof above and why in the final answer.";

const ownLoopLimit = () => {
  try {
    const hooks = JSON.parse(readFileSync(HOOKS_PATH, "utf8"));
    const own = [
      ...(hooks.hooks?.stop ?? []),
      ...(hooks.hooks?.subagentStop ?? []),
    ].find((hook) => String(hook.command).includes("stop.mjs"));
    return Number.isInteger(own?.loop_limit)
      ? own.loop_limit
      : DEFAULT_LOOP_LIMIT;
  } catch {
    return DEFAULT_LOOP_LIMIT;
  }
};

const findingsOf = async (root, edits, facts) => {
  const chunks = [];
  for (const [name, check] of CHECKS) {
    try {
      chunks.push(...(await check(root, edits, facts)));
    } catch (error) {
      chunks.push(
        `${name} stop check crashed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return chunks;
};

const main = async () => {
  const input = readStdinJson();
  if (input.status && input.status !== "completed") return;
  const root = projectRoot(input);
  pruneStale(root);
  const id = input.conversation_id;
  if (!id) return;
  const loopLimit = ownLoopLimit();
  const loopCount = Number.isFinite(Number(input.loop_count))
    ? Number(input.loop_count)
    : 0;
  if (loopCount >= loopLimit) return;
  const edits = readEdits(root, id).filter((file) => RELEVANT.test(file));
  if (edits.length === 0) return;
  const facts = {
    ...readChat(input.transcript_path),
    subagent: input.hook_event_name === "subagentStop",
  };
  const chunks = await findingsOf(root, edits, facts);
  if (chunks.length === 0) {
    clearEdits(root, id);
    return;
  }
  if (loopCount === loopLimit - 1) chunks.push(LAST_ATTEMPT);
  process.stdout.write(
    `${JSON.stringify({ followup_message: [STOP_FOLLOWUP_MARK, ...chunks].join("\n\n") })}\n`,
  );
};

await main();
