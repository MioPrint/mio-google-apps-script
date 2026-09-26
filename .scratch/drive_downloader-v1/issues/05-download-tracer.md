# 05: Download (tracer)

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Pressing Download mirrors the Tree (normal files and folders) into the Target Folder's Source sub-folder, one file at a time in Tree order. The browser streams each file from the Drive API in byte ranges with the GAS token and writes it to disk; progress shows per file, per folder and overall; the Run ends with a summary. With "Skip existing files" checked (the only mode so far), re-running only fetches what's missing. No Pause/Stop and no retries yet: any fetch error fails the file with a reason.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Run states `idle` (no Tree or no folder) → `ready` → `running` → `finished`; Download enabled only in `ready`/`finished`
- [x] "Skip existing files" checkbox, checked every time the Disk Window opens (unchecking is handled in 10)
- [x] Starting a Run expands all folders and fetches a token; token refreshed before a chunk when older than 10 min and on a 401 (same range retried)
- [x] Folders created when the Run reaches them (only if empty in Drive or with a file below); existing sub-folders reused; a folder that can't be created fails its files ("folder could not be created")
- [x] Per-file exists check just before download: existing → "exists", skipped; a 0-byte local file (Drive file not 0 bytes) counts as missing
- [x] Normal files: `alt=media` in `Range` chunks (~64–256 MB) streamed into the writable
- [x] Finalizing phase: full bar and "finalizing…" while `close()` runs
- [x] Completion check: size on disk equals Drive size, else failed (retries come in 09)
- [x] Item Statuses pending → downloading (bar + "22.1 / 51.0 MB") → done / exists / failed (reason on hover); right-tree Results "writing", "saved"
- [x] Overall bar "settled / files · bytes done / bytes to transfer", bytes excluding exists/failed; folder "settled / files"
- [x] Status line: current Local Name path, bytes, attempt; Run summary by Item Status at the end
- [x] URL field, Read Drive, Location, option checkboxes locked while running
- [x] `finished`: inputs unlock, statuses stay; Download starts a new Run with statuses reset; Read Drive after finished → `ready`
- [x] Client-core tests with fake Drive and fake disk: full Run writes correct bytes, exists skip, 0-byte replaced, folder creation rules, token refresh on age and 401, size mismatch fails, state transitions, locked controls
- [x] `npm run check` passes
