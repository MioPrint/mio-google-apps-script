# %%APP_TITLE%%

## Purpose

TBD.

## Script & deployment

- clasp rootDir: `src`
- Not yet bound to a GAS project. From this folder, run
  `clasp create --type webapp --rootDir src` to bind it, then check that
  `src/appsscript.json` wasn't overwritten by the create step. The
  `.clasp.json` it writes stays local (gitignored; it holds the scriptId).
- Manifest: Europe/Berlin, V8 runtime, Stackdriver exception logging, web
  app executes as the deploying user, access restricted to the deployer.

## Services & scopes

- `HtmlService` — serves `frontend/index` via `doGet`.
- OAuth scopes: none yet.
