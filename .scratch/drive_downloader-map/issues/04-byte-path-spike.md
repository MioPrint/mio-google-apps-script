# 04: End-to-end byte-path spike in a deployed GAS web app

Map: `.scratch/drive_downloader-map/map.md`

Type: prototype
Status: open
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
