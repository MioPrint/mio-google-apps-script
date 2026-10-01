# 26: Target Folder header, no root row, Refresh disabled

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 57, 63, 67; Disk Window core modules "Merge"; UI)

**What to build:** The "Target: 📁 name" line is gone (a browser never reveals the folder's absolute path); the Target Folder group header reads "Target Folder 📁 <name>", or "No folder chosen" muted. The Target Folder tree drops its own root row: the Source sub-folder sits at depth 0 beside the Drive root, every right-side depth equals its Drive row's, and the Target Folder's other top-level items follow at depth 0 as local only, folders collapsed. Refresh is always shown, disabled unless a folder is chosen, no scan is running and nothing is locked - no longer hidden during a Run.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Controller view model gives the header's folder name (or none) and Refresh's disabled state in place of the location text and Refresh visibility
- [x] Merge emits no Target Folder row; depths as described, before and without a Tree too
- [x] Merge / client-core tests: no root row, right depths match Drive depths, top-level local-only items at depth 0, Refresh disabled cases, header name
- [ ] Manual check on a deployment: header shows the picked folder's name; Refresh greyed, not hidden, during a Run
- [x] `npm run check` passes
