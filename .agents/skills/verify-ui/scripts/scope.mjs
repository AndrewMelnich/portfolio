import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  SECTION_BRANCH,
  allowList,
  currentBranch as branchAt,
  sectionOfBranch,
} from "./diff-in-slice.mjs";
import { ROOT } from "./project.mjs";

export const currentBranch = () => branchAt(ROOT) || null;

export function ticketScope() {
  const branch = currentBranch();
  if (!branch || !SECTION_BRANCH.test(branch)) {
    return { kind: "assembly", branch, slice: null };
  }
  const names = sectionOfBranch(branch, (dir) => existsSync(join(ROOT, dir)));
  if (!names) {
    return { kind: "section", branch, slice: null };
  }
  const allow = allowList(names);
  return { kind: "section", branch, slice: [...allow.slice, allow.assetsPathspec] };
}
