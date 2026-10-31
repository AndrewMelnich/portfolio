# Reflow patterns

Read from `SKILL.md` after clustering. Each case: Figma boxes → mechanism → CSS intent. Numbers illustrate; real values come from the frame.

## Vertical stack

Parent 600×280. Children (localized):

| Node | x' | y' | w | h |
| --- | --- | --- | --- | --- |
| title | 40 | 40 | 400 | 48 |
| body | 40 | 104 | 520 | 72 |
| button | 40 | 200 | 160 | 48 |

Gaps: 104−88 = 16, 200−176 = 24. Shared left 40, top 40, bottom 32, right 40.

```scss
// parent: flex column, padding 40px 40px 32px, gap 16px
// button: margin-top 8px  (the one uneven gap)
// title/body: no left margin; parent padding owns the inset
// no height on title/body (TEXT)
```

## Icon + label (one pack)

| Node | x' | y' | w | h |
| --- | --- | --- | --- | --- |
| icon | 0 | 4 | 24 | 24 |
| label | 32 | 0 | 80 | 32 |

One band, one pack. Gap 8. Icon centerY = 16, label centerY = 16 → `align-items: center`. Row hug width: `inline-flex; gap: 8px`.

## Split pack (header)

Parent inner 1360. Logo `x'=0 w=120`. Nav `x'=960 w=400`. Hole 840 ≫ 0 → two packs, not a 840px gap.

```scss
.header {
  display: flex;
  align-items: center;
}

.header__nav {
  margin-inline-start: auto;
}
```

`justify-content: space-between` only when these two are the sole flex children. Extra items (CTA after nav) stay in the right pack.

## Card row

Three 320×200 cards at x' 0, 344, 688 → gap 24, same y'. Repeating item → one component, parent `display: flex; gap: 24px` (or local grid with `gap: 24px` if a second row exists and columns line up).

Card width: if three equal tracks fill the parent inner width, `flex: 1` / `1fr`, not three copies of `width: 320px` that overflow on tablet. Snap to the page column mixins only when the **figma-design-to-code** grid test hits.

## Badge overlay

Card 320×200. Badge 48×24 at `x'=284 y'=-8` (hangs off the top-right). Overlap with the card, not a next band.

```scss
.card {
  position: relative;
}

.card__badge {
  position: absolute;
  top: -8px;
  right: -12px; // parent.w - x' - w
}
```

Pin with constraints (RIGHT+TOP → `top`/`right`). Card content (image, title) stays flow inside the card.

## Decorative blob

Section children: VECTOR blob covering 40% of the section, plus a text stack with no overlap of the *text boxes*. Blob = overlay (`z-index` under content). Text stack = column flex. Section `position: relative`. Blob does not get `left/top` copies that then force the text to absolute as well.

Background rectangle = parent `background-image` / `background-color`, not a positioned `<img>` unless it is content (photo in a figure).

## Avatar stack (designed overlap)

Circles 40×40 at x' 0, 28, 56 (overlap 12). One band, one pack, negative gap.

```scss
.avatars {
  display: flex;
}

.avatars__item:not(:first-child) {
  margin-inline-start: -12px;
}
```

## Fake group

A `GROUP` named “text” wraps title+subtitle, no fill. Parent is already a column of (group, button). Hoist: parent children become title, subtitle, button. Gaps measured on the hoisted nodes. No extra DOM wrapper.

## Full-canvas stage (failure)

Frame 1440×900, every layer `position: absolute; top; left; width; height` matching x'/y'. That is the dump, not a layout. Restart at clustering; the section is almost always a column of bands inside the page container (`project.md`, Styles).
