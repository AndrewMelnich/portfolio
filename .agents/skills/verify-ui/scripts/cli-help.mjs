import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const isMain = (url) => {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(url);
  } catch {
    return false;
  }
};

export function answerHelp(text, argv = process.argv.slice(2)) {
  if (!argv.includes("--help")) {
    return;
  }
  console.log(text.trimEnd());
  process.exit(0);
}
