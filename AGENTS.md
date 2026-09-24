## Repo

Google Apps Script web apps managed with clasp. Each top-level folder is one
App: one Apps Script project. See `CONTEXT.md` for the App definition and
`CONTEXT-MAP.md` for where each App's domain docs live.

## App layout

```
<app>/
├── .clasp.json       # committed; rootDir points at src/
├── src/
│   ├── appsscript.json
│   ├── backend/*.js
│   └── frontend/*.html
├── test/*.test.js
├── README.md
└── tsconfig.json
```

Only `src/` is pushed by clasp — tests, docs and tooling never leak into GAS.

## GAS gotchas

- Every `.js` file under an App's `src/` shares one global scope at runtime,
  evaluated in file-push order — no modules, no `import`/`export`.
- V8 runtime: modern JS syntax works, but there is still no `require`.
- Executions time out at 6 minutes; chunk or trigger long-running work.
- Services (DriveApp, UrlFetchApp, etc.) are subject to daily quotas —
  budget calls accordingly.

## Commands

- `npm run check` — must pass before you call work done.
- `npm run new-app -- <name>` — scaffold a new App from `template/`.
- `npm run format` writes Prettier fixes; `format:check` only verifies.

## Testing

Use `loadApp(appNameOrPath, mocks?)` (`tools/load-app.js`) to run an App's
source the way GAS does: every file in one shared `vm` context, with mocked
GAS globals. See the smoke tests in `template/` and each App for the pattern.

## clasp

Never run clasp. Tell the user exactly what to run (`clasp push`,
`clasp create`, etc.) and let them run it.

## Before touching an App

Read that App's `README.md` first, and its `CONTEXT.md` if one exists.

## Agent skills

### Issue tracker

Local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Multi-context (`CONTEXT-MAP.md` + root `CONTEXT.md` + root `docs/adr/`;
per-App `CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.
