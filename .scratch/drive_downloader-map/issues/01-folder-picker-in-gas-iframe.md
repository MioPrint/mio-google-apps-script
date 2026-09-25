# 01: Folder picker and disk writes inside the GAS iframe

Map: `.scratch/drive_downloader-map/map.md`

Type: research
Status: resolved
Blocked by: None

## Question

Inside a GAS HtmlService web app (sandboxed iframe on
`*.googleusercontent.com`, nested under `script.google.com`), in current
desktop Chrome, which File System Access API features work?

- `window.showDirectoryPicker()` (incl. `startIn: 'downloads'`), or does
  Chrome reject it in cross-origin sub-frames? Does any HtmlService
  setting (sandbox mode, `setXFrameOptionsMode`, iframe `allow` attrs)
  change that?
- `getDirectoryHandle` / `getFileHandle` create and lookup (for "exists"
  checks), `createWritable()` streaming of 20 GB+ files, `seek`/`truncate`
  for resuming and restarting, `abort()` leaving no partial file.
- Storing handles in IndexedDB and `queryPermission` / `requestPermission`
  across visits from inside the iframe.
- If blocked: which GAS-only workarounds exist (e.g. opening the
  googleusercontent frame top-level, OPFS plus a later export, or native
  downloads via `<a download>` or Drive URLs) and what each costs against
  the map's requirements (sub-folders, never overwrite, progress, 20 GB).

Primary sources: Chrome and WHATWG File System Access specs, Chromium
source and bug tracker, Google Apps Script HtmlService docs.

Research: branch `research/folder-picker-in-gas-iframe`, file `.scratch/drive_downloader-map/research/folder-picker-in-gas-iframe.md`

## Answer

The folder picker is blocked inside the GAS iframe. Chrome throws "Cross origin
sub frames aren't allowed to show a file picker", as the spec requires and
Chromium enforces twice. No HtmlService setting or Permissions-Policy changes
that, `requestPermission` is denied, and a dragged-in folder handle stays
read-only.

A likely GAS-only workaround is the **Disk Window**. The GAS iframe sandbox
includes `allow-popups-to-escape-sandbox`, and the App origin serves `/blank`
with no CSP or COOP. So `window.open('/blank')` should give an unsandboxed,
same-origin, scriptable top-level window where the full File System Access API
works, including a remembered folder with "Allow on every visit". This is
inferred from Chromium source and live headers, not tested yet.

Catches:

- Chrome refuses the Downloads folder itself as the target; the user must pick
  or create a sub-folder.
- Chrome runs a Safe Browsing read after the last byte, so a 20 GB file pauses
  visibly at the end.
- `getFileHandle({create:true})` creates an empty file right away, so Stop must
  also delete it.
- The popup must stay open for the whole Run.

OPFS then export, `<a download>` and plain Drive downloads can't mirror
sub-folders or skip existing files, so they fail the requirements. Opening the
googleusercontent page top-level shows an empty shell.

Open: whether the `n-<hash>` host is stable across visits and deployments (if
not, the remembered folder is lost), where the Run UI lives, and what to do with
an empty file a crash leaves behind. The research file has the probe steps.
