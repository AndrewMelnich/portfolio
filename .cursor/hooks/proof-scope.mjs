import { existsSync, readFileSync } from "node:fs";

const MAINTAINER = "maintain-verify-ui";

export const STOP_FOLLOWUP_MARK = "[stop-gate follow-up]";

const USER_QUERY = /<user_query>([\s\S]*?)<\/user_query>/g;

const userWords = (text) => {
  const queries = [...text.matchAll(USER_QUERY)].map((match) => match[1]);
  const words = queries.length > 0 ? queries.join("\n") : text;
  return words.includes(STOP_FOLLOWUP_MARK) ? null : words;
};

export function readChat(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return { userTexts: [], maintainerInvoked: false };
  }
  const userTexts = [];
  let maintainerInvoked = false;
  for (const line of readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.role !== "user") continue;
    const text = userWords(
      (entry.message?.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n"),
    );
    if (text === null) continue;
    userTexts.push(text);
    if (text.includes(MAINTAINER)) maintainerInvoked = true;
  }
  return { userTexts, maintainerInvoked };
}
