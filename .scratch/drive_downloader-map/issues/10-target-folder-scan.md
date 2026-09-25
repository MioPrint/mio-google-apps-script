# 10: Target Folder scan

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: open
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
