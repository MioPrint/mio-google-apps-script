# 12: Native Files and unsupported types

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Docs, Sheets and Slides are exported to .docx, .xlsx and .pptx, including ones over Drive's 10 MB export cap. Their sizes show as `?` until done and totals carry a `+`. Non-exportable Google types are "unsupported", and files whose owner blocked downloads or that are flagged as abusive fail with a reason.

**Blocked by:** 06, 09

**Status:** ready-for-agent

- [ ] Native Files: `files.export` to the Office MIME type; on 403 `exportSizeLimitExceeded`, the `files.download` LRO, then fetch its `downloadUri` with the bearer token (following the redirect)
- [ ] Native downloads have no size and no resume: every Attempt starts from 0; Pause discards bytes and Resume restarts without using an Attempt; progress shows bytes only, no percentage; no completion size check
- [ ] Office extension appended to the Local Name unless the name already ends in it (case-insensitive); Type label "Sheets → .xlsx"
- [ ] Size `?` until done, then real size on disk; folder and overall totals show `+` while any `?` remains below them
- [ ] Forms, Sites, My Maps, Vids and other non-exportable Google types → "unsupported", disabled box
- [ ] `canDownload` false → failed at Read Drive ("downloads disabled by owner"), disabled box
- [ ] Abuse-flag 403 on download → failed ("flagged as abusive"), no Attempts
- [ ] 0-byte rule: a 0-byte local file counts as missing for a Native File (unknown size)
- [ ] Backend tests: unsupported and blocked flags from the listing
- [ ] Client-core tests with fake Drive: export under cap, LRO fallback, restart-from-0 Attempts, Pause/Resume, `?`/`+` totals, extension append, abusive
- [ ] `npm run check` passes
