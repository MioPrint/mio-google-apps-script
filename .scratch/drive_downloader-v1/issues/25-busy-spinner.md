# 25: Busy spinner

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 6, 119, 120, 121; Disk Window core modules "Busy indicator", "Status panel")

**What to build:** A spinner right of the "Drive Downloader" title, with no text, shows the Disk Window is busy. It spins during Read Drive, any Target Folder scan (after picking a folder - not while the picker is open -, Refresh, the scan on opening with a remembered folder, Download's Source sub-folder re-read) and a Run from Download until it ends (running, retry backoff while online, Pausing…, Finishing current file…). It becomes ⏸️ while the Run is paused (by Pause or a disk error) or while the current file waits for the network; offline, the status panel reads "Network lost — waiting for it to come back…" with the file's path and bytes. No spinner while the overwrite confirm waits, nor when idle, ready or finished.

**Blocked by:** 24

**Status:** ready-for-agent

- [ ] Controller view model exposes the busy indicator: spinning, paused or none
- [ ] Offline wait shows ⏸️ and the network-lost text in the status panel; backoff while online keeps spinning with the retry countdown
- [ ] The header holds only the title and the indicator
- [ ] Client-core tests: indicator through Read Drive (success and error), each scan trigger, a Run (running, backoff, offline, Pause, disk-error pause, stopping, finished), the overwrite confirm (none) and Cancel
- [ ] Manual check on a deployment: spinner and ⏸️ through Read Drive, Local Target Folder, Refresh, Download, Pause/Resume, Wi-Fi off/on
- [ ] `npm run check` passes
