import { VERIFY } from "./project.mjs";

const NAV_TIMEOUT_MS = 60_000;
const APP_READY_TIMEOUT_MS = 20_000;
const SETTLE_CAP_MS = 5_000;

const routed = new WeakSet();

export async function stubMedia(page) {
  if (routed.has(page)) {
    return;
  }
  routed.add(page);
  await page.route("**/*", (route) =>
    route.request().resourceType() === "media" ? route.fulfill({ status: 204, body: "" }) : route.fallback(),
  );
}

async function waitAppReady(page) {
  if (!VERIFY.appReady) {
    return;
  }
  await page.waitForFunction(VERIFY.appReady, null, { timeout: APP_READY_TIMEOUT_MS }).catch(() => {});
}

export async function waitPageReady(page) {
  await waitAppReady(page);
  await page.evaluate(async (capMs) => {
    const cap = (work) => Promise.race([work, new Promise((done) => setTimeout(done, capMs))]);
    await cap(document.fonts?.ready);
    await cap(
      Promise.all(
        [...document.images].filter((img) => img.loading !== "lazy").map((img) => img.decode().catch(() => {})),
      ),
    );
  }, SETTLE_CAP_MS);
}

export async function gotoReady(page, url, { timeout = NAV_TIMEOUT_MS } = {}) {
  await stubMedia(page);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await waitPageReady(page);
  return response;
}
