# 22: Folder names toggle; Download keeps expansion

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 26, 118; Disk Window core modules "View"; Run and file state machine "Download")

**What to build:** Clicking a folder's arrow, icon or name expands or collapses it, in both trees, also while a file transfers. Clicking its checkbox still only ticks it, and clicking a file name does nothing. Pressing Download leaves every folder expanded or collapsed as the user left it, on both sides.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A folder's icon and name toggle it on `pointerdown` (primary button), like the arrow, in the Drive tree and the Target Folder tree (matched and local-only folders)
- [ ] The selection checkbox inside the name keeps its own click and never toggles the folder
- [ ] Download (with and without the overwrite confirm) no longer expands collapsed folders; Read Drive still opens a fresh Tree fully expanded
- [ ] Client-core test: folders collapsed before Download stay collapsed in the view model during and after the Run
- [ ] Manual check on a deployment: clicking a folder name mid-transfer toggles at the first click; no double toggle when idle
- [ ] `npm run check` passes
