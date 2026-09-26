# Client-side core, not thin client

AGENTS.md's Frontend section says "keep client logic thin: real logic
stays server-side." drive_downloader departs from this: the Run, and the
naming, target-folder-scanning and merging logic behind it, all live in
the Disk Window (the browser), not GAS. Bytes and local disk access only
exist in the browser (the File System Access API, byte-range fetches for
20 GB+ files), and GAS execution is capped at 6 minutes while a Run can
take much longer, so GAS is left to what only it can do: read the Tree
and hand out an OAuth token.

The Disk Window core reaches the outside world only through three
injected ports, so fakes can drive it in tests instead of a real browser,
GAS or Drive: a **Drive port** (the Drive API fetches), a **Disk port**
(the File System Access directory handle surface) and a **Server port**
(the Tree reader and token calls, reached through the Launcher Page's
`google.script.run` bridge).

This gives the App two test layers instead of one: **Seam 1, backend**
(`loadApp`, `tools/load-app.js`) runs the GAS source in one `vm` context
with mocked `Drive`/`UrlFetchApp`/`ScriptApp`; **Seam 2, Disk Window core**
(`loadClientCore`, `tools/load-client-core.js`) runs the client script
partials (`*.js.html`) in one `vm` context with fake ports, the way the
browser runs them. DOM rendering and the window-opening plumbing between
the two pages are not unit-tested; they're covered by the manual
acceptance checklist in `.scratch/drive_downloader-v1/spec.md`.
