# 10: Overwrite and existing files

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Unchecking "Skip existing files" makes the Run overwrite existing files after one confirm, safely: the old file survives any failure, Stop or closed window. The right tree shows exactly what will be and was overwritten, odd pairs (a folder where a file goes, or the reverse) never delete anything, and a file that appears after Download was pressed is never overwritten.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [x] Unchecked: files that would be overwritten show as pending with an "overwrites" hover note; right tree Result "overwrite"
- [x] Download re-reads only the Source sub-folder, re-merges, then shows the custom dialog "N existing files will be overwritten. Continue?" when N > 0; cancel returns to `ready`
- [x] Overwrite via `createWritable()` without keeping data; old file replaced only on `close()`; after the Run such files show plain done, Result "overwritten"; failed or stopped → "kept"; never written → "not written"
- [x] A 0-byte local file (Drive file not 0 bytes or unknown) shows "0 B", Result "new", hover "empty file will be replaced", not counted in N
- [x] Local folder where a file goes, or the reverse: "keep"/exists when skipping; "in the way" and failed ("a folder named X is in the way") when overwriting; a blocked folder fails its subtree
- [x] Every disk operation on a matched item uses the on-disk name (case kept)
- [x] A file present at the per-file check but not in the Download-time scan → exists even when overwriting, hover "appeared after Download was pressed"; a file gone since the scan → downloaded as new
- [x] Toggling the checkbox re-merges without re-reading the disk; it always starts checked
- [x] Nothing is ever deleted except a Stopped new file
- [x] Client-core tests on the fake disk (with swap-file semantics): confirm count, overwrite success/failure/Stop keeps old data, in-the-way both modes, case preserved, appeared-after-Download, 0-byte handling
- [x] `npm run check` passes
