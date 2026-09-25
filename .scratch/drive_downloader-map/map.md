# Map: drive_downloader v1

Label: wayfinder:map

## Destination

drive_downloader works in desktop Chrome, as a GAS-only App (frontend and
backend): it mirrors a real Source Folder (≤1000 files, single files 20 GB+,
Shortcuts, Native Files) into a chosen Target Folder per the requirements
below. It gets there via decisions on this map, then `/to-spec` →
`/to-tickets` into `.scratch/drive_downloader-v1/`, then `/implement`.

## Notes

- Domain: `drive_downloader/CONTEXT.md`. Consult `domain-modeling` on every
  ticket; `grilling` for HITL ones.
- Execution is carried into this effort (overrides plan-only default), but
  via the Main Flow: build tickets live in `.scratch/drive_downloader-v1/`,
  not in this map.
- Hard constraints: GAS serves both frontend and backend (no external
  hosting, no extension); single user (`access: MYSELF`); desktop Chrome;
  nothing zipped; no size cap per file; ≤1000 files; 6-min GAS execution
  limit must be designed around.
- Never run clasp; hand the user exact commands.
- First approach for bytes: GAS reads the Tree and hands the browser an
  OAuth token; the browser streams each file straight from the Drive API,
  requesting byte ranges.

### Requirements settled while charting

- URL input takes folder URLs only (incl. `?resourcekey=`, `/u/N/`
  variants). Errors shown: malformed URL, not found / no access, is a file,
  empty folder.
- Source Folder may be in My Drive, Shared with me, or public-by-link;
  Shared Drives only if free.
- Read Drive builds the Tree, fully expanded, with sizes. Every Item has a
  selection checkbox (all ticked); unticked files are "unselected" and
  skipped.
- The Source Folder is mirrored as a sub-folder of the Target Folder; an
  existing one of the same Local Name is reused.
- Shortcuts (to files and folders) are followed. Each target downloaded
  once per place it appears; a Shortcut into its own ancestry is status
  "loop", skipped. Checkbox "Use Shortcut target names" (off by default)
  picks the Shortcut's own name or its target's, for Tree and Local Name.
- Native Files are exported to .docx/.xlsx/.pptx; over the 10 MB export
  cap they are downloaded via `files.download` (no resume, no total); not
  exportable (Forms, Sites, My Maps…) → unsupported.
- Location = folder picker. Shows "📁 <folder name>" (full path is not
  available to the browser) or "No folder chosen". The picker opens in
  Downloads; the last folder is remembered, with permission re-confirmed
  each visit. Download is disabled until a folder is chosen.
- Local Name: illegal characters → `+`. A checkbox replaces spaces with `_`
  (files and folders). Duplicate Local Names among siblings (ignoring case)
  all get numbered, `name (1).ext`, `name (2).ext`…, in
  `folder,name_natural,createdTime` order. The Tree shows Drive names; the
  Local Name shows in the Target Folder tree beside it and in the status
  line.
- Checkbox "Skip existing files", checked by default, always starts checked.
  Checked: an existing local file with the same Local Name → status
  "exists", skipped; checked when the Tree and Target Folder are both known,
  and again just before each file. Unchecked: it is overwritten, after one
  confirm. Nothing is ever deleted. An existing local sub-folder is reused,
  with its files checked one by one.
- One file at a time. Attempts per file: 1 try, then 3 retries that resume
  from the last byte received, then 1 retry from the start; after that →
  failed, move on. No "retry failed" button.
- Pause freezes the current file mid-transfer; Resume continues from the
  same byte. Stop aborts the current file, leaves no partial file, and ends
  the Run.
- Tree statuses: pending / downloading (bar + bytes) / done / exists /
  failed (reason) / unsupported / loop / unselected. Folders show totals of their
  children; there is an overall bar (files + bytes).
- The URL field, Read Drive, Location, the option checkboxes and the
  selection checkboxes are locked while a Run is active or paused.

## Decisions so far

<!-- one line per closed ticket: [title](link): gist -->

- [Folder picker and disk writes inside the GAS iframe](issues/01-folder-picker-in-gas-iframe.md): the picker is blocked in the iframe with no setting to fix it; likely workaround is a same-origin unsandboxed popup (the Disk Window) via `window.open('/blank')`, still to be proven
- [Reading the Tree in GAS](issues/03-read-drive-in-gas.md): use the Advanced Drive v3 service, one `files.list` per folder; stop at ~4.5 min and let the frontend call again; all access errors are the same 404, so one message
- [Browser streaming straight from the Drive API with a GAS token](issues/02-browser-direct-drive-api.md): CORS works, so the browser streams `alt=media` by `Range` in chunks of about 64–256 MB with a `drive.readonly` token, refreshed via `google.script.run` and on 401; Native File export is capped at 10 MB, and `files.download` over the cap is unproven
- [End-to-end byte-path spike in a deployed GAS web app](issues/04-byte-path-spike.md): proven on 4.9 GB in Chrome: the Disk Window works and its host is stable, so the folder is remembered; Native Files over 10 MB go through `files.download`; only transient errors use Attempts; resource-key Tree calls need `UrlFetchApp`
- [Tree naming, sibling order and Native File sizes](issues/07-tree-naming-and-sizes.md): duplicates numbered from `(1)` in `folder,name_natural,createdTime` order; Native sizes `?` with `+` totals; checkboxes for Shortcut target names and "Skip existing files" (unchecked overwrites, replacing "Never overwrite"); blocked or abusive files → failed
- [Disk Window design](issues/08-disk-window-design.md): the whole App lives in the Disk Window (a popup); the GAS tab is the Launcher Page (Open button + user docs) and closing it closes the Disk Window; closing mid-Run ends the Run; a 0-byte local file counts as missing; Location has no default
- [UI layout and Tree view prototype](issues/05-ui-layout-prototype.md): form stack on top, then the Drive tree and the Target Folder tree in aligned rows; per-Item selection (new "unselected" status); collapsible folders, all expanded when a Run starts; the Source Folder becomes a sub-folder of the Target Folder, reusing an existing one

## Not yet specified

- **Run state model**: the exact state machine for Run, Pause, Stop and
  Attempts (transient versus permanent errors, the finalizing phase,
  unknown-size Native downloads), and what the frontend holds versus what
  GAS holds.
- **Target Folder scan**: how the right-hand tree is read from disk (a
  recursive scan of the Target Folder, re-read when Location or the naming
  checkboxes change, kept in step during a Run), its cost on a large local
  folder, and whether it lists the whole Target Folder or only the Source
  Folder's sub-folder (the prototype lists the whole folder).
- **Acceptance**: which real Source Folder(s) prove the destination; a
  20 GB+ test file must exist in Drive. Still unproven from the spike: a
  public-by-link folder never opened, the bad-URL error text, the web
  app with several Google accounts signed in, and the Disk Window closing
  with the Launcher Page.

## Out of scope

<!-- closed tickets ruled beyond the destination: gist + why + link -->

- Zip or archive output: ruled out by the user.
- Non-Chrome browsers and mobile: primarily Chrome desktop.
- Multi-user access: single user for v1.
- Drive links written inside file contents: only Drive Shortcuts count as
  "linked".
- "Retry failed" button: not wanted.
