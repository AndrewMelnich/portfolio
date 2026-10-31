import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHECK_FILE = /\.figma\.check\.yml$/;

const normalize = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();

const blocksOf = (text) => text.split(/^(?=\s*-\s)/m);

const quoteOf = (block) => {
  const match = block.match(/^\s*user_quote:\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
};

const unquotedOverride = (userText) => (block) => {
  if (!/^\s*override:\s*true\s*$/m.test(block)) return false;
  const quote = normalize(quoteOf(block));
  return quote === "" || !userText.includes(quote);
};

export function overrideFindings(root, edits, facts) {
  const userText = normalize(facts.userTexts.join("\n"));
  const unquoted = unquotedOverride(userText);
  return edits
    .filter((file) => CHECK_FILE.test(file) && existsSync(join(root, file)))
    .filter((file) => blocksOf(readFileSync(join(root, file), "utf8")).some(unquoted))
    .map(
      (file) =>
        `design-review override in ${file} has no user_quote from this chat. Remove the override, or ask the user to state it in their own words.`,
    );
}
