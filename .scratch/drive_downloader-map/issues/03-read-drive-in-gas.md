# 03: Reading the Tree in GAS

Map: `.scratch/drive_downloader-map/map.md`

Type: research
Status: resolved
Blocked by: None

## Question

What is the best GAS-side way to read a Source Folder into a Tree of up to
1000 Items, including Shortcuts, within the 6-minute execution limit?

- `DriveApp` versus the Advanced Drive Service (v3) versus `UrlFetchApp`
  to the REST API: speed, page sizes, fields available (size, mimeType,
  `shortcutDetails`, `resourceKey`), and Shared Drive support
  (`supportsAllDrives` / `includeItemsFromAllDrives`).
- How Shortcuts to folders and files resolve, including targets the user
  can't access.
- Every Drive folder-URL shape (`/drive/folders/<id>`, `/drive/u/N/…`,
  `?resourcekey=`, `open?id=`, `usp=sharing`) and how to tell a file URL
  from a folder URL.
- Error signatures for not found, no access and resource-key missing.
- Relevant daily quotas.

Primary sources: Apps Script DriveApp and Advanced Drive Service docs,
Drive API v3 reference, Apps Script quotas page.

Research: branch `research/read-drive-in-gas`, file `.scratch/drive_downloader-map/research/read-drive-in-gas.md` 

## Answer

Use the Advanced Drive Service (v3). Walk folder by folder, one
`files.list` per folder (`pageSize` 1000), always passing `fields`,
`supportsAllDrives` and `includeItemsFromAllDrives`. Resource keys go in
the `X-Goog-Drive-Resource-Keys` header (the method's last argument). 1000
Items should fit in one execution, but stop at about 4.5 minutes and hand
the unfinished folders back to the frontend to call again. DriveApp is out;
UrlFetchApp to the REST API is the fallback.

`shortcutDetails` comes free in the listing. A Shortcut to a file needs
one `files.get` to get its size, and a 404 on that call means failed. Tell a
folder URL from a file URL by `files.get` on its type, not by URL shape.
Not found, no access and a missing resource key are all 404 `notFound` and
can't be told apart, so one error message covers them. Quotas are no
concern at this scale.

Open for the spec: Drive's sibling order (it decides who gets `name
(2).ext`), whether a Shortcut shows its own name or its target's, and what
size to show for Native Files. To verify in the spike: public-by-link
folders never opened, exact error text, and real timing for 1000 Items.
