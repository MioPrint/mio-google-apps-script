# 18: Only real transient errors retry

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 93, 97; Run state machine "Attempts")

**What to build:** A file only uses up Attempts on failures that may pass: a network error, 5xx, 429, a 401 that survives a token refresh, or a failed token fetch. Every other Drive refusal fails the file at once, on its first Attempt, with a readable reason, and the Run moves on. That covers a 400, a 403 with an unlisted reason, and a 403 whose body isn't JSON.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Error classification follows the spec's lists exactly; nothing unrecognised is transient
- [x] A permanent failure's reason says what Drive answered (status plus reason, or plus a short body excerpt when the body isn't JSON)
- [x] The Native File path is covered too: the export, the `files.download` LRO start, its polling and the `downloadUri` fetch
- [x] Client-core tests on the fake Drive: 400, 403 other reason and non-JSON 403 fail after one Attempt with their reason; network, 5xx, 429 (with `Retry-After`) and a lasting 401 still retry as before
- [x] `npm run check` passes
