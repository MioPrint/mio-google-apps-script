# 29: Tree tooltips

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 22, 27, 28, 129, 130, 131; Disk Window core modules "Tooltip texts", "Tooltips", "View")

**What to build:** Hovering 1 s over a folder or file name in either tree fades in its full name; on the Drive side also its Type label and, for a Shortcut, "Shortcut to: <other name>". Hovering 2 s over a Status or Result cell fades in a description of that Item Status or Result, then its detail: failure reason, "overwrites" / "empty file will be replaced" note, bytes, percentage and Attempt or retry countdown while downloading. Every native `title` hover text is removed. Tips keep working while a file transfers: the view replaces only tree rows whose markup changed, and the tooltip tracks its target by row and cell.

**Blocked by:** 27, 28

**Status:** ready-for-agent

- [ ] Rows carry a name tip and a status/Result tip built in the core, using the spec's draft descriptions
- [ ] View shows them with the ticket 28 mechanism: 1 s for names, 2 s for Status/Result cells
- [ ] No native `title` attributes left in the Disk Window
- [ ] Tree rendering replaces only changed rows; a tip under the pointer survives per-frame updates during a Run
- [ ] Tests: name tips (plain, Shortcut both naming modes, Native File type label, Target side), status tips (each Item Status, failed with reason, overwrites note, downloading detail), Result tips
- [ ] Manual check on a deployment: delays, fade, texts; a tip on a downloading row stays up and updates
- [ ] `npm run check` passes
