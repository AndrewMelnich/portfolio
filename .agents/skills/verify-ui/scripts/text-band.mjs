const MIN_TRAILING = 2;
const TRAILING_RATIO = 0.01;
const ALIGN = { RIGHT: "right", CENTER: "center" };

export function textBandOf(figma) {
  return {
    align: ALIGN[figma.style?.textAlignHorizontal] ?? "left",
    trailing: Math.max(MIN_TRAILING, (figma.absoluteBoundingBox?.width ?? 0) * TRAILING_RATIO),
  };
}

export function textBoxChecks(band, eps, prefix, figma, live) {
  const edge = {
    left: { kind: "x", figma: figma.left, live: live.left },
    right: {
      kind: "right",
      figma: figma.left + figma.width,
      live: live.left + live.width,
    },
    center: {
      kind: "center",
      figma: figma.left + figma.width / 2,
      live: live.left + live.width / 2,
    },
  }[band.align];
  return [
    { kind: `${prefix}${edge.kind}`, figma: edge.figma, live: edge.live, eps },
    { kind: "width", figma: figma.width, live: live.width, eps: band.trailing },
  ];
}

export function textBandNote(label, band, eps) {
  return `- ${label}: align ${band.align}, lines exact, height ±${eps}px, leading edge ±${eps}px, trailing width ±${band.trailing.toFixed(1)}px`;
}
