# 10: Target Folder scan

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: resolved
Blocked by: None

## Question

How is the right-hand (Target Folder) tree read from disk and kept in step?

- Scope: the whole Target Folder (as in the prototype) or only the Source
  Folder's sub-folder, and what shows when that sub-folder does not exist
  yet.
- Depth and cost: recursive scan with the File System Access API on a
  large local folder; limits, laziness, or progress.
- When it is re-read: Location chosen, Read Drive, naming checkboxes
  toggled, "Skip existing files" toggled, during and after a Run.
- How its rows align with the Drive tree (matched by Local Name), and how
  local-only files and folders show.
- How it relates to the per-file "exists" check (one scan, or checked
  again just before each file as already required).

Inputs: "UI layout and Tree view prototype", "Disk Window design",
"Tree naming, sibling order and Native File sizes".

## Answer

Resolved with the user, 2026-09-26, over two rounds.

**Scope:** the right tree is the **whole Target Folder**, read recursively
(names, plus size and modified time per file). No size limit: the status
line shows "Reading Target Folder… N items" and Download stays disabled
until the read finishes.

**Display:** with a folder chosen but no Tree yet, the right tree shows the
Target Folder alone. With a Tree but no matching Source sub-folder, it shows
one "new folder" row with every planned child in italic "new". Matched
folders start expanded; local-only folders (siblings of the sub-folder and
ones inside it) start collapsed; "Expand all" opens them, starting a Run
does not.

**When it is re-read:**

- Location chosen → whole Target Folder.
- Read Drive done, naming checkboxes, "Skip existing files" toggled → no
  re-read; re-merge with the Tree and recompute Results.
- Download pressed → re-read **only the Source sub-folder**, before the
  overwrite count and confirm.
- During and after a Run → no re-read; rows update from the Run's own
  writes and each file's exists check.
- A **Refresh** link in the Target Folder header (idle/ready/finished) →
  whole Target Folder. No re-read on window focus.

**Alignment:** rows match by Local Name ignoring case. When matched,
every disk operation uses the **on-disk name** (an overwrite keeps its
case; on case-sensitive disks this avoids creating a second file). Several
local names matching one Local Name: the exact-case one wins, else the
first in name order; the rest are local-only. Local-only rows come after a
folder's matched children, folders first, natural name order. Nothing is
hidden (`.crswap`, `.DS_Store`, `Thumbs.db`… all shown).

**Odd pairs:** a local folder where a Drive file goes (or the reverse)
shares the row; the local item is shown, Result "keep" when skipping,
"in the way" when not (left: failed with reason). A 0-byte local file
(counts as missing) shows "0 B", Result "new", hover "empty file will be
replaced", and is not in the overwrite count.

**Scan vs per-file check:** the scan feeds the display and the confirm
count; the exists check just before each file is authoritative and updates
the row. Deleted since the scan → downloaded as new. Appeared since
Download was pressed → **exists** even with "Skip existing files" off
(never overwrite what the user wasn't told about); hover "appeared after
Download was pressed".

**Errors:** a failed read (permission lost, folder moved or deleted) shows
a message under Location, empties the right tree and keeps Download
disabled until Location is re-picked or Refresh succeeds; permission is
re-requested on the Refresh click.
