# 06: Write the v1 spec and build tickets

Map: `.scratch/drive_downloader-map/map.md`

Type: task
Status: open
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
