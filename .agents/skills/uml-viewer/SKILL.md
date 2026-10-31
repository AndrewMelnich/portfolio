---
name: uml-viewer
description: >
  Live UML viewer of the codebase (FSD layers, Laravel namespaces, HTTP arrows between them, dependency-rule violations, drill-down to source) coupled to the agent through a mailbox.
  Use when the user asks to show/review codebase structure or architecture, "UML", "покажи структуру", review an MR/diff structurally, process the viewer inbox, or build an architecture proposal (what-if regrouping) before moving code.
---

# UML viewer

Port of [unclebob/uml-viewer](https://github.com/unclebob/uml-viewer) to Astro + TS + FSD. The user looks at the diagram, points at what they dislike, the agent changes a **proposal** or the code, the diagram redraws itself.

Code: `frontend/scripts/uml-viewer/` (`uml-viewer.mjs` scanner + server, `viewer.html`). Policy: `frontend/uml-viewer.policy.json`. Mailbox: `frontend/.uml-viewer/` (gitignored).

## Model

- **Diagram** = the directory tree of each source. Every path segment is a nesting level; double-click drills in. A file is a leaf with a card (exports, deps, used-by, source). Leaf/dir titles show a small extension badge (TS / Astro / SCSS / folder…), same idea as the editor SCM list. Non-code files under scanned dirs (scss, yml, md, svg, …) are structure-only leaves — visible, openable, in diff, never on import edges; on the diagram they sit in a vertical column to the right of the dependency graph. Gitignored paths (e.g. `*.figma.mcp.yml`) are skipped. Binary assets show in the tree; the card says `⟨ binary file ⟩`. Two sources (`frontend` + `backend`) stack as two root boxes; a dotted arrow is an HTTP call matched to a Laravel route.
- **Rank** comes from that source's `levels`, inner first (`shared` = 0). Inside one rank, siblings order topologically: dependencies sit below dependents.
- **Violation** (red): an import from a lower-rank module to a higher-rank one, a cross-slice import inside an `isolated` layer, or a frontend call with no matching route. Authoritative check for the frontend stays `pnpm lint:fsd` (steiger); the viewer is the picture.
- **Diff** (`pnpm uml --diff <ref>`) compares the working tree to the merge-base with that ref. New modules and arrows are green; a box is green only if every module inside is new — a pre-existing dir with new/changed files is yellow. Removed ones keep a muted fill and a red dashed border; with «Только изменения» on, untouched boxes are muted grey. «Только изменения» also hides the rest and keeps their neighbours. A violation that did not exist at the base is the thing to look at first. An untracked new file has no `git diff` against the base; the card shows the whole file as additions.
- **Metrics** per box: Ca / Ce, instability I, abstractness A (interface/abstract share), distance from the main sequence D. «Цвет» toggles fill between violations and D.
- **Proposal** = named regrouping of existing paths, drawn with a PROPOSAL banner. Not in the code. A source whose `root` does not exist is skipped, so the same policy works before `backend/` appears.

## Steps

1. **Start.** `curl -s 127.0.0.1:4815/api/state` answers → already running (restart it if the user wants another `--diff` ref). Otherwise run `pnpm uml --open` in `frontend/` as a background shell and wait for the `[uml] … →` line. For an MR add `--diff <target-branch>`. The viewer rescans on every change in a scanned dir or the policy; no restart after edits.
2. **Read the structure** from `frontend/.uml-viewer/ir.json` (`modules[]` with `ops` and `diff`, `edges[] {from,to,type,kind,violation,diff,labels}`, `foreign[]`) instead of re-grepping imports. With one source, ids are paths inside it; with two, they start with the source id (`frontend/…`, `backend/…`). `kind: "http"` is a frontend call. For a written review, `pnpm uml --summary --diff <ref>` prints the structural diff as Markdown.
3. **Point the user** at what you are talking about: `pnpm uml --show <path> [--diagram <proposal-id>] [--select <child-name>]`, e.g. `pnpm uml --show shared/lib --select dom`. Root is `--show ''`. With both sources the path starts at `frontend` or `backend`.
4. **Inbox.** When the user says the viewer has notes (or `/api/state` reports `inbox > 0`): read `frontend/.uml-viewer/to-agent.json` (`{nextId, queue:[{id, text, context:{diagram, path, selected, modules}}]}`), handle the oldest note, pop it from `queue` and rewrite the file; repeat until empty. `context` says which diagram, level and box the note is about; stay on that diagram until a later note names another.
5. **Proposal loop.** Asked "what if" / "предложи группировку" → add a proposal to `proposals` in the policy, `--show` it, iterate on user notes. Code moves only after the user approves the proposal; then make the code match, run `pnpm lint:fsd` and `pnpm tsc`, and `--show` the real diagram. Done = real diagram matches the approved proposal and lint is green.

## Policy

```json
{
  "sources": [
    {
      "id": "frontend",
      "lang": "ts",
      "root": ".",
      "dirs": ["src"],
      "strip": "src",
      "levels": [["shared"], ["_pages"], ["app"]],
      "isolated": ["entities"]
    },
    {
      "id": "backend",
      "lang": "php",
      "root": "../backend",
      "dirs": ["app", "routes"],
      "strip": "app",
      "levels": [["Models"], ["Http"]]
    }
  ],
  "omit": [],
  "proposals": [
    {
      "id": "ui-kit",
      "name": "2026-10-03 13:00 UI kit apart",
      "groups": [
        {
          "id": "core",
          "label": "Core",
          "members": [
            "shared/lib",
            "shared/config",
            "shared/model",
            "shared/api"
          ]
        },
        { "id": "kit", "label": "UI kit", "members": ["shared/ui"] }
      ],
      "omit": []
    }
  ]
}
```

- `levels` is per source, inner first. Frontend keeps the FSD order; backend lists namespace roots (`app/` stripped). Edit a source's `levels` only when its layer set changes.
- `lang` is `ts` (TS, TSX, JS, Astro; `@/` aliases from that root's tsconfig) or `php` (namespace, `use`, `Route::` in `routes/`). A `ts` module calling `/v1/…` links to the controller of the matching route.
- The real `levels` lists live in `frontend/uml-viewer.policy.json`; the block above is the shape.
- `groups` are inner first: group 0 is the lowest rank. `members` are existing path prefixes (dir or file); unmatched modules land in `(unassigned)`.
- Proposals stay in the policy until the user asks to drop them. Default `name` is a timestamp plus a short gist.
- `omit` hides path prefixes from every diagram (generated code, vendored stuff). Tests, stories, `*Story.astro`, `*.d.ts` are already skipped by the scanner.
