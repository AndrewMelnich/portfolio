import { relative, resolve } from "node:path";

const VERIFY_SCRIPTS = ".agents/skills/verify-ui/scripts/";

export const isVerifyScript = (path) => path.startsWith(VERIFY_SCRIPTS);

export function tamperFindings(root, edits, facts) {
  if (facts.maintainerInvoked) return [];
  const scripts = edits.filter(isVerifyScript);
  if (scripts.length === 0) return [];
  return [
    `verify-ui script edited without maintain-verify-ui: ${scripts.join(", ")}. Revert those edits. verify-ui scripts change only inside the maintain-verify-ui skill; ask the user to run /maintain-verify-ui for a harness fix.`,
  ];
}

export function guardDecision(root, toolInput, facts) {
  const path = toolInput.path ?? toolInput.file_path ?? toolInput.target_file;
  if (!path) return { permission: "allow" };
  const rel = relative(root, resolve(root, path)).replaceAll("\\", "/");
  if (!isVerifyScript(rel) || facts.maintainerInvoked) return { permission: "allow" };
  return {
    permission: "deny",
    user_message: `verify-ui scripts are not edited in this chat (${rel}).`,
    agent_message: `Do not edit ${rel}. verify-ui scripts change only when the user runs /maintain-verify-ui. Report the harness problem to the user instead.`,
  };
}
