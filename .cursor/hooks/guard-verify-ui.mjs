import { projectRoot, readStdinJson } from "./hook-input.mjs";
import { readChat } from "./proof-scope.mjs";
import { guardDecision } from "./tamper-guard.mjs";

const input = readStdinJson();
const root = projectRoot(input);
const decision = guardDecision(root, input.tool_input ?? {}, readChat(input.transcript_path));
process.stdout.write(`${JSON.stringify(decision)}\n`);
