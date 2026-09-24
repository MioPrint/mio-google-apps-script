# Domain Docs

How the engineering skills should consume this repo's domain documentation
when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root, to find which contexts exist.
- **`CONTEXT.md`** for the root context, and for any App you're about to
  touch.
- **`docs/adr/`** at the repo root (system-wide decisions) and inside the
  App you're about to touch (App-specific decisions). Read ADRs that touch
  the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their
absence; don't suggest creating them upfront. The `/domain-modeling` skill
(reached via `/grill-with-docs` and `/improve-codebase-architecture`)
creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context repo:

```
/
├── CONTEXT-MAP.md
├── CONTEXT.md              # root context: App and other repo-wide terms
├── docs/adr/                # system-wide decisions
│   ├── 0001-plain-js-jsdoc-no-build.md
│   └── 0002-shared-vm-test-harness.md
└── <app>/
    ├── CONTEXT.md           # created lazily, per App
    └── docs/adr/            # created lazily, per App
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in the
relevant `CONTEXT.md` — root or the App's own. Don't drift to synonyms the
glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either
you're inventing language the project doesn't use (reconsider) or there's a
real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR — root or App-level — surface it
explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening
> because…_
