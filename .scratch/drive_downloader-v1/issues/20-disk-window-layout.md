# 20: Disk Window layout

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 6, 24, 57, 67, 114, 115; UI "Disk Window top to bottom")

**What to build:** The Disk Window follows the revised layout. Every control is a button in a row, and the Help link that did nothing is gone.

Top to bottom:

- the title, with a note that the docs are on the Launcher Page tab;
- the URL field;
- one row with Read Drive, Local Target Folder and Refresh;
- "Target: 📁 name" or "No folder chosen";
- the errors;
- the four options in a vertical list;
- one row with Download, Pause, Resume, Stop, Expand all and Collapse all;
- the overall bar;
- the trees;
- the status line.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Help link removed; header says the docs are on the Launcher Page tab
- [ ] Read Drive, the Target Folder button and Refresh sit in one row under the URL field. "Target: 📁 name" / "No folder chosen" sits beneath them. URL/read errors and Target Folder scan errors show beneath that
- [ ] Refresh is a button, shown when a folder is chosen, no scan is running and nothing is locked; it still re-requests permission on click
- [ ] Expand all and Collapse all are buttons in the run-control row, disabled when there are no rows; the Tree header keeps only group and column titles
- [ ] Option checkboxes in a vertical list
- [ ] Controller view model carries the Expand/Collapse enabled state; client-core test for it
- [ ] Manual check on a deployment: layout matches the spec at a typical popup size; every button works, including Refresh after a lost permission
- [ ] `npm run check` passes
