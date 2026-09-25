# 05: UI layout and Tree view prototype

Map: `.scratch/drive_downloader-map/map.md`

Type: prototype
Status: resolved
Blocked by: 08

## Question

How should the page look and behave? A throwaway static HTML mock with fake
data showing:

- The URL field, Read Drive, Location with "📁 <name>", the spaces → `_`
  checkbox, and Download/Pause/Resume/Stop, with their enabled and locked
  states
- Error display for a bad URL
- The expanded Tree with every Item Status, progress bars with bytes,
  folder totals, the overall bar, and Local Name on hover

The user reacts to it until the layout is settled.

## Comments

- 2026-09-25, from "Tree naming, sibling order and Native File sizes": the
  mock also needs the "Use Shortcut target names" (off) and "Skip existing
  files" (checked) checkboxes; a ↪ badge on Shortcuts with the other name on
  hover; `?` sizes on Native Files and `+` on totals above them; bytes with
  no percentage for a downloading Native File; an "overwrites" hover note on
  pending files; and the "N existing files will be overwritten. Continue?"
  confirm.
- 2026-09-25, from "Disk Window design": the whole UI lives in the Disk
  Window (a popup). Also mock the Launcher Page: an "Open Drive Downloader"
  button above user documentation, and a Help link from the Disk Window
  back to it.
- 2026-09-25, round 1 feedback (prototype on branch `prototype/ui-layout`,
  `drive_downloader/prototype/ui-layout.html`): variant A (form stack +
  table) chosen as base. Source Folder is mirrored as a sub-folder of the
  Target Folder; an existing one of the same name is matched/reused. Overall
  bar counts only bytes this Run transfers (not exists/failed); custom
  overwrite dialog OK; owner-blocked files show failed right after Read
  Drive. Round 2 asks: a selection checkbox per file/folder; two trees (left
  Drive, right Target Folder); Type and Created columns; a Local Name column
  in a smaller font.

## Answer

Resolved with the user, 2026-09-26, over four rounds of the prototype.
Prototype: branch `prototype/ui-layout`,
`drive_downloader/prototype/ui-layout.html` (round 4 = final, commit
`05266a4`; earlier rounds in the branch history). Serve it with
`python3 -m http.server -d drive_downloader/prototype` and open
`ui-layout.html`; `?state=` picks any UI state, `?page=launcher` the
Launcher Page.

**Disk Window, top to bottom** (about 1180×820):

- Header: "Drive Downloader" and a Help link to the Launcher Page.
- Form rows: Drive folder URL + Read Drive, with the error beneath it;
  Location… + "📁 <name>" / "No folder chosen"; the three checkboxes
  ("Replace spaces with _", "Use Shortcut target names", "Skip existing
  files").
- Run row: Download, Pause, Resume, Stop as four separate buttons, then the
  overall bar with "settled / files · bytes done / bytes to transfer". The
  overall bytes leave out files that exist or failed; the Size column shows
  the whole Tree.
- Two trees in **aligned rows** (one scroll): Google Drive on the left,
  Target Folder on the right, each Drive Item beside the local item it
  becomes; hatched cells where one side has nothing. Rejected: side-by-side
  panes scrolling separately.
- Status line at the bottom: the current file's Local Name path, bytes and
  attempt; "Paused at…"; the Run summary by Item Status.
- Overwrite confirm: a custom dialog, "N existing files will be
  overwritten. Continue?".

**Left tree (Drive):** columns Name, Type, Size, Status. Name holds a
collapse arrow on folders, a selection checkbox, the icon, the Drive name
and the ↪ Shortcut badge; hover shows the Shortcut's other name, the
overwrite note and failure reasons. Type is short ("JPEG", "Sheets →
.xlsx", "↪ MP4 video"). Folders show their total size and "settled / files".
A downloading file shows a bar with "22.1 / 51.0 MB" (Native Files: bytes
only), full detail on hover and in the status line. No Local Name or
Created column: the right tree shows the Local Name.

**Right tree (Target Folder):** columns Name, Size, Modified, Result. It
lists the Target Folder as it is on disk merged with what the Run will do.
Results: folders "matched" (exists, reused) or "new folder"; files "new"
(italic, not yet there), "keep" (exists, skipped), "overwrite", "writing",
"saved", "overwritten", "kept" (failed, old file survives), "not written";
"local only" (on disk, not in Drive) and "untouched" (on disk, Drive Item
unselected). Nothing local is ever changed except what the Run writes.

**Source Folder placement:** the Source Folder is mirrored as a sub-folder
of the Target Folder with its own Local Name; an existing sub-folder of
that name (ignoring case) is matched and reused.

**Selection:** every file and folder has a checkbox, all ticked after Read
Drive. A folder's box ticks or clears everything below it and shows a
mixed state when partly ticked. Unticked files get the new Item Status
**unselected**, are skipped, and are left out of the overall totals.
Files that can't be downloaded (unsupported, loop, blocked by owner) have a
disabled box. Checkboxes are locked during a Run. Local Names are numbered
among all Drive siblings, selected or not.

**Collapsing:** every folder collapses, in both trees at once for matched
rows; local-only folders collapse on their own. "Expand all" and
"Collapse all" sit in the Drive header. The Tree starts fully expanded,
and **starting a Run expands all**. A collapsed folder still shows its
totals.

**Launcher Page:** "Drive Downloader", one line of purpose, the "Open
Drive Downloader" button, a note to keep the tab open, then the user
documentation (before you start, the four steps, Item Statuses, names and
sizes, limits).

Also confirmed: failed files blocked by their owner show as failed right
after Read Drive.
