import { conversationIds, recordEdits } from "./conversation-edits.mjs";
import { projectRoot, readStdinJson } from "./hook-input.mjs";

const input = readStdinJson();
const root = projectRoot(input);
const paths = [input.file_path, ...(input.modified_files ?? [])].filter(
  Boolean,
);

for (const id of conversationIds(input)) {
  recordEdits(root, id, paths);
}
