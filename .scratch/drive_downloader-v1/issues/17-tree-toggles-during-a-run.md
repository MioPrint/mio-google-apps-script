# 17: Tree toggles during a Run

Spec: `.scratch/drive_downloader-v1/spec.md` (story 112; Implementation Decisions "View")

**What to build:** Folders in both trees expand and collapse with one click while a file is transferring, not only while the Run is paused.

Cause: the view re-renders the whole Tree about once per frame while a file transfers. The toggle pressed on mousedown is gone by mouseup, so `click` never reaches the handler.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Drive-side and Target-Folder-side folder toggles act on `pointerdown` (primary button only), not `click`
- [x] Selection checkboxes and the other Tree actions behave as before (checkboxes stay locked during a Run)
- [x] Manual check (dev deploy or local page with a fake Run): toggling mid-transfer works at the first click; no double toggle on a normal click while idle
- [x] `npm run check` passes

## Comments

Manual check (user, 2026-10-01): the arrow toggles mid-transfer at the
first click; clicking the folder name doesn't toggle at all, which is
what the user expected. Not a re-render bug: name-click toggling is new
scope, spec story 118, ticketed separately.
