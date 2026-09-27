# 16: Skip-existing preview

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 45, 48, 72, 110, 111; Implementation Decisions "Skip-existing preview")

**What to build:** With "Skip existing files" checked, the Tree shows before Download which files the Run will skip. Drive files that already exist in the Target Folder show Item Status "exists", with their checkbox unticked and disabled, and count as settled. Unchecking the option gives every such file back its own tick state.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Skip on: every Drive file the Run would skip as exists shows "exists" before the Run. That means a real local match by Local Name ignoring case (0-byte leftovers excluded), or a local folder in the file's place. Its checkbox is unticked and disabled. The Target Folder side still shows "keep"
- [x] The set is derived on every re-merge (Target Folder read, Refresh, naming options, the Skip option) and never written into the selection
- [x] Folder tick/mixed state and a folder checkbox click ignore "exists" files; a folder whose files all exist shows as not selectable
- [x] Folder totals and the overall bar count "exists" files as settled, with their bytes left out; a Native File shows its local size
- [x] "exists" wins over "unselected" while Skip is on; with Skip off, a file the user had unticked is "unselected" again, and every other file is ticked and pending (with the "overwrites" note)
- [x] Download with Skip on behaves as before: the Run resets statuses and its own per-file check sets "exists"
- [x] Client-core tests: preview rows/checkboxes/totals, toggling Skip restores ticks, user-unticked + exists, folder-in-the-way, 0-byte leftover not "exists", folder checkbox skips "exists" files; existing Selection and overall-progress tests updated where the preview changes them
- [x] `npm run check` passes
