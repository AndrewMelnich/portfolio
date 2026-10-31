# Slot and implementer sizing

Reference for the defaults of two caps. `FSTACK_MAX_HEAVY`: how many heavy processes (a Chromium run or a build) one machine runs at once; a slot is held only for that run, never for a server's lifetime. `FSTACK_MAX_IMPLEMENTERS`: how many Section implementers a page fan-out runs at once; it takes no slot. `scripts/slots.mjs` holds the constants; `control --help` prints both caps now and on a 16 GB machine (`Slots now:` and `Implementer cap now:`). Re-measure with `scripts/measure-rss.mjs` when the project's page weight, Astro or Playwright changes, then change the constants below and the table together.

## Default

```
GIB_PER_SLOT = SLOT_PEAK_GIB / SLOT_RAM_SHARE = 2.2 / 0.5 = 4.4
cap          = max(1, floor(RAM_GiB / GIB_PER_SLOT))
```

| RAM | cap |
| --- | --- |
| 8 GB | 1 |
| 16 GB | 3 |
| 32 GB | 7 |

- `SLOT_PEAK_GIB = 2.2`: peak RSS of the largest heavy unit, one batch `layout-proof --dir` over five widths (1.6 GB, two runs: 1570 and 1593 MB) plus the dev server it proves against (0.55 GB, two runs: 553 and 573 MB), rounded up. A build (0.8 to 0.9 GB) is smaller, so a slot sized for the proof also covers a build.
- `SLOT_RAM_SHARE = 0.5`: the slots may use half of RAM; the other half is the OS, the IDE, the browser and the agents. It is a measured floor, not a guess: on the machine below, with no slot running, Cursor held 3.6 GB, Chrome 3.5 GB, system processes 3.8 GB and two Claude sessions 0.8 GB of RSS, and swap was 14 of 15 GB full. A share above 0.5 pushes that machine further into swap.
- The 5 GB per slot used before this measurement had no recorded basis. The measured slot is 2.2 GB, so the same share of RAM admits 7 slots on 32 GB instead of 6. The cap on 16 GB stays 3: the share, not the slot size, is what binds there.
- `FSTACK_MAX_HEAVY=<n>` overrides the derived value, for a machine whose RAM is not shared with an IDE (a CI runner) or one that swaps.

## Implementer default

```
heavy_extra  = default heavy cap x (SLOT_PEAK_GIB - SLOT_DEV_GIB) = cap x (2.2 - 0.55)
implementers = clamp(floor((RAM_GiB x SLOT_RAM_SHARE - heavy_extra) / IMPLEMENTER_DEV_GIB), 1, IMPLEMENTER_MAX)
```

| RAM | heavy cap | heavy_extra | implementers |
| --- | --- | --- | --- |
| 8 GB | 1 | 1.65 GB | 5 |
| 16 GB | 3 | 4.95 GB | 6 |
| 32 GB | 7 | 11.55 GB | 9 |
| 64 GB | 14 | 23.1 GB | 12 (19 before the ceiling) |

- Why this shape: an implementer holds a dev server for the whole section, so N implementers cost N dev servers, and the heavy slots can all be busy at the same time. The half of RAM the slots may use (`SLOT_RAM_SHARE`) must cover both. A slot's peak of 2.2 GB already contains the dev server it proves against (0.55 GB), so only the 1.65 GB above it is added per heavy slot; the dev servers are counted once, in N.
- `IMPLEMENTER_DEV_GIB = 0.45`: the steady cost of an idle-serving dev server, from the three-server run below (1223 and 1275 MB for three, 0.41 GB each), rounded up. The 0.55 GB first-render peak is not used here because the N servers do not render for the first time together; it is `SLOT_DEV_GIB`, the dev-server share inside one slot's peak.
- `IMPLEMENTER_MAX = 12`: a ceiling, not a measurement. One page fan-out had eleven sections (#52); more implementers than ready sections gain nothing, and each adds Figma MCP calls and orchestrator context.
- The heavy term uses the default heavy cap, not `FSTACK_MAX_HEAVY`, so overriding one cap never moves the other. A machine that raises `FSTACK_MAX_HEAVY` should lower `FSTACK_MAX_IMPLEMENTERS` by hand if it swaps.
- On the 16 GB machine the old rule (one slot per dev server, 3 in all) ran about 2.5 sections at once with ten ready. The new default is 6; Chromium and builds still queue behind 3 slots.
- Not measured: `pnpm pc`, tsc and eslint runs of an implementer (outside any slot), the agent processes themselves, and a Storybook server. Re-measure with N servers plus a proof batch before raising `IMPLEMENTER_DEV_GIB` or the ceiling.
- `FSTACK_MAX_IMPLEMENTERS=<n>` overrides the derived value.

## Measurements

Peak RSS summed over the process tree (descendants plus the root's process group), `ps` sampled every 200 ms. Project page route `/projects/demo/` from the project-page assembly branch (`front/feature-project_page`, 11 sections), `FSTACK_MAX_HEAVY=9` and a private `FSTACK_SLOTS_DIR` so the measurement never queued. Two runs each.

| Process kind | Peak RSS, run 1 | Run 2 | Processes | Dominant process |
| --- | --- | --- | --- | --- |
| One `control up dev`, idle and serving the project page | 531 MB | 493 MB | 5 | `astro dev` node, 430 MB |
| Three `control up dev` at once | 1223 MB | 1275 MB | 15 | three `astro dev` nodes, 320 to 330 MB each |
| One batch `layout-proof --dir`, five widths | 1570 MB | 1593 MB | 10 | layout-proof node 211 MB, a Chromium renderer 200 MB each |
| One `control launch` build (`astro build`) | 776 MB | 903 MB | 6 | `astro build` node, 615 MB |

Footprint (`footprint -p`, includes compressed and swapped pages) for the same runs: dev 593 to 600 MB, three dev 1.7 to 1.8 GB, layout-proof 1.2 GB current and 1.4 to 1.5 GB summed peak, build 0.8 to 0.9 GB.

Machine: Apple M1 Pro, 10 cores, 16 GB RAM, macOS 26.6 (Darwin 25.6), Node 24.22, Playwright Chromium 1248 (headless). The measuring session ran inside the user's normal desktop: Cursor, Chrome, two Claude sessions and sibling worktrees running vitest, eslint, `astro preview` and Playwright Chromium. The sampler recorded other build or test processes outside the measured tree at up to 1.4 to 1.9 GB RSS during the runs; peaks of the measured trees do not include them.

### Commands

```bash
CTRL="node .agents/skills/verify-ui/scripts/control.mjs"
export FSTACK_MAX_HEAVY=9 FSTACK_SLOTS_DIR=$(mktemp -d) FSTACK_ARTIFACTS_DIR=$(mktemp -d) FSTACK_DEV_PORT=5111
$CTRL up dev --path /projects/demo/
node .agents/skills/verify-ui/scripts/measure-rss.mjs --pid "$(cat "$FSTACK_ARTIFACTS_DIR/servers/dev.pid")" --for 20
VERIFY_BASE_URL=http://127.0.0.1:5111 node .agents/skills/verify-ui/scripts/measure-rss.mjs -- \
  node .agents/skills/verify-ui/scripts/layout-proof.mjs --dir <folder with five w<width>/proof.json>
node .agents/skills/verify-ui/scripts/measure-rss.mjs -- $CTRL launch
$CTRL down dev && $CTRL cleanup
```

Three servers at once: repeat the `up dev` line with three `FSTACK_ARTIFACTS_DIR` / `FSTACK_DEV_PORT` pairs and sample all three pids together (`--pid` repeats). The three share one checkout and one `node_modules/.vite`, where three worktrees would each have their own.

The five manifests carry `figmaFile` with a synthetic frame per width (375, 768, 1199, 1440, 1920; two children `Main` and `Footer` mapped to `main` and `footer`), so no Figma token or network is needed. Every width loaded the route and measured; each manifest ended in a measured FAIL (the synthetic frame is not the design). A measured FAIL still ran Chromium through load, overflow and measurement, which is the memory cost; a setup FAIL would have stopped before it. `--check-manifest` on the same folder exits 0 for all five.

## What the numbers measure

- Why a dev server is small: the whole `astro dev` tree is one Vite node process (about 330 to 430 MB after the first render of the route) plus pnpm wrappers (about 50 MB). Chromium is not part of it. Idle servers cost about 0.4 GB each, a tenth of the 5 GB they were budgeted.
- Why the batch proof is the largest unit: layout-proof is one Chromium for all five manifests (10 processes at the peak, each Chromium process 130 to 210 MB) and its own node process; Chromium shares memory pages between its processes, so summed RSS reads high: footprint is 1.2 GB against 1.6 GB RSS.
- Why a build is smaller than the proof: `astro build` on this project runs one node process for about 6 s; its peak is the Vite and Rollup graph of a small site. A larger site would raise it. Re-measure after the page count grows.
- RSS of an idle dev server falls from about 530 MB to about 130 MB within 10 s of the last request, while its footprint stays near 590 MB. The machine was under memory pressure (swap 14 of 15 GB used), so macOS compressed the idle pages. Read the peak, not the idle tail; idle RSS under pressure understates what the server needs when it wakes.
- Noise: the runs were not on a quiet machine. The two runs of each kind agree within 7 percent (dev), 4 percent (three dev), 2 percent (proof) and 16 percent (build); the build spread is the widest because the interval is 200 ms and the build lasts 5 to 6 s. Under swap pressure, RSS can understate; the footprint column shows the direction (higher for dev, lower for Chromium) and neither changes the 2.2 GB choice, since the largest unit is covered by either column.
- Not measured: motion-probe, visual-compare and token-check Chromium runs (one context each, expected below the five-width batch), a Storybook server, and `visual-judge`.
