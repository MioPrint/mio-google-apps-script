# 04: Location and Target Folder tree

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** The user presses Location…, picks a folder, and sees "📁 <name>". The Disk Window reads the whole Target Folder recursively and shows it beside the Drive tree in aligned rows, each Drive Item next to the local item it will become, with a Result per row. The Source Folder maps to a sub-folder of the Target Folder, reusing an existing one. Local Names in this ticket apply only the illegal-character → `+` rule (numbering and spaces → `_` come in 06).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Location… opens the folder picker in Downloads the first time, at the remembered folder after that; "📁 <name>" or "No folder chosen"; no default
- [ ] Folder handle remembered in IndexedDB; permission re-confirmed each visit
- [ ] Target Folder scan: recursive read of names, kind, size, modified; "Reading Target Folder… N items"; no limit; Download stays disabled until done
- [ ] Right tree columns Name, Size, Modified, Result; aligned rows with the Drive tree, one scroll; hatched cells where a side has nothing
- [ ] With a folder but no Tree: the Target Folder shown alone; with a Tree and no matching sub-folder: one "new folder" row with every planned child as italic "new"
- [ ] Matching by Local Name ignoring case; exact case wins among several matches, else first in name order, rest local-only
- [ ] Results: folders "matched" / "new folder"; files "new", "keep" (exists, skipping on), "local only"; local-only after matched children, folders first, natural order; nothing hidden
- [ ] Matched folders start expanded, local-only folders collapsed; collapsing a matched folder collapses both sides
- [ ] Refresh link in the Target Folder header re-reads the whole Target Folder (not during a Run)
- [ ] Failed read (permission lost, folder moved or deleted): message under Location, right tree emptied, Download disabled until re-pick or Refresh succeeds; Refresh click re-requests permission
- [ ] Client-core tests with an in-memory fake directory: scan, sub-folder match (case), merge rows and Results, local-only ordering, read failure
- [ ] `npm run check` passes
