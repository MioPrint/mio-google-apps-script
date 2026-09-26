# 09: Attempts and retries

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Transient failures no longer fail a file: it retries with backoff, resuming from the last byte, and only five failures in a row without progress fail it. Permanent failures fail at once with a reason. A dropped network waits for the connection to come back.

**Blocked by:** 08

**Status:** ready-for-agent

- [x] Transient: network error, 5xx, 429, a 401 surviving a refresh, a failed token fetch. Permanent: 403 `fileNotDownloadable`, abuse flag, 404, `canDownload` false → failed at once with a reason, no Attempts used
- [x] Five Attempts without progress; an Attempt that wrote new bytes resets the count
- [x] Waits before Attempts 2–5: 2 s, 10 s, 30 s, 60 s; `Retry-After` on 429/503 honoured, capped at 5 min; "retry 2/4 in 10 s" in the status line and on hover
- [x] Attempts 2–4 resume from bytes written; Attempt 5 restarts from 0 (truncate)
- [x] Size mismatch after finalizing is a transient failure; next Attempt restarts from 0
- [x] `navigator.onLine` false → wait for `online` without using an Attempt
- [x] Waiting to retry: Pause cancels the wait and Resume starts the next Attempt at once; Stop behaves as in transferring
- [x] 401 → refresh → same range, no Attempt used (kept from 05)
- [x] Client-core tests with fake Drive, fake timers and fake online status: each error class, reset on progress, resume vs restart, backoff and `Retry-After` cap, offline wait, Pause/Stop while waiting
- [x] `npm run check` passes
