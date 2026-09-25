# 04: End-to-end byte-path spike in a deployed GAS web app

Map: `.scratch/drive_downloader-map/map.md`

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

Does the chosen byte path actually work in a real deployment? The spike,
deployed by the user with clasp, should pick a Target Folder, stream one
large Drive file (ideally >4 GB) into it with visible progress, then show
Pause/Resume by byte range, an injected failure resuming from the last
byte, a token refresh mid-transfer, and Stop leaving no partial file. It
should also show an "exists" check skipping a file.

The outcome decides the byte-path architecture, or triggers the picker
fallback from the map's fog. HITL: the user runs `clasp push` / deploy and
tests in Chrome.

Also prove (from "Browser streaming straight from the Drive API with a GAS
token"): no redirect drops `Authorization`, a stream in progress survives token
expiry or a range retry after a 401 works, whether `files.download` or
`exportLinks` lets Native Files over 10 MB through, and the error shape of an
over-cap export. From "Reading the Tree in GAS": listing a public-by-link folder
never opened, and real timing for about 1000 Items.

From "Folder picker and disk writes inside the GAS iframe": the picker is
blocked in the iframe, so the spike runs it in the Disk Window
(`window.open('/blank')` from the GAS iframe; follow the probe steps in the
research file on branch `research/folder-picker-in-gas-iframe`). Also prove
whether the `n-<hash>` host is stable across visits and redeploys (does the
remembered folder survive?), the Safe Browsing pause on a big file, and that
Stop deletes the empty file.

Prototype: branch `prototype/byte-path-spike` (worktree
`../mio-gas-byte-path-spike`), App `drive_downloader_spike/`; its README has
the deploy steps and test checklist.

## Comments

- 2026-09-25: `clasp create` overwrote `appsscript.json` (as the README
  warns); restore it from git before pushing. Opening the editor from Drive under
  `authuser=1` failed with "We're sorry, we can't open the file right now":
  the multi-account GAS bug. Check whether the web app itself works with
  several Google accounts signed in, or needs a single-account profile.
- 2026-09-25, first run (Chrome incognito, `/dev`; Brave lacks the API
  unless flagged):
  - Host `n-lc323…-0lu-script.googleusercontent.com`, the same for the
    iframe and the Disk Window, across reloads. Not yet checked on `/exec`
    or after a new version.
  - Picker blocked in the iframe (Brave: not a function). In the Disk
    Window the picker, Re-grant, List, and a handle cloned into the iframe
    that then writes all work.
  - 4.93 GB zip: 206 responses, no redirect, Pause/Resume from the same
    byte, injected failure resumes, forced restart truncates, corrupt token
    → 401 → refresh → same range. Stop leaves no file and no `.crswap`.
    Exists → skipped. Finalize 10.8 s, size on disk matches.
  - `getOAuthToken()` returned a fresh token, `expires_in` ≈ 3400 s.
    A stream outliving the token was not tested.
  - Native Sheet 10.9 MB: `files.export` → 403 `exportSizeLimitExceeded`
    "This file is too large to be exported."; `files.download` LRO → done
    at once, `downloadUri` `docs.google.com/spreadsheets/export?…`,
    `partialDownloadAllowed:false`, bearer fetch → 200 after a redirect to
    `doc-…-sheets.googleusercontent.com`, no Content-Length, saved OK.
    `exportLinks` with bearer: same redirect, same bytes, saved OK.
  - `alt=media` on a Sheet → 403 `fileNotDownloadable`, and the spike spent
    all 5 Attempts on it: non-transient errors must fail at once.
  - Tree read failed: the advanced service takes no headers argument
    ("Expected 1-2 only"). Fixed in the spike: resource-key calls go
    through UrlFetchApp (adds `script.external_request`).
- 2026-09-25, second run: Tree of 1000 Items in one `files.list` page,
  15.1 s in GAS (17.9 s wall), no pending. The default list order is
  neither name nor creation order. Host unchanged on `/exec` and after a
  new version. A normal Chrome profile works, including the remembered
  folder. The user approved `files.download` for Native Files over 10 MB.

## Answer

The byte path holds. Adopt the **Disk Window**: `window.open('/blank')` from
the GAS iframe gives a same-origin top-level window where the folder picker,
remembered folder ("Allow on every visit"), streaming writes, `seek`/
`truncate`, `abort` + `removeEntry` all work in desktop Chrome. The sandbox
host is stable across reloads, `/dev` → `/exec`, and new versions, so the
remembered folder survives.

Bytes: the browser fetches `alt=media` straight from `www.googleapis.com`
with the GAS token, in `Range` chunks (206, no redirect). Pause/Resume from
the same byte, resume after a failure, restart from 0, 401 → refresh token →
same range, Stop leaving no file or `.crswap`, and the exists skip all
proved on a 4.93 GB file. Chrome's finalize pass took 10.8 s for 4.9 GB (plan
for a "finalizing" state, about 45 s at 20 GB). `getOAuthToken()` gives a
~1 h token; refreshing before a chunk when the token is over 10 min old makes
mid-stream expiry a non-issue (a failed stream resumes like any Attempt).

Native Files: `files.export` for ≤10 MB; over that it fails with 403
`exportSizeLimitExceeded`, and the App then uses the `files.download` LRO:
fetch `downloadUri` with the bearer token (it redirects to a signed
`*.googleusercontent.com` URL). No size up front, no resume
(`partialDownloadAllowed:false`), so every Attempt starts from 0 and progress
has no total. **Requirement change (user-approved): Native Files over the
export cap are downloaded this way, not marked failed.** `exportLinks` also
works but is only documented for browser navigation, so it is not used.

Errors: only transient failures (network drop, 5xx, 429, a 401 that survives
a refresh) consume Attempts; permanent ones (403 `fileNotDownloadable`,
`exportSizeLimitExceeded` after the fallback, 404, `canDownload` false) fail
the Item at once.

Tree reading (corrects "Reading the Tree in GAS"): the Advanced Drive
service takes no headers argument, so calls needing
`X-Goog-Drive-Resource-Keys` go through `UrlFetchApp` to the REST API, adding
the `script.external_request` scope. 1000 Items took 15 s, far under the
budget. Drive's default sibling order is arbitrary, so the App must set
`orderBy`.

Not proven: a public-by-link folder never opened (the resource-key path),
the exact error text for a bad or inaccessible URL, and whether the web app
works with several Google accounts signed in (the editor did not; incognito
or a single-account profile did). Brave lacks the File System Access API
unless `brave://flags/#file-system-access-api` is on.
