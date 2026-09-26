# 06: Write the v1 spec and build tickets

Map: `.scratch/drive_downloader-map/map.md`

Type: task
Status: resolved
Blocked by: 03, 04, 05, 07, 08, 09, 10

## Question

With the byte path proven, Tree reading decided and the layout settled,
turn the map's requirements and Decisions so far into
`.scratch/drive_downloader-v1/spec.md` via `/to-spec`, then into build
tickets via `/to-tickets`. Also update `drive_downloader/README.md`
(purpose, scopes). HITL: the user invokes both skills. The spec's
testing section settles Acceptance: which real Source Folder(s) prove the
destination (a 20 GB+ test file must exist in Drive), plus the spike's
unproven items (public-by-link folder, bad-URL error text, several Google
accounts signed in, Disk Window closing with the Launcher Page).

Resolved when the spec and tickets exist. Then the map closes after the
build (`/implement`), once acceptance on a real Source Folder passes.

## Comments

- 2026-09-26: README purpose and scopes updated. Fog graduated first:
  "Run state model" and "Target Folder scan" now block this ticket;
  Acceptance folded into the spec (see Question).
- 2026-09-26, from "Target Folder scan": the prototype's right tree holds
  (whole Target Folder), plus a Refresh link in its header and a
  "Reading Target Folder… N items" status; see that ticket for re-read
  triggers, case handling and the per-file check.

## Answer

Resolved 2026-09-26. Spec: `.scratch/drive_downloader-v1/spec.md`
(`ready-for-agent`). Two test seams, approved by the user: the backend
through `loadApp` with mocked Drive/UrlFetchApp/ScriptApp, and the Disk
Window core (naming, Target Folder scan, merge, Run engine, controller)
through a new client-partial loader with fake Drive, disk and server
ports; DOM not unit-tested. Keeping logic client-side departs from the
AGENTS.md "thin client" rule, to be recorded as an App ADR. Acceptance is
the spec's six-part manual checklist on `/exec`, run on test Source Folders
the user prepares (20 GB+ file; ~1000 mixed Items; public-by-link; bad
URLs; several accounts signed in; window closing).

Build tickets (`.scratch/drive_downloader-v1/issues/`), approved as is:
01 client-core test harness and ADR → 02 Launcher Page and Disk Window
shell → 03 Read Drive → 04 Location and Target Folder tree → 05 Download
(tracer) and 06 Local Names → 07 Selection, 08 Pause/Resume/Stop → 09
Attempts and retries → 10 Overwrite, 11 Shortcuts, 12 Native Files → 13
User docs and deploy README → 14 Acceptance (HITL). The map closes when 14
passes.
