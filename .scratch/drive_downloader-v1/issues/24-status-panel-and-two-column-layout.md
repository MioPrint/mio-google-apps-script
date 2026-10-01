# 24: Status panel and two-column layout

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 12, 19, 70, 83, 125, 126, 127; Disk Window core modules "Status panel"; UI "Disk Window top to bottom")

**What to build:** Under the setup row, a two-column block. Left: the option checkboxes, the Download/Pause/Resume/Stop row, and a new row with Expand all and Collapse all. Right: the status panel, as tall as the left column, wrapping its text and scrolling when it overflows, so nothing shifts the layout. The panel shows errors in red at its top (URL/read error, authorization message, Target Folder scan error, token error), then one status text: "Reading Drive…", "Reading Target Folder… N items", the current file line, "Pausing…", the paused text, "Finishing current file…" or the Run summary. The overall bar follows the block, then the trees.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The token line ("Fetching token…/Token received."), the "Reading Drive…" line, the error lines under the setup row and the bottom status line are gone; their content lives in the panel
- [x] Controller view model exposes the panel's errors and status text; the view renders them
- [x] Expand all / Collapse all in their own row under the Run row, inside the left column
- [x] Client-core tests: each error kind lands in the panel, errors come before the status text, Reading Drive and a scan show their texts, Run texts as before
- [x] Manual check on a deployment: a long error or paused message wraps/scrolls inside the panel without moving the trees
- [x] `npm run check` passes
