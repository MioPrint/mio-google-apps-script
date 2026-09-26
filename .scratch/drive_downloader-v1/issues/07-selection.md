# 07: Selection

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Every file and folder in the Drive tree has a checkbox, all ticked after Read Drive. Unticked files become "unselected", are skipped by the Run, and leave the totals; a folder's box ticks or clears its whole branch and shows a mixed state when partly ticked.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Checkbox per Item, all ticked after Read Drive
- [ ] Folder box ticks/clears everything below; mixed state when partly ticked
- [ ] Unticked files: Item Status "unselected", skipped, excluded from folder and overall totals; right tree Result "untouched" for existing local files
- [ ] A fully unticked branch creates no local folder; an empty Drive folder that is ticked is still created
- [ ] Items that can't be downloaded (failed at Read Drive, unsupported, loop) get a disabled box (the flags arrive in 11/12; the rule is built here)
- [ ] Checkboxes locked during a Run
- [ ] Local Names stay numbered among all siblings regardless of selection
- [ ] Client-core tests: branch toggle, mixed state, totals, skipped in Run, no folder for unticked branch, disabled boxes
- [ ] `npm run check` passes
