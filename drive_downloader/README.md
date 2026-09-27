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
   `clasp create --type webapp --title "drive_downloader" --rootDir src`.
   This overwrites `src/appsscript.json` with a default manifest — restore
   the tracked one with `git checkout -- src/appsscript.json` (it carries
   the OAuth scopes and the Advanced Drive service). The `.clasp.json` it
   writes stays local (gitignored; it holds the scriptId).
2. Open the project (`clasp open`) and, in the editor's Project Settings,
   enable "Show appsscript.json manifest file in editor" — `clasp push`
   needs this on before it will push the manifest.
3. In the Apps Script project's Cloud project, make sure the Google Drive
   API is enabled (Advanced Drive service calls fail otherwise).
4. `clasp push`.
5. Deploy a new version as a web app (Deploy > New deployment > Web app,
   or `clasp deploy`), executing as you and accessible only to you.
6. Open the deployment's `/exec` URL: it opens the Launcher Page.

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
