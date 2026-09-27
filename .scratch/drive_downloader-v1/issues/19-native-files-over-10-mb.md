# 19: Native Files over 10 MB

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 38, 113; Run state machine "Byte path per file kind")

**What to build:** A Google Sheet, Doc or Slides file over Drive's 10 MB export cap downloads as its Office file instead of failing after every Attempt. The first acceptance pass saw this failure on a Sheet. The export falls back to the `files.download` LRO and then fetches its `downloadUri`, and that path breaks somewhere.

**Blocked by:** 18 (a refusal then fails on the first Attempt with Drive's answer as its reason, which makes diagnosis quick)

**Status:** ready-for-agent

- [x] Diagnose first. Ask the user to rerun the over-10 MB Sheet on a deployment that includes 18, then report two things. First, the failed chip's hover reason. Second, the DevTools Network rows for the export, `files.download`, `operations` and `downloadUri` requests (status, redirect, CORS error). Record the findings in this ticket's Comments
- [x] Candidates to check against the findings:
  - CORS or redirect failure on the `docs.google.com` `downloadUri`;
  - the resource-key header sent to that host;
  - a non-JSON 403;
  - LRO polling;
  - an `exportLinks` fallback, if the LRO path can't work from the browser
- [x] Fix so the over-10 MB Native File is written to disk with its Office extension and shows its real size when done
- [x] Client-core test reproducing the diagnosed failure on the fake Drive, then passing
- [x] Spec's byte-path decision updated with the root cause and fix
- [x] `npm run check` passes

## Comments

Rerun on a deployment with ticket 18: the over-10 MB Sheet failed on Attempt
1 with no further Attempts (not "after every Attempt" as first assumed).

Hover reason: `Drive answered HTTP 400 (invalid)`.

`files.export` correctly returns 403 `exportSizeLimitExceeded` (reason
matches exactly), so the LRO fallback does start. The failure is the very
next request, `POST /files/{id}/download?mimeType=...&supportsAllDrives=true`
(no body), which Drive answers:

```
400 {
  "error": {
    "code": 400,
    "message": "Invalid JSON payload received. Unknown name \"supportsAllDrives\": Cannot bind query parameter. Field 'supportsAllDrives' could not be found in request message.",
    "errors": [{ "reason": "invalid", ... }],
    "status": "INVALID_ARGUMENT"
  }
}
```

Root cause: unlike `files.export`/`files.get`/`files.list`, the
`files.download` LRO-start endpoint's request message has no
`supportsAllDrives` field at all - sending it is a hard 400, and 400 isn't
in the transient set, so the file failed permanently on Attempt 1 and
`operations`/`downloadUri` were never reached.

Fix: drop `&supportsAllDrives=true` from the `files.download` start URL
only ([run.js.html](../../../drive_downloader/src/frontend/run.js.html))

- `export` keeps it, since that call does accept and need it for Shared
  Drive files.
