# 02: Browser streaming straight from the Drive API with a GAS token

Map: `.scratch/drive_downloader-map/map.md`

Type: research
Status: resolved
Blocked by: None

## Question

Can the frontend of a GAS web app (origin `*.googleusercontent.com`)
stream file bytes straight from the Drive API v3 using
`ScriptApp.getOAuthToken()`?

- CORS for `files.get?alt=media` with `Range` headers, and
  `files.export`, from that origin; streaming the response body
  (`ReadableStream`) for 20 GB+ without buffering.
- Which `oauthScopes` the manifest needs (least privilege, e.g.
  `drive.readonly`) and how to force the scope so the token carries it.
- Token lifetime; refreshing mid-transfer via `google.script.run` and
  resuming by `Range`.
- Resource-key folders and files (`X-Goog-Drive-Resource-Keys`),
  public-by-link and Shared-with-me access with the user's own token.
- `files.export` size cap (≈10 MB?) and the right MIME types for
  Docs/Sheets/Slides → docx/xlsx/pptx; which Native Files can't be
  exported at all.
- Drive API quotas and rate limits relevant to 1000 files or tens of GB
  per day.

Primary sources: Google Drive API v3 reference, Apps Script ScriptApp and
manifest docs, Google OAuth docs.

Research: branch `research/browser-direct-drive-api`, file `.scratch/drive_downloader-map/research/browser-direct-drive-api.md`

## Answer

Yes for normal files, only partly for Native Files. Live CORS preflights from a
`*-script.googleusercontent.com` origin allow `authorization`, `range` and
`x-goog-drive-resource-keys` on the Drive API and download hosts. `alt=media`
supports `Range`, with no documented size cap. Fetch in ranges of about
64–256 MB and stream each straight to disk; resume by `Range`.

Manifest `oauthScopes`: `drive.readonly` only; `getOAuthToken()` carries it
(no DriveApp comment trick). Expect a one-time "unverified app" consent screen.
The token is short-lived, so refresh it via `google.script.run` periodically
and on any 401, then retry the same range. Send resource keys in
`X-Goog-Drive-Resource-Keys`, and `supportsAllDrives=true`. Check
`canDownload` up front.

Native File export is capped at 10 MB and can't be resumed. Office MIME types
are in the research file. Vids, Forms, Sites and My Maps are unsupported.
`files.download` (a long-running job) is the documented route over 10 MB, but
whether the browser can fetch its link is unproven. Quotas are no concern
(325k units/min/user, 1 TB/day). A file flagged as abusive can't be downloaded
by non-owners.

To prove in the spike: redirects dropping `Authorization`, a stream in
progress surviving token expiry, the `files.download` and `exportLinks`
fetchability, and the over-10 MB error shape.
