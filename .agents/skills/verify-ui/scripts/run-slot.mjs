import { ROOT } from "./project.mjs";
import { acquireSlot, describeWait, releaseSlot } from "./slots.mjs";

export async function holdRunSlot(kind) {
  const slot = await acquireSlot({
    kind,
    root: ROOT,
    onWait: (wait) => console.error(describeWait(wait, kind)),
  });
  process.once("exit", () => releaseSlot(slot));
  return slot;
}
