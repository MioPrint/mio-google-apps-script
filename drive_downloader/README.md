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
6. `doGet` requires every manifest scope up front
   (`ScriptApp.requireAllScopes`), so opening the App's URL should now
   prompt for consent before the Launcher Page shows. Google documents
   that call as reliable only on a surface that supports granular
   consent (e.g. the Apps Script editor) — not confirmed for a deployed
   web app — so **authorize the App once anyway**, to guarantee it
   regardless: in the editor, open `Code.js`, choose `doGet` from the
   function dropdown and click Run; approve the consent screen. Redo
   this after adding a scope or after re-authorizing (Chrome
   Settings > Security > "Access to your Google Account").
7. Open the deployment's `/exec` URL: it opens the Launcher Page,
   consent screen first if step 6 wasn't done or scopes changed. If Read
   Drive still shows an authorization message, redo step 6.

### Multiple Google accounts (known limitation)

A Chrome profile with several Google accounts signed in gets Drive's
"Sorry, unable to open the file at this time." on the App URL. Nothing is
fixed in code. Workaround: open the URL in a Chrome profile signed into
only the deploying account, or in an Incognito window signed into it.

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
- Expect a one-time "unverified app" consent screen, up front: either
  when first opening the deployed URL, or (guaranteed) during the deploy
  steps' "authorize the App once" (running `doGet` from the editor).
