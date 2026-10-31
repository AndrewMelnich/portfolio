# Domain Docs

How the engineering skills should consume this repo's **frontend** domain documentation when exploring the codebase.

This frontend is **one context**. Backend lives beside `frontend/` with its own harness — do not read or write frontend glossary/ADRs for backend work.

## Before exploring, read these

- **`frontend/GLOSSARY.md`**
- **`frontend/docs/adr/`**: read ADRs that touch the area you're about to work in

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily **here** (`frontend/GLOSSARY.md`, `frontend/docs/adr/`) when terms or decisions actually get resolved. Do not create `GLOSSARY.md` at the repo root.

## File structure

```
/
├── frontend/
│   ├── GLOSSARY.md
│   ├── AGENTS.md
│   ├── CODING_STANDARDS.md
│   ├── docs/
│   │   ├── adr/
│   │   └── agents/
│   └── src/
└── backend/          ← own harness, not this context
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (…), but worth reopening because…_
