# 08: Disk Window design

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: resolved
Blocked by: 04

## Question

With the Disk Window (an unsandboxed same-origin popup) proven by the spike,
decide:

- Does the whole page (URL field, Tree, controls) live in the Disk Window, or
  does the Disk Window stay a thin disk writer driven from the GAS iframe?
- What happens if the user closes the Disk Window mid-Run (treated as Pause?
  Stop?)?
- The "Location" default: Chrome won't accept Downloads itself, so is it a
  fixed sub-folder such as `Downloads/drive_downloader`, or no default?
- An empty file left by a crash under a Local Name: treat it as "exists", or
  allow replacing a 0-byte file?
- Whether "remembered folder" holds, given what the spike found about host
  stability.

## Comments

- 2026-09-25, from "End-to-end byte-path spike": the Disk Window works and
  its host is stable across reloads, `/exec` and new versions, so the
  remembered folder holds (last bullet answered). A handle cloned into the
  GAS iframe can also write, so the thin-writer layout is possible too.
  Chrome refuses Downloads itself as the Target Folder.
- 2026-09-25, from "Tree naming, sibling order and Native File sizes":
  "Never overwrite" is now a default. "Skip existing files" (checked) skips
  them; unchecked overwrites them, via `.crswap` so the old file survives a
  failure. The 0-byte-file bullet only matters with skipping on.

## Answer

Layout: the **Disk Window holds the whole App** (URL field, Tree, Location,
controls, streaming and writes), as the spike already does. The GAS tab
becomes the **Launcher Page**: an "Open Drive Downloader" button above
user documentation (desktop Chrome only, keep both windows open, choosing a
Location but not Downloads itself, Item Statuses, skip versus overwrite,
Shortcuts, Native File exports, limits). The documentation is written for
users, separate from the developer README. The Disk Window has a Help link
back to it. The Disk Window reaches GAS through the Launcher Page
(`window.opener`), so both stay open. The thin writer and picker-only
layouts were rejected: the first needs a message protocol between windows,
the second is unproven.

Disk Window: a large popup window, not a tab. Clicking Open while a Disk
Window is already open brings it to the front instead of opening a second.

Closing:

- Disk Window closed during a Run (active or paused): Chrome's "Leave
  site?" prompt; if the user leaves anyway, the Run ends and nothing is
  saved. A new Run with "Skip existing files" on carries on from the files
  already done.
- Launcher Page closed or reloaded: the Disk Window closes with it, with no
  reattach. The Launcher Page shows "Leave site?" during a Run. As a backup,
  the Disk Window closes itself if it finds the Launcher Page gone.

Leftovers from a crash or close: a local file of 0 bytes counts as
**missing**, not "exists", when its Drive file isn't 0 bytes (including
Native Files of unknown size). It is downloaded again with no overwrite
confirm. Orphan `.crswap` files are left alone (nothing is ever deleted).

Location: no default, "No folder chosen". The picker opens in Downloads
(after that, the remembered folder); the user picks or creates a
sub-folder, since Chrome refuses Downloads itself. The remembered folder
holds, because the spike showed the host is stable.
