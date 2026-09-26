# 08: Pause, Resume, Stop

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** During a Run the user can Pause (the current file freezes mid-transfer), Resume (it continues from the same byte) and Stop (the current file is aborted, no partial new file is left, the Run ends). Disk errors pause the Run with a message. Closing either window during a Run asks first. The screen can be kept awake.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Run states add `paused` and `stopping`; four separate buttons Download / Pause / Resume / Stop with correct enabled states
- [ ] Transferring: Pause aborts the fetch and keeps the writable; Resume sends `Range` from bytes written
- [ ] Transferring: Stop calls `writable.abort()`; a new file is removed (`removeEntry`); the file goes back to pending; files not reached stay pending; Run ends (`finished` with summary)
- [ ] Finalizing: Pause shows "Pausing…" and pauses before the next file; Stop enters `stopping` ("Finishing current file…"), keeps the file as done, then ends
- [ ] "Paused at…" in the status line
- [ ] Disk errors (`QuotaExceededError`, permission lost, Target Folder moved/deleted) pause the Run with a message; the current file keeps its bytes; Resume retries and re-requests permission on that click
- [ ] "Leave site?" on the Disk Window and the Launcher Page while running or paused; leaving ends the Run
- [ ] "Keep screen awake during download" checkbox, on by default, remembered, usable during a Run; Wake Lock held while `running`, released on pause/finish, re-requested on visibility return
- [ ] Client-core tests: every Pause/Stop row above, disk-error pause and resume, Stop cleanup on the fake disk, wake-lock acquire/release on a fake
- [ ] `npm run check` passes
