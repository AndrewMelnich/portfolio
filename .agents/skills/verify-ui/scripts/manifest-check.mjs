const MIN_HINT = 3;
const SHOWN = 5;

export function describeElements(elements, { filter, prefixes, key }) {
  const SCANNED = 200;
  const SKIPPED = new Set(["HTML", "HEAD", "SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "TEMPLATE"]);
  const norm = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = [];
  for (const element of elements) {
    if (SKIPPED.has(element.tagName) || element.closest("head")) {
      continue;
    }
    const classes = [...element.classList];
    const byPrefix = classes.some((name) => prefixes.some((prefix) => name.startsWith(prefix)));
    const byName = key !== null && classes.some((name) => norm(name).includes(key));
    if (filter && !byPrefix && !byName) {
      continue;
    }
    found.push({
      tag: element.tagName.toLowerCase(),
      classes,
      byPrefix,
      byName,
      unique: classes.find((name) => document.getElementsByClassName(name).length === 1) ?? null,
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
    });
    if (found.length >= SCANNED) {
      break;
    }
  }
  return found;
}

export function selectorHints(selector, figmaName) {
  const classes = [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
  const prefixes = [
    ...new Set(classes.map((name) => name.split(/__|--/)[0]).filter((prefix) => prefix.length >= MIN_HINT)),
  ];
  const slug = (figmaName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return { classes, prefixes, key: slug.length >= MIN_HINT ? slug : null };
}

export function manifestSelectors({ seams, origins, driven }) {
  const refs = [];
  for (const seam of seams) {
    const seamName = seam.name ?? `${seam.prev.selector} → ${seam.next.selector}`;
    refs.push({ ...seam.prev, role: `seam "${seamName}" prev`, one: true });
    refs.push({ ...seam.next, role: `seam "${seamName}" next`, one: true });
  }
  for (const origin of origins) {
    refs.push({
      selector: origin.selector,
      nodeId: origin.nodeId,
      role: `origin "${origin.name ?? origin.selector}"`,
      one: true,
    });
  }
  if (driven.hover) {
    refs.push({ selector: driven.hover, role: "state.hover", one: false });
  }
  if (driven.scroll) {
    refs.push({ selector: driven.scroll.selector, role: "state.scroll", one: false });
  }
  const seen = new Set();
  return refs.filter((ref) => {
    const id = `${ref.selector}\n${ref.role}\n${ref.nodeId ?? ""}`;
    return seen.has(id) ? false : seen.add(id);
  });
}

function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

function closeness(item, wanted) {
  const distances = item.classes.flatMap((name) => wanted.map((other) => editDistance(name, other)));
  return distances.length > 0 ? Math.min(...distances) : Number.POSITIVE_INFINITY;
}

export function rankCandidates(items, wanted) {
  return items
    .map((item) => ({ item, distance: closeness(item, wanted) }))
    .sort(
      (a, b) =>
        Number(b.item.byName) - Number(a.item.byName) ||
        Number(b.item.byPrefix) - Number(a.item.byPrefix) ||
        a.distance - b.distance,
    )
    .slice(0, SHOWN)
    .map(({ item }) => item);
}

function candidateLine(item, hints, figmaName) {
  const target = item.unique
    ? `.${item.unique}`
    : item.classes.length > 0
      ? `${item.tag}.${item.classes.join(".")} (no unique class)`
      : `<${item.tag}> (no class)`;
  const why = [
    ...(item.byName ? [`Figma name "${figmaName}"`] : []),
    ...(item.byPrefix ? [`class prefix ${hints.prefixes.join("|")}`] : []),
  ];
  const text = item.text ? ` "${item.text}"` : "";
  return `    ${target}  <${item.tag}>${text}${why.length > 0 ? `  [${why.join("; ")}]` : ""}`;
}

export function selectorReport({ ref, count, items, figmaName }) {
  const subject = ref.nodeId
    ? `${ref.role}, Figma node ${ref.nodeId}${figmaName ? ` "${figmaName}"` : ""}`
    : ref.role;
  const head = `selector ${ref.selector} matched ${count} elements (${subject})`;
  const hints = selectorHints(ref.selector, figmaName);
  const ranked = rankCandidates(items, hints.classes);
  if (ranked.length === 0) {
    const looked = [
      ...(hints.prefixes.length > 0 ? [`class prefix ${hints.prefixes.join("|")}`] : []),
      ...(hints.key ? [`Figma name "${figmaName}"`] : []),
    ];
    return [
      head,
      `  no candidates${looked.length > 0 ? `: no element matches ${looked.join(" or ")}` : ": the selector has no class and the node has no usable name"}`,
    ];
  }
  return [
    head,
    count === 0 ? "  closest DOM candidates:" : "  matches (narrow the selector to one of them):",
    ...ranked.map((item) => candidateLine(item, hints, figmaName)),
  ];
}
