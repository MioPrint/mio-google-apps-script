# 03: Read Drive

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** In the Disk Window the user pastes a Source Folder URL and presses Read Drive; GAS reads the Tree in chunks and the Disk Window shows it fully expanded with sizes, folder totals and collapsible folders. Bad URLs show one of four errors under the field. Shortcuts and Native Files are not handled yet (treated as plain Items with whatever Drive reports; later tickets refine them).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] URL parsing accepts `/drive/folders/<id>`, `/drive/u/N/folders/<id>`, `open?id=`, `?resourcekey=`, `usp=sharing`
- [ ] Tree reader start returns the Source Folder or an error kind: malformed, not found (covers no access / missing resource key), not a folder (decided by `files.get` mime type), empty; each shown as its own message under the URL field
- [ ] Tree reader step: one `files.list` per folder, `pageSize` 1000, `orderBy` `folder,name_natural,createdTime`, explicit `fields`, `supportsAllDrives`, `includeItemsFromAllDrives`, trashed excluded; stops at ~4.5 min and returns a continuation; the Disk Window calls again until done
- [ ] Calls needing `X-Goog-Drive-Resource-Keys` go through `UrlFetchApp` to the REST API; others use the Advanced Drive service
- [ ] Items carry id, resource key, parent, Drive name, mime type, size, created time, `canDownload`
- [ ] "Reading Drive…" progress while chunks load; Read Drive disabled meanwhile
- [ ] Drive tree view: Name (collapse arrow, icon, Drive name), Type (short label), Size, Status (all pending); fully expanded; folders show total size and "settled / files"; collapsed folders keep their totals; Expand all / Collapse all in the header
- [ ] Last Source Folder URL remembered (localStorage) and prefilled
- [ ] Backend tests via `loadApp` with mocked Drive/UrlFetchApp: every URL shape, every error kind, `orderBy` and flags passed, resource-key path, continuation when the budget runs out
- [ ] Client-core tests: Tree built from chunked reads, totals, collapse state, error display in the view model
- [ ] `npm run check` passes
