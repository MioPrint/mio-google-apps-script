# Drive Downloader

## Purpose

Mirrors one Google Drive folder (the Source Folder), with its sub-folders
and Shortcuts, into a folder on the local disk, one file at a time, in
desktop Chrome. Built for up to 1000 files and single files of 20 GB+;
nothing is zipped. Native Files (Docs, Sheets, Slides) are exported to
.docx/.xlsx/.pptx. Existing local files are skipped unless the user chooses
to overwrite them; nothing is ever deleted.

The App's URL opens the Launcher Page, whose button opens the Disk Window
that holds the whole App (the folder picker only works there). GAS reads
the Tree and hands the browser an OAuth token; the browser streams each
file straight from the Drive API and writes it to disk. Domain terms:
`CONTEXT.md`.

## Script & deployment

- clasp rootDir: `src`
- Not yet bound to a GAS project. From this folder, run
  `clasp create --type webapp --rootDir src` to bind it, then check that
  `src/appsscript.json` wasn't overwritten by the create step.
- Manifest: Europe/Berlin, V8 runtime, Stackdriver exception logging, web
  app executes as the deploying user, access restricted to the deployer.

## Services & scopes

- `HtmlService` — serves `frontend/index` via `doGet`.
- Advanced Drive service (v3) — reads the Tree, one `files.list` per
  folder.
- `UrlFetchApp` — Drive REST calls that need the
  `X-Goog-Drive-Resource-Keys` header (public-by-link folders).
- `ScriptApp.getOAuthToken()` — token the browser uses for the Drive API.
- OAuth scopes (v1, least privilege):
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/script.external_request`
- Expect a one-time "unverified app" consent screen.
