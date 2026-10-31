#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerHelp } from "./cli-help.mjs";
import {
  contextOptions,
  launchBrowser,
  parseContextFlags,
  parseFlowLines,
  runBrowserStep,
  targetLocator,
} from "./control.mjs";
import { requireFromApp, targetOrigin } from "./project.mjs";
import { recordEntry, recordableOrigin } from "./receipt.mjs";
import { holdRunSlot } from "./run-slot.mjs";
import { composeSheet } from "./visual-compare.mjs";

answerHelp(`Usage: motion-probe.mjs [context flags] --target <selector> --out <dir> [--threshold 1] [--file flow.txt] [--reduce] < flow

Runs a flow in the verify browser and watches every element matching --target for blinks, jumps and hidden parts.
From screencast pixels and from a DOM sampler (visible area, position, clipping by overflow ancestors, occlusion by fixed or sticky elements).
Steps before \`record\` set the scene; steps after it are recorded. Flow lines are control.mjs browser steps.
A recorded \`hover\` needs a later \`leave\`, and a recorded \`click\` that flips aria-expanded (or a details) needs a closing step; otherwise the probe exits 2.
\`record-range --track <selector>\` records like \`record\` and fails when less than 90% of the track's scroll range (view timeline cover) was recorded.
\`--compare <selector>\` also samples a reference element and fails when a target's trajectory differs from it (progress along the move at 10 steps, 10% limit).
Default: motion on (no-preference). --reduce probes the reduced-motion path.
--prop <name> (repeatable) samples a computed style or CSS custom property on each target, and --expect monotonic,linear (default both) checks it against the window scroll position.
Exit 0: nothing blinks, jumps, kinks, is clipped or occluded, and no check fails. Exit 1: report.json names the element, frame, and channel; sheet.png holds the evidence. Warnings (text scaled non-uniformly) are listed but do not change the exit code. On the verify origin (or the dev origin on a *_section branch) the run also records a motion-probe receipt entry.
Context flags: --viewport <name|WxH>, --engine chromium|webkit|firefox, --device "<Playwright device>".

Examples:
  node .agents/skills/verify-ui/scripts/motion-probe.mjs --viewport 375 --target '.js-accordion-trigger' --out .cursor/fstack/artifacts/faq/motion <<'EOF'
  goto /faq/
  record
  scroll --selector .js-scroll-panel --by 16 --repeat 120
  EOF
  node .agents/skills/verify-ui/scripts/motion-probe.mjs --target '.hero__title' --file .cursor/fstack/artifacts/home/flow.txt
`);

const sharp = requireFromApp("sharp");

const SAMPLE = 128;
const PIXEL_DELTA = 24;
const MAX_BLINK_FRAMES = 3;
const RETURN_RATIO = 0.5;
const HIDDEN_RATIO = 0.1;
const KINK_KEYS = ["top", "left", "width", "height"];
const KINK_WINDOW = 6;
const KINK_MIN = 4;
const KINK_RATIO = 3;
const LINEAR_TOLERANCE = 0.05;
const RANGE_MIN = 0.9;
const STRETCH_LIMIT = 1.02;
const TRAJECTORY_STEPS = 10;
const TRAJECTORY_LIMIT = 0.1;
const MIN_TRAVEL = 8;

const takeFlag = (args, name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};

const argv = process.argv.slice(2);
const target = takeFlag(argv, "--target");
const outDir = resolve(takeFlag(argv, "--out") ?? "motion-probe");
const threshold = Number(takeFlag(argv, "--threshold") ?? 1);
const flowFile = takeFlag(argv, "--file");
const props = [];
for (let i = argv.indexOf("--prop"); i >= 0; i = argv.indexOf("--prop"))
  props.push(argv.splice(i, 2)[1]);
const expected = (takeFlag(argv, "--expect") ?? "monotonic,linear").split(",");
if (expected.some((name) => !["monotonic", "linear"].includes(name))) {
  console.error(
    "motion-probe: --expect takes monotonic and linear, comma-separated",
  );
  process.exit(2);
}
const compare = takeFlag(argv, "--compare");
const { flags } = parseContextFlags(argv);
if (!argv.includes("--reduce")) flags.motion = true;

if (!target) {
  console.error(
    "Usage: motion-probe.mjs [context flags] --target <selector> --out <dir> [--threshold 1] [--file flow.txt] < flow",
  );
  process.exit(2);
}

const steps = parseFlowLines(
  flowFile ? readFileSync(flowFile, "utf8") : readFileSync(0, "utf8"),
);
const recordAt = steps.findIndex(
  (s) => s.sub === "record" || s.sub === "record-range",
);
if (recordAt < 0) {
  console.error(
    "motion-probe: flow needs a `record` or `record-range --track <selector>` line between setup and the recorded steps",
  );
  process.exit(2);
}
const recordStep = steps[recordAt];
const trackAt = recordStep.rest.indexOf("--track");
const track = trackAt >= 0 ? recordStep.rest[trackAt + 1] : null;
if (recordStep.sub === "record-range" && !track) {
  console.error("motion-probe: record-range needs --track <selector>");
  process.exit(2);
}
if (
  steps.some((s) => s.sub === "hover") &&
  !steps.some((s, i) => s.sub === "leave" && i > recordAt)
) {
  console.error(
    "motion-probe: hover scenario incomplete: enter (hover) without leave. Add a `leave` line after `record`",
  );
  process.exit(2);
}

const meta = { url: targetOrigin() };

const toggleState = (locator) =>
  locator
    .evaluate(
      (el) => {
        const details = el.closest("details");
        return details ? String(details.open) : el.getAttribute("aria-expanded");
      },
      null,
      { timeout: 1000 },
    )
    .catch(() => null);

const startDomSampler = ({ selector, props, compare }) => {
  const frames = [];
  const grid = 6;
  const unbounded = {
    left: -Infinity,
    top: -Infinity,
    right: Infinity,
    bottom: Infinity,
  };
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const area = (r) =>
    Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  const nameOf = (el) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.classList[0] ? `.${el.classList[0]}` : ""}`;
  const clipOf = (el) => {
    let rect = unbounded;
    let by = null;
    for (
      let node = el.parentElement;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      const clipsX = style.overflowX !== "visible";
      const clipsY = style.overflowY !== "visible";
      if (!clipsX && !clipsY) continue;
      const box = node.getBoundingClientRect();
      by ??= nameOf(node);
      rect = intersect(rect, {
        left: clipsX ? box.left : -Infinity,
        right: clipsX ? box.right : Infinity,
        top: clipsY ? box.top : -Infinity,
        bottom: clipsY ? box.bottom : Infinity,
      });
    }
    return { rect, by };
  };
  const fixedOf = (node) => {
    for (let n = node; n instanceof Element; n = n.parentElement) {
      const position = getComputedStyle(n).position;
      if (position === "fixed" || position === "sticky") return n;
    }
    return null;
  };
  const occlusionOf = (el, region) => {
    if (area(region) === 0 || getComputedStyle(el).pointerEvents === "none")
      return { ratio: 0, by: null };
    const hits = new Map();
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        const x =
          region.left + ((i + 0.5) * (region.right - region.left)) / grid;
        const y =
          region.top + ((j + 0.5) * (region.bottom - region.top)) / grid;
        const hit = document.elementFromPoint(x, y);
        if (!hit || hit === el || el.contains(hit) || hit.contains(el))
          continue;
        const fixed = fixedOf(hit);
        if (fixed) hits.set(fixed, (hits.get(fixed) ?? 0) + 1);
      }
    }
    const ranked = [...hits].sort((a, b) => b[1] - a[1]);
    const covered = ranked.reduce((sum, [, n]) => sum + n, 0);
    return {
      ratio: covered / (grid * grid),
      by: ranked[0] ? nameOf(ranked[0][0]) : null,
    };
  };
  const scaleOf = (el) => {
    let x = 1;
    let y = 1;
    for (let node = el; node instanceof Element; node = node.parentElement) {
      const transform = getComputedStyle(node).transform;
      if (transform === "none") continue;
      const m = new DOMMatrixReadOnly(transform);
      x *= Math.hypot(m.a, m.b);
      y *= Math.hypot(m.c, m.d);
    }
    return { x, y };
  };
  const visibleOf = (el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    let opacity = 1;
    for (let node = el; node instanceof Element; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    const scale = scaleOf(el);
    const stretch =
      scale.x && scale.y ? Math.max(scale.x / scale.y, scale.y / scale.x) : 1;
    const onScreen =
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth;
    const shown =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      opacity > 0.05 &&
      rect.width > 0 &&
      rect.height > 0;
    const inset = /inset\(([^)]+)\)/
      .exec(style.clipPath)?.[1]
      .split(/\s+/)
      .map(parseFloat) ?? [0];
    const [it, ir = it, ib = it, il = ir] = inset.map((v) =>
      Number.isFinite(v) ? v : 0,
    );
    const shape = {
      left: rect.left + il,
      top: rect.top + it,
      right: rect.right - ir,
      bottom: rect.bottom - ib,
    };
    const unclipped = intersect(shape, {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight,
    });
    const clip = clipOf(el);
    const visible = intersect(unclipped, clip.rect);
    const occlusion = shown
      ? occlusionOf(el, visible)
      : { ratio: 0, by: null };
    const clipped =
      area(unclipped) > 0 ? 1 - area(visible) / area(unclipped) : 0;
    let scrolled = document.scrollingElement.scrollTop;
    let scrolledX = document.scrollingElement.scrollLeft;
    for (let node = el.parentElement; node; node = node.parentElement) {
      scrolled += node.scrollTop;
      scrolledX += node.scrollLeft;
    }
    return {
      name: nameOf(el),
      shown,
      onScreen,
      area: shown
        ? Math.round(area(visible) * (1 - occlusion.ratio) * opacity)
        : 0,
      clipped: Number(clipped.toFixed(2)),
      clippedBy: clip.by,
      occluded: Number(occlusion.ratio.toFixed(2)),
      occludedBy: occlusion.by,
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      docTop: Math.round(rect.top + scrolled),
      docLeft: Math.round(rect.left + scrolledX),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      opacity: Number(opacity.toFixed(2)),
      text: el.textContent.trim().length > 0,
      stretch: Number(stretch.toFixed(3)),
      props: Object.fromEntries(
        props.map((name) => [name, parseFloat(style.getPropertyValue(name))]),
      ),
    };
  };
  const tick = (t) => {
    if (!window.__motionProbe.running) return;
    const reference = compare ? document.querySelector(compare) : null;
    frames.push({
      t,
      epoch: performance.timeOrigin + t,
      scroll: document.scrollingElement.scrollTop,
      els: [...document.querySelectorAll(selector)].map(visibleOf),
      ref: reference ? visibleOf(reference) : null,
    });
    requestAnimationFrame(tick);
  };
  window.__motionProbe = { running: true, frames };
  requestAnimationFrame(tick);
};

const domBlinks = (frames) => {
  const blinks = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (let e = 0; e < count; e++) {
    const area = frames.map((f) => f.els[e]?.area ?? 0);
    for (let i = 1; i < area.length - 1; i++) {
      const base = area[i - 1];
      for (
        let k = i + 1;
        k <= Math.min(i + MAX_BLINK_FRAMES, area.length - 1);
        k++
      ) {
        const away = Math.min(
          ...area.slice(i, k).map((a) => Math.abs(a - base)),
        );
        const back = Math.abs(area[k] - base);
        const visible = Math.max(base, ...area.slice(i, k)) > 400;
        if (
          visible &&
          away > Math.max(base, area[k]) * 0.2 &&
          back < away * RETURN_RATIO
        ) {
          blinks.push({
            element: e,
            frame: i,
            frames: k - i,
            t: Math.round(frames[i].t),
            before: frames[i - 1].els[e],
            during: frames[i].els[e],
          });
          i = k;
          break;
        }
      }
    }
  }
  return blinks;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

const trackRange = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  return {
    start: top - window.innerHeight,
    end: top + rect.height,
    maxScroll: document.scrollingElement.scrollHeight - window.innerHeight,
  };
};

const rangeOf = (frames, track, range) => {
  if (!range)
    return {
      track,
      ratio: 0,
      problem: `record-range: no element matches ${track}`,
    };
  const start = Math.max(0, range.start);
  const end = Math.min(range.maxScroll, range.end);
  const scrolls = frames.map((f) => f.scroll);
  const recorded = { min: Math.min(...scrolls), max: Math.max(...scrolls) };
  const covered = Math.max(
    0,
    Math.min(recorded.max, end) - Math.max(recorded.min, start),
  );
  const ratio = end > start ? covered / (end - start) : 0;
  const problem =
    end <= start
      ? `record-range: ${track} has no scroll range to record`
      : ratio < RANGE_MIN
        ? `record-range: ${Math.round(ratio * 100)}% of ${track} range recorded (<${RANGE_MIN * 100}%)`
        : null;
  return {
    track,
    start: Math.round(start),
    end: Math.round(end),
    recorded,
    ratio: Number(ratio.toFixed(2)),
    problem,
  };
};

const propChecks = (frames, props, expected) => {
  const results = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (const name of props) {
    for (let e = 0; e < count; e++) {
      const series = frames.flatMap((f, frame) => {
        const y = f.els[e]?.props?.[name];
        return Number.isFinite(y) ? [{ frame, x: f.scroll, y }] : [];
      });
      if (series.length < 3) continue;
      const ys = series.map((p) => p.y);
      const range = Math.max(...ys) - Math.min(...ys);
      const problems = [];
      if (expected.includes("monotonic")) {
        const slopes = series.slice(1).flatMap((p, i) => {
          const from = series[i];
          const dx = p.x - from.x;
          const dy = p.y - from.y;
          return dx !== 0 && Math.abs(dy) > range * 0.01
            ? [{ frame: p.frame, slope: dy / dx, from: from.y, to: p.y }]
            : [];
        });
        const first = slopes[0] && Math.sign(slopes[0].slope);
        const turn = slopes.find((s) => Math.sign(s.slope) !== first);
        if (turn)
          problems.push(
            `${name} not monotonic vs scroll: turns at frame ${turn.frame} (${turn.from.toFixed(2)} → ${turn.to.toFixed(2)})`,
          );
      }
      if (expected.includes("linear")) {
        const xs = series.map((p) => p.x);
        const mx = mean(xs);
        const my = mean(ys);
        const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
        const sxy = series.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0);
        if (sxx === 0)
          problems.push(
            `${name} not linear vs scroll: the page did not scroll during the recording`,
          );
        else if (range > 0) {
          const slope = sxy / sxx;
          const deviation =
            Math.max(...series.map((p) => Math.abs(p.y - (my + slope * (p.x - mx))))) /
            range;
          if (deviation > LINEAR_TOLERANCE)
            problems.push(
              `${name} not linear vs scroll: max deviation ${Math.round(deviation * 100)}% of its range (limit ${LINEAR_TOLERANCE * 100}%)`,
            );
        }
      }
      results.push({ element: e, name, problems });
    }
  }
  return results;
};

const seriesJumps = (values, minStep) => {
  const steps = values.slice(1).map((v, i) => v - values[i]);
  const jumps = [];
  for (let i = 0; i < steps.length; i++) {
    const around = [
      ...steps.slice(Math.max(0, i - 5), i),
      ...steps.slice(i + 1, i + 6),
    ];
    if (around.length < 4) continue;
    const typical = median(around);
    const spread = median(around.map((s) => Math.abs(s - typical)));
    const off = Math.abs(steps[i] - typical);
    if (
      off > minStep &&
      off > 6 * spread + minStep / 2 &&
      Math.abs(steps[i]) > Math.abs(typical)
    )
      jumps.push({
        frame: i + 1,
        step: Math.round(steps[i]),
        typical: Math.round(typical),
      });
  }
  return jumps;
};

const domJumps = (frames) => {
  const jumps = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (let e = 0; e < count; e++) {
    const live = frames
      .map((f, i) => ({ i, el: f.els[e] }))
      .filter(({ el }) => el?.shown && el.onScreen);
    const present = frames
      .map((f, i) => ({ i, el: f.els[e] }))
      .filter(({ el }) => el?.onScreen);
    if (live.length < 6) continue;
    const width = median(live.map(({ el }) => el.width));
    const at = (series, key, minStep) =>
      new Map(
        seriesJumps(
          series.map(({ el }) => el[key]),
          minStep,
        ).map((j) => [series[j.frame].i, j]),
      );
    const top = at(live, "top", 12);
    const doc = at(live, "docTop", 12);
    const left = at(live, "left", 12);
    const docLeft = at(live, "docLeft", 12);
    const area = at(present, "area", Math.max(400, width * 24));
    const near = (map, f) => map.has(f - 1) || map.has(f) || map.has(f + 1);
    const push = (key, frame, j) => {
      jumps.push({
        element: e,
        key,
        frame,
        t: Math.round(frames[frame].t),
        step: j.step,
        typical: j.typical,
      });
    };
    for (const [f, j] of top) if (near(doc, f)) push("top", f, j);
    for (const [f, j] of left) if (near(docLeft, f)) push("left", f, j);
    for (const [f, j] of area)
      if (!near(top, f) && !near(left, f)) push("area", f, j);
  }
  return jumps;
};

const curveOf = (samples) => {
  const points = samples.flatMap((el) =>
    el ? [{ x: el.docLeft, y: el.docTop }] : [],
  );
  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length2 = dx * dx + dy * dy;
  if (length2 < MIN_TRAVEL * MIN_TRAVEL) return null;
  const p = points.map(
    (q) => ((q.x - first.x) * dx + (q.y - first.y) * dy) / length2,
  );
  const start = p.findIndex((v) => v > 0.02);
  const end = start < 0 ? -1 : p.findIndex((v, i) => i > start && v >= 0.98);
  if (end < 0) return null;
  return Array.from({ length: TRAJECTORY_STEPS + 1 }, (_, k) => {
    const at = start + ((end - start) * k) / TRAJECTORY_STEPS;
    const i = Math.floor(at);
    const a = p[i];
    const b = p[Math.min(i + 1, p.length - 1)];
    return a + (b - a) * (at - i);
  });
};

const trajectoryChecks = (frames, selector) => {
  if (!frames.some((f) => f.ref))
    return [{ problem: `compare: no element matches ${selector}` }];
  const reference = curveOf(frames.map((f) => f.ref));
  if (!reference)
    return [{ problem: `compare: ${selector} did not move enough to compare` }];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  const checks = [];
  for (let e = 0; e < count; e++) {
    const name = nameAt(frames, e);
    const curve = curveOf(frames.map((f) => f.els[e]));
    if (!curve) {
      checks.push({
        element: e,
        problem: `compare: ${name} did not move enough to compare with ${selector}`,
      });
      continue;
    }
    const deviations = curve.map((v, k) => Math.abs(v - reference[k]));
    const worst = Math.max(...deviations);
    const at = deviations.indexOf(worst) / TRAJECTORY_STEPS;
    checks.push({
      element: e,
      deviation: Number(worst.toFixed(2)),
      at,
      problem:
        worst > TRAJECTORY_LIMIT
          ? `${name} trajectory differs from ${selector} (max deviation ${Math.round(worst * 100)}% at ${Math.round(at * 100)}% of the move): easing or timing differs`
          : null,
    });
  }
  return checks;
};

const domKinks = (frames) => {
  const kinks = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (let e = 0; e < count; e++) {
    const live = frames
      .map((f, i) => ({ i, el: f.els[e] }))
      .filter(({ el }) => el?.shown && el.onScreen);
    if (live.length < 2 * KINK_WINDOW + 1) continue;
    for (const key of KINK_KEYS) {
      const values = live.map(({ el }) => el[key]);
      const steps = values.slice(1).map((v, i) => Math.abs(v - values[i]));
      let next = 0;
      for (let k = KINK_WINDOW; k + KINK_WINDOW <= steps.length; k++) {
        if (k < next) continue;
        const before = median(steps.slice(k - KINK_WINDOW, k));
        const after = median(steps.slice(k, k + KINK_WINDOW));
        if (Math.min(before, after) < KINK_MIN) continue;
        if (Math.max(before, after) < KINK_RATIO * Math.min(before, after))
          continue;
        kinks.push({
          element: e,
          key,
          frame: live[k].i,
          t: Math.round(frames[live[k].i].t),
          before: Math.round(before),
          after: Math.round(after),
        });
        next = k + KINK_WINDOW;
      }
    }
  }
  return kinks;
};

const hiddenEvents = (frames, key) => {
  const events = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (let e = 0; e < count; e++) {
    const hits = frames.flatMap((f, frame) => {
      const el = f.els[e];
      return el?.shown && el.onScreen && el[key] > HIDDEN_RATIO
        ? [{ frame, ratio: el[key], by: el[`${key}By`] }]
        : [];
    });
    if (hits.length === 0) continue;
    const worst = hits.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    events.push({
      element: e,
      name: frames[hits[0].frame].els[e].name,
      key,
      by: hits[0].by,
      frame: hits[0].frame,
      t: Math.round(frames[hits[0].frame].t),
      ratio: worst.ratio,
    });
  }
  return events;
};

const stretchWarnings = (frames) => {
  const warnings = [];
  const count = Math.max(0, ...frames.map((f) => f.els.length));
  for (let e = 0; e < count; e++) {
    const frame = frames.findIndex((f) => {
      const el = f.els[e];
      return el?.shown && el.onScreen && el.text && el.stretch > STRETCH_LIMIT;
    });
    if (frame < 0) continue;
    const el = frames[frame].els[e];
    warnings.push(
      `${el.name} text scaled non-uniformly at frame ${frame} (x/y ${el.stretch}): the text is distorted`,
    );
  }
  return warnings;
};

const frameBox = (box, scale, size) => {
  const left = Math.max(0, Math.round(box.left * scale));
  const top = Math.max(0, Math.round(box.top * scale));
  const width = Math.min(
    size.width - left,
    Math.round((box.left + box.width) * scale) - left,
  );
  const height = Math.min(
    size.height - top,
    Math.round((box.top + box.height) * scale) - top,
  );
  return width > 2 && height > 2 ? { left, top, width, height } : null;
};

const crop = (buffer, box) => sharp(buffer).extract(box);

const toSample = (buffer, box) =>
  crop(buffer, box)
    .resize(SAMPLE, SAMPLE, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

const nearestDomFrame = (frames, epochMs) => {
  let best = frames[0];
  for (const frame of frames) {
    if (Math.abs(frame.epoch - epochMs) < Math.abs(best.epoch - epochMs))
      best = frame;
  }
  return best;
};

const diff = (a, b) => {
  let changed = 0;
  for (let i = 0; i < a.length; i++)
    if (Math.abs(a[i] - b[i]) > PIXEL_DELTA) changed++;
  return (changed / a.length) * 100;
};

const pixelBlinks = (samples) => {
  const blinks = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const base = samples[i - 1];
    for (
      let k = i + 1;
      k <= Math.min(i + MAX_BLINK_FRAMES, samples.length - 1);
      k++
    ) {
      const away = Math.min(...samples.slice(i, k).map((s) => diff(base, s)));
      const back = diff(base, samples[k]);
      if (away > threshold && back < away * RETURN_RATIO) {
        blinks.push({
          frame: i,
          frames: k - i,
          away: Number(away.toFixed(1)),
          back: Number(back.toFixed(1)),
        });
        i = k;
        break;
      }
    }
  }
  return blinks;
};

const nameAt = (frames, e) =>
  frames.find((f) => f.els[e])?.els[e].name ?? `element ${e}`;

const failuresOf = (report, frames) => {
  const failures = [];
  for (const b of report.dom.blinks)
    failures.push(
      `${nameAt(frames, b.element)} blinks at frame ${b.frame} (${b.frames} frames, dom)`,
    );
  for (const j of report.dom.jumps)
    failures.push(
      `${nameAt(frames, j.element)} jumps at frame ${j.frame} (${j.key} step ${j.step}, typical ${j.typical})`,
    );
  for (const p of report.props)
    for (const problem of p.problems)
      failures.push(`${nameAt(frames, p.element)} ${problem}`);
  if (report.range?.problem) failures.push(report.range.problem);
  for (const t of report.trajectory ?? [])
    if (t.problem) failures.push(t.problem);
  for (const k of report.dom.kinks)
    failures.push(
      `${nameAt(frames, k.element)} kinks at frame ${k.frame} (${k.key} step ${k.before}px → ${k.after}px per frame)`,
    );
  for (const c of report.dom.clips)
    failures.push(
      `${c.name} clipped by ${c.by}: ${Math.round(c.ratio * 100)}% hidden at frame ${c.frame}`,
    );
  for (const o of report.dom.occlusions)
    failures.push(
      `${o.name} occluded by ${o.by}: ${Math.round(o.ratio * 100)}% hidden at frame ${o.frame}`,
    );
  for (const b of report.pixels?.blinks ?? [])
    failures.push(
      `${nameAt(frames, b.element)} blinks at frame ${b.frame} (${b.frames} frames, pixels)`,
    );
  return failures;
};

mkdirSync(outDir, { recursive: true });
await holdRunSlot("motion-probe");
const browser = await launchBrowser(flags.engine);
const report = {
  ok: true,
  target,
  engine: flags.engine,
  viewport: flags.device ?? flags.viewport,
  threshold,
};

try {
  const context = await browser.newContext({
    ...contextOptions(flags),
    baseURL: meta.url,
    reducedMotion: flags.motion ? "no-preference" : "reduce",
  });
  const page = await context.newPage();
  for (const step of steps.slice(0, recordAt))
    await runBrowserStep(page, step.sub, step.rest, meta);

  const shots = [];
  let cdp = null;
  if (flags.engine === "chromium") {
    cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      shots.push({
        buffer: Buffer.from(data, "base64"),
        t: metadata.timestamp,
        deviceWidth: metadata.deviceWidth,
      });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    const { width, height } = page.viewportSize();
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 85,
      everyNthFrame: 1,
      maxWidth: width * 2,
      maxHeight: height * 2,
    });
  }

  const range = track ? await page.evaluate(trackRange, track) : null;
  await page.evaluate(startDomSampler, {
    selector: target,
    props,
    compare: compare ?? null,
  });
  const toggles = new Map();
  for (const step of steps.slice(recordAt + 1)) {
    if (step.sub === "click") {
      const key = step.rest.join(" ");
      const { locator } = targetLocator(page, step.rest);
      if (!toggles.has(key))
        toggles.set(key, { locator, before: await toggleState(locator) });
    }
    await runBrowserStep(page, step.sub, step.rest, meta);
  }
  await page.waitForTimeout(400);
  const frames = await page.evaluate(() => {
    window.__motionProbe.running = false;
    return window.__motionProbe.frames;
  });
  const unclosed = [];
  for (const [key, { locator, before }] of toggles) {
    if (before === null) continue;
    const after = await toggleState(locator);
    if (after !== null && after !== before) unclosed.push(key);
  }
  if (unclosed.length > 0) {
    await browser.close();
    console.error(
      `motion-probe: toggle scenario incomplete: click ${unclosed.join(", ")} opened without closing. Add a closing click or \`press --key Escape\` after it`,
    );
    process.exit(2);
  }
  if (cdp) await cdp.send("Page.stopScreencast");

  report.dom = {
    frames: frames.length,
    blinks: domBlinks(frames),
    jumps: domJumps(frames),
    kinks: domKinks(frames),
    clips: hiddenEvents(frames, "clipped"),
    occlusions: hiddenEvents(frames, "occluded"),
  };
  report.props = propChecks(frames, props, expected);
  if (track) report.range = rangeOf(frames, track, range);
  if (compare) report.trajectory = trajectoryChecks(frames, compare);
  report.warnings = stretchWarnings(frames);

  if (shots.length > 2 && frames.length > 0) {
    const size = await sharp(shots[0].buffer).metadata();
    const scale = size.width / shots[0].deviceWidth;
    const ms = (i) => ((shots[i].t - shots[0].t) * 1000).toFixed(0);
    const domAt = shots.map((s) => nearestDomFrame(frames, s.t * 1000));
    const watched = [
      ...new Set(
        frames.flatMap((f) =>
          f.els.flatMap((el, e) => (el.shown && el.onScreen ? [e] : [])),
        ),
      ),
    ];

    const blinks = [];
    const evidence = [];
    const series = {};
    const seen = new Set();
    for (const e of watched) {
      const boxes = domAt.map(
        (d) => d.els[e] && frameBox(d.els[e], scale, size),
      );
      const runs = [];
      let run = [];
      shots.forEach((_, i) => {
        const same =
          run.length &&
          JSON.stringify(boxes[i]) === JSON.stringify(boxes[run[0]]);
        if (boxes[i] && (same || !run.length)) run.push(i);
        else {
          if (run.length >= 3) runs.push(run);
          run = boxes[i] ? [i] : [];
        }
      });
      if (run.length >= 3) runs.push(run);
      series[e] = [];
      for (const usable of runs) {
        const samples = await Promise.all(
          usable.map((i) => toSample(shots[i].buffer, boxes[i])),
        );
        series[e].push(
          ...samples
            .slice(1)
            .map((s, i) => [
              usable[i + 1],
              Number(diff(samples[i], s).toFixed(1)),
            ]),
        );
        for (const b of pixelBlinks(samples)) {
          const key = usable[b.frame];
          if (seen.has(key)) continue;
          seen.add(key);
          const frameIdx = usable.slice(b.frame - 1, b.frame + b.frames + 1);
          blinks.push({
            element: e,
            frame: usable[b.frame],
            frames: b.frames,
            away: b.away,
            back: b.back,
            t: Number(ms(usable[b.frame])),
          });
          evidence.push(...frameIdx.map((i) => ({ i, box: boxes[i], e })));
        }
      }
    }
    report.pixels = {
      frames: shots.length,
      clock: {
        firstShotMs: Math.round(shots[0].t * 1000),
        firstDomMs: Math.round(frames[0].epoch),
        scale,
      },
      watchedElements: watched,
      blinks,
      series,
    };

    const panels = evidence.length
      ? await Promise.all(
          evidence
            .slice(0, 30)
            .map(async ({ i, box, e }) => ({
              label: `el${e} #${i} ${ms(i)}ms`,
              buffer: await crop(shots[i].buffer, box).png().toBuffer(),
            })),
        )
      : await Promise.all(
          Array.from({ length: 8 }, (_, j) =>
            Math.round((j * (shots.length - 1)) / 7),
          ).map(async (i) => ({
            label: `#${i} ${ms(i)}ms`,
            buffer: shots[i].buffer,
          })),
        );
    const columns = evidence.length
      ? Math.max(...blinks.map((b) => b.frames + 2))
      : 4;
    report.sheet = (
      await composeSheet(panels, {
        out: join(outDir, "sheet.png"),
        height: 200,
        columns,
      })
    ).out;
  } else if (cdp) {
    report.pixels = {
      frames: shots.length,
      blinks: [],
      note: "fewer than 3 frames changed: nothing moved in the region",
    };
  }

  report.failures = failuresOf(report, frames);
  report.ok = report.failures.length === 0;
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  const origin = recordableOrigin(meta.url);
  if (origin) {
    recordEntry({
      kind: "motion-probe",
      origin,
      route: new URL(page.url()).pathname,
      viewport: page.viewportSize().width,
      target,
      steps: steps.map((step) => [step.sub, ...step.rest].join(" ")),
      motion: flags.motion,
      rangeRatio: track ? report.range.ratio : null,
      verdict: report.ok ? "pass" : "fail",
      artifacts: [join(outDir, "report.json"), ...(report.sheet ? [report.sheet] : [])],
    });
  }
} finally {
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      failures: report.failures,
      warnings: report.warnings,
      domFrames: report.dom?.frames,
      domBlinks: report.dom?.blinks.length,
      domJumps: report.dom?.jumps,
      pixelFrames: report.pixels?.frames,
      pixelBlinks: report.pixels?.blinks,
      sheet: report.sheet,
      report: join(outDir, "report.json"),
    },
    null,
    2,
  ),
);
process.exit(report.ok ? 0 : 1);
