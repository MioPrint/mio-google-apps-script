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
- Manifest: Europe/Berlin, V8 runtime, Stackdriver exception logging, web
  app executes as the deploying user, access restricted to the deployer.

### Deploy steps (run these yourself; the agent never runs clasp)

1. If not yet bound to a GAS project, from this folder run
   `clasp create --type webapp --rootDir src`, then check that
   `src/appsscript.json` wasn't overwritten by the create step (restore it
   from git if it was — it carries the OAuth scopes and the Advanced Drive
   service).
2. In the Apps Script project's Cloud project, make sure the Google Drive
   API is enabled (Advanced Drive service calls fail otherwise).
3. `clasp push`.
4. Deploy a new version as a web app (Deploy > New deployment > Web app,
   or `clasp deploy`), executing as you and accessible only to you.
5. Open the deployment URL: it opens the Launcher Page.

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
