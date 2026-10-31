---
name: no-code-comments
description: >
  Write self-explaining JS/TS. Never add or keep explanatory comments,
  commented-out code, HACK notes, or workaround excuses.
  ALWAYS apply when writing, editing, reviewing, or generating
  .ts, .tsx, .js, .jsx, .mjs, .cjs.
  Do not edit *.sh or other non-JS/TS files. Never strip # in
  ${var#pattern}, ${var##pattern}, or ${#var} — that is a shell parameter
  expansion, not a comment.
  Exceptions: TODO/FIXME, license headers, compiler/linter/bundler directives
  with a reason, 'use client'/'use server', JSDoc on public exported APIs only
  if the signature cannot carry the contract, rare links to issues/specs for
  non-obvious constraints.
---

# Self-explaining code

JS/TS only (`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`). Leave `*.sh` and other non-JS/TS files untouched. Leave `${var#pattern}`, `${var##pattern}`, and `${#var}` whole — that `#` is a shell parameter expansion, not a comment.

Agents copy nearby patterns. A comment that excuses a hack becomes the next hack. Put intent in **names**, **extracted functions**, **types**, and **tests**.

## Default

Do not write comments. Do not keep comments you did not have to. Delete commented-out code.

Workarounds: **fix the cause**, or track the ceiling in an issue. Never document a temporary hack in source (`HACK`, `laziness:`, `ponytail:`, "temporary workaround").

When a comment is the only place a fact lives, **rename or extract** so the fact survives the deletion. Do not change behavior.

## Instead

| Tempted to write                       | Do this                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| What the next line does                | Delete. The line already says it.                                |
| Why this looks weird                   | Name the function/constant after the constraint.                 |
| Section headers (`// --- helpers ---`) | Split the file or use the existing function names.               |
| Commented-out code                     | Delete it. Git has history.                                      |
| `HACK` / temporary-workaround notes    | Fix now, or file an issue. Do not leave the excuse in source.    |
| `laziness:` / `ponytail:`              | Encode the shortcut in a name, or track the ceiling in an issue. |
| Narrating tests (`// eat 3 ahead`)     | Put the story in the `it('…')` title or the assertion.           |

## Allowed (only these)

1. **`TODO` / `FIXME`** — a remaining task or known defect. Keep existing ones. Do not convert them into HACK/workaround essays.
2. **License / copyright / SPDX** headers on a file that needs them.
3. **Directives and pragmas**, with a reason on the same line (or the next line for block form):
   - `eslint-disable[-next-line]` / `stylelint-disable[-next-line]` / `prettier-ignore`
   - `@ts-expect-error` (not `@ts-ignore`) with a reason
   - `'use client'` / `'use server'` / `'use strict'`
   - `/// <reference types="…" />` / `/// <reference lib="…" />`
   - `/* @__PURE__ */`, `/* glsl */` / other language tags on tagged templates
   - `/*! beasties:… */`, `webpackIgnore`, `vite-ignore`, `shellcheck`
   - Steiger/file-scoped `rules: 'off'` — reason on that disable, naming why a move is impossible
   - `fallow-ignore-next-line` — reason on that disable (complexity, unused member, …)
4. **JSDoc on public exported APIs** only when the signature cannot carry the contract (units, side effects, thrown errors). Not on internals, not restating the name.
5. **Rare link** to an external issue or spec when a non-obvious constraint cannot live in a name (`// https://github.com/org/repo/issues/123`). One URL. No essay.

If a disable has no reason, add the reason. Do not delete the directive.

## Review

A new comment that is not in the list above is a defect. So is a workaround whose only evidence is a `HACK` / "temporary" note.

Full rule (always loaded): `.cursor/rules/no-code-comments.mdc`.
