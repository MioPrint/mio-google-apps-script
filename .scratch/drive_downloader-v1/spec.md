# Spec: drive_downloader v1

Labels: ready-for-agent

Map: `.scratch/drive_downloader-map/map.md` (requirements and decisions;
each ticket there holds the detail behind a decision below).

Revised 2026-09-27 after the first acceptance pass on the deployed App
(ticket 14's Comments): up-front authorization, a Skip-existing preview,
Tree toggles during a Run, stricter retries, the Native File over 10 MB
fix, and a new Disk Window layout, labels and font. Stories 108 onward
are new; changed stories keep their numbers.

## Problem Statement

The user needs to copy whole Google Drive folders to the local disk: up to
1000 files, single files of 20 GB+, nested sub-folders, Shortcuts and
Native Files (Docs, Sheets, Slides). Drive's own "Download" zips folders,
splits big ones into several archives, fails on very large content, drops
Shortcuts, and can't carry on where an earlier attempt stopped. There is
no way to see, file by file, what was copied, what already exists
locally, and what failed. The user wants this as a Google Apps Script
web app only: no external hosting, no browser extension, no installed
tool.

## Solution

drive_downloader is a GAS web app for desktop Chrome, for one user. Its
URL opens the **Launcher Page**: an "Open Drive Downloader" button above
user documentation. The button opens the **Disk Window**, a popup that
holds the whole App. There the user:

1. pastes a Source Folder URL and presses **Read Drive**: GAS reads the
   **Tree** (fully expanded, with sizes, Shortcuts followed) and the
   Disk Window shows it;
2. presses **Local Target Folder** and picks a Target Folder; the Disk
   Window reads it and shows it beside the Tree, row by row, with what the
   Run will do to each local item;
3. adjusts the options (spaces → underscores, Shortcut target names, Skip
   existing files, Keep screen awake) and unticks anything not wanted;
   with Skip existing files on, files already on disk show as "exists"
   before the Run;
4. presses **Download**: the Source Folder is mirrored as a sub-folder of
   the Target Folder, one file at a time. The browser streams each file
   straight from the Drive API with a GAS-issued OAuth token, in byte
   ranges, and writes it to disk. Pause, Resume and Stop work mid-file,
   transient failures resume from the last byte, and nothing is ever
   zipped or deleted.

Every Item shows its Item Status, folders show totals, and an overall bar
shows files and bytes.

## User Stories

### Launcher Page and Disk Window

1. As the user, I want the App's URL to open a Launcher Page with an "Open Drive Downloader" button, so that I have one obvious way in.
2. As the user, I want the Launcher Page to carry user documentation (before you start, the four steps, Item Statuses, names and sizes, skip versus overwrite, Shortcuts, Native File exports, limits, sleep settings), so that I can learn the App without the developer README.
3. As the user, I want a note on the Launcher Page to keep the tab open, so that I don't close the Disk Window by accident.
4. As the user, I want the Disk Window to open as a large popup window, so that the Tree has room.
5. As the user, I want Open to bring an already open Disk Window to the front instead of opening a second one, so that I never have two Runs fighting over the disk.
6. As the user, I want the Disk Window header to say the docs are on the Launcher Page tab (no Help link: a popup can't switch Chrome to that tab), so that I know where to find them.
7. As the user, I want the Disk Window to close when the Launcher Page closes or reloads, so that no orphan window is left unable to reach GAS.
8. As the user, I want Chrome's "Leave site?" prompt when I close or reload either window during a Run, so that I don't end a Run by accident.
9. As the user, I want a Run to simply end if I leave anyway, so that the next Run with "Skip existing files" carries on from the files already done.

### Source Folder and Read Drive

10. As the user, I want to paste a Drive folder URL, including `/u/N/`, `?resourcekey=`, `open?id=` and `usp=sharing` forms, so that any link I copied works.
11. As the user, I want the last Source Folder URL remembered, so that I can re-run the same folder without pasting it again.
12. As the user, I want a clear error under the URL field for a malformed URL, so that I can fix a typo.
13. As the user, I want one "not found or no access" error for folders I can't reach, so that I know to check the link or my account.
14. As the user, I want an error when the URL points at a file rather than a folder, so that I know the App mirrors folders only.
15. As the user, I want an error when the Source Folder is empty, so that I'm not left looking at a blank Tree.
16. As the user, I want Source Folders in My Drive, Shared with me, public-by-link (with a resource key) and Shared Drives to work, so that I can mirror anything I can open.
17. As the user, I want Read Drive to show the whole Tree, fully expanded, with sizes, so that I see everything before downloading.
18. As the user, I want Read Drive to work on 1000 Items without timing out, so that large folders are not a problem.
19. As the user, I want to see that reading is in progress, so that I know the App is working.
20. As the user, I want siblings shown folders first, then in natural name order, oldest first among equal names, so that the order is predictable and matches the numbering.

### Tree display

21. As the user, I want the Tree's columns to be Name, Type, Size and Status, so that I can scan each Item at a glance.
22. As the user, I want short Type labels ("JPEG", "Sheets → .xlsx", "↪ MP4 video"), so that I know what each file becomes.
23. As the user, I want folders to show their total size and "settled / files", so that I see progress per folder.
24. As the user, I want every folder to collapse and expand, with "Expand all" and "Collapse all" buttons in the row with Download, Pause, Resume and Stop, so that I can navigate a big Tree with controls that look and work like the others.
25. As the user, I want a collapsed folder to still show its totals, so that collapsing hides nothing important.
26. As the user, I want starting a Run to expand all folders, so that I can watch every file.
27. As the user, I want a downloading file to show a bar with "22.1 / 51.0 MB", with full detail on hover, so that I see its progress.
28. As the user, I want failure reasons, the Shortcut's other name and the overwrite note on hover, so that the rows stay compact.

### Shortcuts

29. As the user, I want Shortcuts to files and folders followed and mirrored as what they point at, so that linked content is copied too.
30. As the user, I want a Shortcut's target downloaded once per place it appears, so that the local copy mirrors the Drive layout.
31. As the user, I want a Shortcut back into its own ancestry marked "loop" and skipped, so that the read never recurses forever.
32. As the user, I want a ↪ badge on Shortcuts, so that I can tell them from real Items.
33. As the user, I want a "Use Shortcut target names" checkbox (off by default, remembered) that picks the Shortcut's own name or its target's for both the Tree label and the Local Name, so that I choose which name I keep.
34. As the user, I want the target's extension appended when the name used lacks it, so that `Holiday video` → `clip.mp4` becomes `Holiday video.mp4`.
35. As the user, I want a Shortcut whose target I can't reach marked failed with a reason, so that I know why it was skipped.

### Native Files and unsupported types

36. As the user, I want Docs, Sheets and Slides exported to .docx, .xlsx and .pptx, so that I get usable local files.
37. As the user, I want the Office extension appended unless the name already ends in it, so that `Budget.xlsx` isn't renamed `Budget.xlsx.xlsx`.
38. As the user, I want Native Files over Drive's 10 MB export cap downloaded anyway, so that big spreadsheets aren't lost.
39. As the user, I want a Native File's size shown as `?` until it's done, then its real size on disk, so that no guessed size misleads me.
40. As the user, I want folder and overall totals to show a `+` suffix while any `?` remains below them, so that I know the total is a lower bound.
41. As the user, I want a downloading Native File to show bytes received with no percentage, so that the display stays honest.
42. As the user, I want Forms, Sites, My Maps, Vids and other non-exportable types marked "unsupported", so that I know they can't be mirrored.
43. As the user, I want files whose owner disabled downloads marked failed ("downloads disabled by owner") right after Read Drive, so that I know before pressing Download.
44. As the user, I want files flagged as abusive marked failed ("flagged as abusive") when their download is refused, so that the reason is clear.

### Selection

45. As the user, I want a checkbox on every file and folder, all ticked after Read Drive (except files shown as "exists", see 110), so that I can leave things out.
46. As the user, I want a folder's checkbox to tick or clear everything below it and show a mixed state when partly ticked, so that selecting a branch is one click.
47. As the user, I want unticked files to get the status "unselected" and be left out of the totals, so that the bars reflect what I asked for.
48. As the user, I want files that can't be downloaded (unsupported, loop, blocked by owner) and, with "Skip existing files" on, files that already exist locally to have a disabled checkbox, so that I can't select them by mistake.
49. As the user, I want a fully unticked branch to create no local folders, so that nothing empty is left behind.

### Local Names

50. As the user, I want illegal filename characters replaced with `+`, so that every Drive name can be written to disk.
51. As the user, I want a "Replace spaces with underscores" checkbox (remembered) covering files and folders, so that I get shell-friendly names if I want them.
52. As the user, I want duplicate Local Names among siblings (ignoring case, files and folders together) numbered `name (1).ext`, `name (2).ext`…, in sibling order, skipping numbers a real sibling already has, so that no file overwrites another.
53. As the user, I want the number placed before the last extension (`archive.tar (1).gz`) and at the end for folders (`Docs (1)`), so that files still open with the right program.
54. As the user, I want Local Names numbered among all Drive siblings, selected or not, so that a file's Local Name doesn't change when I untick its siblings.
55. As the user, I want the Tree to show Drive names and the Target Folder tree to show Local Names, so that I see both.

### Choosing the Target Folder

56. As the user, I want a "Local Target Folder" button that opens Chrome's folder picker, starting in Downloads the first time and at the remembered folder after that, so that picking is quick.
57. As the user, I want "Target: 📁 <folder name>" or "No folder chosen" beneath it, so that I know where files will go.
58. As the user, I want the chosen folder remembered across visits, with permission re-confirmed each visit, so that I don't pick it every time.
59. As the user, I want Download disabled until a folder is chosen and read, so that a Run never starts without a destination.
60. As the user, I want the Launcher Page docs to explain that Chrome refuses Downloads itself and I should pick or create a sub-folder, so that the refusal doesn't surprise me.
61. As the user, I want the Source Folder mirrored as a sub-folder of the Target Folder, reusing an existing sub-folder of the same Local Name (ignoring case), so that repeated Runs land in the same place.
62. As the user, I want the whole Target Folder read recursively when I choose it, with "Reading Target Folder… N items", so that I see what is already there.
63. As the user, I want the Target Folder shown beside the Tree in aligned rows (Name, Size, Modified, Result), each Drive Item next to the local item it becomes, with hatched cells where one side has nothing, so that I see the mapping at a glance.
64. As the user, I want Results for folders ("matched", "new folder") and files ("new", "keep", "overwrite", "writing", "saved", "overwritten", "kept", "not written", "local only", "untouched", "in the way"), so that I know what the Run will do and did to each local item.
65. As the user, I want local-only items listed after a folder's matched children, folders first, natural order, and nothing hidden, so that I see the disk as it really is.
66. As the user, I want local-only folders to start collapsed and matched folders expanded, so that the view focuses on the mirror.
67. As the user, I want a Refresh button beside Local Target Folder (when a folder is chosen, no scan is running and no Run is active) that reads the whole Target Folder again, so that I can pick up changes I made outside the App.
68. As the user, I want toggling naming options or "Skip existing files" to recompute Results without re-reading the disk, so that toggling is instant.
69. As the user, I want every disk operation on a matched item to use the on-disk name, so that an overwrite keeps its case and case-sensitive disks don't get a second file.
70. As the user, I want a failed Target Folder read (permission lost, folder moved or deleted) to show a message under the Local Target Folder row, empty the right tree and keep Download disabled until I re-pick or Refresh succeeds, so that I never write to a folder the App can't see.

### Existing files and overwriting

71. As the user, I want a "Skip existing files" checkbox that is checked every time the Disk Window opens, so that the safe choice is the default.
72. As the user, with it checked, I want existing files with the same Local Name marked "exists" (already before the Run, see 110) and skipped, so that re-running a folder only fetches what's missing.
73. As the user, with it unchecked, I want existing files overwritten after one "N existing files will be overwritten. Continue?" confirm, so that I can refresh a mirror on purpose.
74. As the user, I want files that will be overwritten shown as pending with an "overwrites" note on hover, so that I see them before confirming.
75. As the user, I want an overwritten file's old copy to survive any failure, Stop or closed window, so that overwriting never loses data.
76. As the user, I want a 0-byte local file treated as missing (when its Drive file isn't 0 bytes) and replaced with no confirm, so that a crash leftover doesn't block the file.
77. As the user, I want a local folder where a file should go (or the reverse) to count as "exists" when skipping and fail with "a folder named X is in the way" when overwriting, so that nothing is deleted to make room.
78. As the user, I want a file that appeared on disk after I pressed Download treated as "exists" even with skipping off, so that nothing I wasn't warned about is overwritten.
79. As the user, I want nothing on disk ever deleted, except the partial new file a Stop leaves, so that the App can't destroy my data.

### Running

80. As the user, I want files processed one at a time in Tree order (depth-first), so that progress is easy to follow and the disk isn't thrashed.
81. As the user, I want each file checked for existence just before it downloads, so that the decision reflects the disk as it is right then.
82. As the user, I want big files fetched in byte ranges and streamed straight to disk, so that 20 GB+ files never pass through memory or GAS.
83. As the user, I want a status line with the current file's Local Name path, bytes and Attempt, so that I know exactly what is happening.
84. As the user, I want an overall bar with "settled / files · bytes done / bytes to transfer", counting only bytes this Run will transfer, so that the bar reaches 100% when the Run is done.
85. As the user, I want a "finalizing…" state with a full bar while Chrome finishes writing a big file (about 45 s at 20 GB), so that I don't think the App has frozen.
86. As the user, I want Pause to freeze the current file mid-transfer and Resume to continue from the same byte, so that I can free the network without losing progress.
87. As the user, I want Stop to abort the current file, leave no partial new file (an overwritten file stays as it was), and end the Run, so that the disk is left clean.
88. As the user, I want Pause or Stop during finalizing to wait for the file to finish ("Pausing…", "Finishing current file…"), so that no file is left half-finalized.
89. As the user, I want the URL field, Read Drive, Local Target Folder, Refresh, the option checkboxes and the selection checkboxes locked while a Run is running or paused, so that the plan can't change under a Run.
90. As the user, I want "Keep screen awake" usable during a Run, so that I can change my mind mid-Run.
91. As the user, I want a Run summary by Item Status when the Run ends, so that I see at once what failed.
92. As the user, I want Download after a finished Run to start a new Run with statuses reset, so that I can re-run to pick up failures.

### Failures, Attempts and recovery

93. As the user, I want transient failures (network, 5xx, 429, a 401 that survives a token refresh, a failed token fetch) to retry automatically, so that a flaky network doesn't fail a big file.
94. As the user, I want up to five Attempts without progress per file (one try, three resuming from the last byte, one from the start), with an Attempt that wrote new bytes giving the file its full count back, so that long transfers survive many brief outages.
95. As the user, I want waits of 2 s, 10 s, 30 s and 60 s before retries, honouring `Retry-After` up to 5 min, and "retry 2/4 in 10 s" shown, so that retries don't hammer Drive and I see them coming.
96. As the user, I want the App to wait for the network to come back while offline without using Attempts, so that a dropped Wi-Fi doesn't fail files.
97. As the user, I want permanent failures (not downloadable, 404, blocked, abusive, and any other 4xx than 401 and 429) to fail the file at once with a reason and move on, so that Attempts aren't wasted.
98. As the user, I want the token refreshed before a chunk when it's older than 10 minutes and on any 401, retrying the same range, so that 20 GB transfers outlive the token.
99. As the user, I want each file's size on disk checked against Drive after finalizing, with a mismatch retried from the start, so that truncated files never count as done.
100.  As the user, I want disk errors (disk full, permission lost, Target Folder moved or deleted) to pause the Run with a message, keeping the current file's bytes, and Resume to retry (asking for permission again), so that I can free space and carry on.
101.  As the user, I want a folder that can't be created to fail all its files ("folder could not be created"), so that the Run carries on with the rest.
102.  As the user, I want no "retry failed" button; a new Run with "Skip existing files" retries only what's missing, so that the UI stays simple.

### Sleep

103. As the user, I want a "Keep screen awake during download" checkbox, on by default and remembered, that holds a Screen Wake Lock while the Run is running, so that the computer doesn't sleep mid-Run.
104. As the user, I want the Launcher Page docs to explain setting the computer not to sleep if I turn it off, and that a lid close still stops a Run, so that I know the limits.

### Developer

105. As the developer, I want the GAS backend stateless per call (Tree reading in chunks with continuation, token), so that no execution nears the 6-minute limit.
106. As the developer, I want all Disk Window logic behind swappable Drive, disk and GAS parts, so that the Run, naming and merge can be tested in Node without a browser.
107. As the developer, I want the deploy steps (clasp create/push, scopes, advanced service) in the README, so that I can deploy without guessing.

### Added after the first acceptance pass

108. As the user, I want the App to ask for Google authorization when the Launcher Page opens, so that Read Drive never fails for lack of consent.
109. As the user, if Read Drive still hits missing authorization, I want a message telling me to authorize in the Launcher Page tab and press Read Drive again, so that I know where the consent dialog went.
110. As the user, with "Skip existing files" checked, I want Drive files that already exist locally shown as "exists" before I press Download, unticked, with a disabled checkbox and counted as settled, so that I see up front what the Run will skip.
111. As the user, I want unticking "Skip existing files" to give those files back the tick state they had before, so that toggling the option never loses my selection.
112. As the user, I want folders to expand and collapse while a Run is transferring, not only while paused, so that I can look around a big Tree without pausing.
113. As the user, I want a Google Sheet (or Doc, Slides) larger than 10 MB to download, not fail after every Attempt, so that big spreadsheets really aren't lost (38).
114. As the user, I want Read Drive, Local Target Folder and Refresh side by side in one row under the URL field, so that the two setup steps sit together.
115. As the user, I want the four option checkboxes in a vertical list, so that each is easy to read and tick.
116. As the user, I want the URL field only about as wide as a Drive folder URL, so that an empty box doesn't dominate the window.
117. As the user, I want the Launcher Page and the Disk Window in a monospace font, buttons and fields included, so that names, sizes and columns line up.

## Implementation Decisions

### Architecture

- GAS serves both halves; nothing is hosted elsewhere. Manifest: V8,
  Europe/Berlin, `executeAs: USER_DEPLOYING`, `access: MYSELF`; explicit
  `oauthScopes` `drive.readonly` and `script.external_request`; the
  Advanced Drive service v3 enabled.
- **Authorization up front.** Serving the Launcher Page needs no scope,
  so consent used to come only on the first Read Drive, and Google's
  "Authorization required" dialog opened in the Launcher Page (where
  `google.script.run` really runs), not the Disk Window. `doGet` now
  requires all manifest scopes before serving (Apps Script's
  `ScriptApp.requireAllScopes` with full auth mode), so consent happens
  on opening the App. Verify the call exists and behaves this way in a
  web app. If it doesn't, the README gains an "authorize once" step
  instead.
- **The whole App lives in the Disk Window.** The GAS iframe cannot show
  the folder picker (Chrome forbids it in cross-origin sub-frames). The
  Launcher Page (GAS iframe) calls `window.open('/blank')` on its own
  sandbox origin, then writes the Disk Window document into that
  same-origin, unsandboxed popup. The Disk Window document is embedded in
  the Launcher Page as escaped JSON (the spike's approach). The sandbox
  host is stable across reloads, `/dev` → `/exec` and new versions, so the
  folder handle stored in IndexedDB survives.
- The Disk Window reaches GAS only through the Launcher Page: the Launcher
  Page exposes a promise-returning bridge over `google.script.run` on
  `window`, and the Disk Window calls it via `window.opener`. The Disk
  Window closes itself if it finds the opener gone; the Launcher Page
  closes it on unload.
- **Departure from the repo rule "keep client logic thin"**: bytes and
  disk access can only happen in the browser, so the Run, naming, Target
  Folder scan and merge live client-side. Record this as an ADR in the
  App's own `docs/adr/`.

### Backend modules (GAS, stateless)

- **Launcher**: `doGet` requires all scopes, then serves the Launcher
  Page; `include` pulls partials; the Disk Window document is rendered
  from its own template and embedded.
- **Tree reader**: public interface of two calls:
  - start(url) → the Source Folder (id, name, resource key) plus a
    continuation, or an error kind: `malformed`, `notFound` (covers no
    access and missing resource key; Drive returns the same 404),
    `notAFolder`, `empty`. URL parsing accepts `/drive/folders/<id>`,
    `/drive/u/N/folders/<id>`, `open?id=`, `?resourcekey=`, `usp=sharing`;
    folder vs file is decided by `files.get` on the mime type, not URL
    shape.
  - step(continuation) → a batch of Items plus the next continuation
    (empty when done). One `files.list` per folder, `pageSize` 1000,
    `orderBy` `folder,name_natural,createdTime`, explicit `fields`,
    `supportsAllDrives` and `includeItemsFromAllDrives`, trashed excluded.
    Stops at about 4.5 min of wall time and returns the unwalked folders
    in the continuation; the frontend calls again. (1000 Items took 15 s
    in the spike.)
  - Items carry: id, resource key, parent, Drive name, mime type, size
    (none for Native Files), created time, `canDownload`, and for
    Shortcuts the Shortcut's own name plus the target's id, name, mime
    type, size and resource key (one `files.get` per Shortcut to a file).
    The reader flags, per Item: `loop` (Shortcut target in its own
    ancestry), `unsupported` (non-exportable Google types), `blocked`
    (`canDownload` false), `unreachable` (Shortcut target 404). It does
    not compute Local Names.
  - Calls needing `X-Goog-Drive-Resource-Keys` go through `UrlFetchApp`
    to the REST API (the advanced service takes no headers); the rest use
    the advanced service.
- **Token**: returns `ScriptApp.getOAuthToken()`.

### Disk Window core modules (client partials, tested in Node)

Each is a plain script partial; helpers shared across partials are
declared with `/* global */`. The core reaches the outside world only
through injected ports:

- **Drive port**: `fetch` against the Drive API (`files.get alt=media`
  with `Range`, `files.export`, `files.download` LRO and its
  `downloadUri`), with the bearer token and resource-key header.
- **Disk port**: the File System Access directory handle surface used
  (`values()`, `getDirectoryHandle`, `getFileHandle`, `createWritable`,
  `seek`, `truncate`, `write`, `close`, `abort`, `removeEntry`,
  `getFile`, `queryPermission`, `requestPermission`).
- **Server port**: the Tree reader and token calls through the opener
  bridge.
- Browser odds and ends (localStorage, IndexedDB handle store, Wake Lock,
  `navigator.onLine`/`online`, timers, `showDirectoryPicker`) are passed
  in too, so tests can fake them.

Modules:

- **Naming**: Tree + options (spaces → `_`, Shortcut target names) →
  Local Name per Item. Illegal characters → `+`; Office extension
  appended for Native Files unless present (case-insensitive); target
  extension appended to Shortcut names lacking it; uniqueness on the
  final Local Name, ignoring case, across files and folders, among all
  Drive siblings (selected or not); every duplicate numbered from `(1)` in
  sibling order, skipping numbers a real sibling holds; the number goes
  before the last extension, at the end for folders.
- **Target Folder scan**: reads a directory recursively into a local
  tree (name, kind, size, modified), reporting progress counts; also
  re-reads a single sub-folder.
- **Merge**: Tree + Local Names + local tree + selection + "Skip existing
  files" → aligned rows with Results, the Source sub-folder match, the
  overwrite count, and per-Item plan (download / exists / overwrite / in
  the way / replace empty). Matching by Local Name ignoring case; with
  several local matches, exact case wins, else first in name order, the
  rest local-only. A 0-byte local file (Drive file not 0 bytes, or
  unknown) is missing, not counted as an overwrite.
- **Skip-existing preview** (Merge and controller): with "Skip existing
  files" on, the set of Drive files that would be skipped as exists is
  derived on every re-merge: files with a real local match (0-byte
  leftovers excluded) and files with a local folder in their place (77).
  It is never written into the selection state. Those files show Item
  Status "exists", an unticked disabled checkbox, and count as settled
  with their bytes left out of the totals; a Native File shows its local
  size. Folder tick and mixed states, and a folder checkbox click, ignore
  them. While shown as "exists", "exists" wins over "unselected"; with
  the option off, the set is empty and every file shows its own tick
  state again. The Target Folder side still shows "keep". The Run is
  unchanged: it resets statuses to pending and its own per-file check
  sets "exists" again.
- **Run engine**: the state machine below, one file at a time in Tree
  order, creating folders when reached (only if empty in Drive or with a
  selected file below), the per-file exists check, Attempts, backoff,
  token refresh, completion check, and Item Status and progress updates.
- **Disk Window controller**: owns app state (Tree, local tree,
  selection, options, Run) and exposes commands (read Drive, choose the
  Target Folder, Refresh, toggle option, toggle selection,
  expand/collapse, Download, confirm overwrite, Pause, Resume, Stop) and
  a view model (rows for both trees, totals with `+`, overall bar, status
  line, enabled/locked controls including Refresh and Expand/Collapse
  all, errors). Persists the last URL and the three remembered checkboxes
  (localStorage) and the folder handle (IndexedDB). A Read Drive failure
  caused by missing authorization maps to "Authorize the App in the
  Launcher Page tab, then press Read Drive again."
- **View**: renders the view model to the DOM and forwards events. Thin,
  not unit-tested. The Tree is re-rendered about once per frame while a
  file transfers, so a `click` on a folder toggle never lands; toggles
  act on `pointerdown` instead.

### Run and file state machine (from "Run state model")

- Run states: `idle` (no Tree or no folder; Download disabled) → `ready`
  → `running` ⇄ `paused` → `stopping` (only while finalizing) →
  `finished`. `finished` is `ready` plus the summary: inputs unlock,
  statuses stay; Download starts a new Run with statuses reset to
  pending. Read Drive or a naming checkbox after `finished` recomputes →
  `ready`.
- Download: re-read only the Source sub-folder, re-merge, then if
  overwrites are pending show the confirm; then `running`, all folders
  expanded, token fetched.
- File phases (not Item Statuses; the Item stays **downloading**):
  checking → transferring ⇄ waiting to retry → finalizing → done /
  failed.

| Phase                         | Pause                                                               | Stop                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| transferring (resumable)      | abort fetch, keep writable; Resume sends `Range` from bytes written | `writable.abort()`; new file removed, overwritten file untouched ("kept"); file back to pending; Run ends |
| transferring (Native via LRO) | abort, discard bytes; Resume restarts from 0, no Attempt used       | as above                                                                                                  |
| waiting to retry              | cancel wait; Resume starts the next Attempt at once                 | as above                                                                                                  |
| finalizing                    | "Pausing…" until done, then paused before the next file             | `stopping`, "Finishing current file…"; file kept as done, then the Run ends                               |

- Files not reached stay pending after Stop.
- Disk errors (`QuotaExceededError`, permission lost, folder gone) →
  `paused` with a message; the current file keeps its bytes; Resume
  retries and re-requests permission on that click.
- Byte path per file kind:
  - Normal file: `alt=media` in `Range` chunks of about 64–256 MB,
    streamed into the writable; resume by `seek` to bytes written.
  - Native File: `files.export` to the Office MIME type; on 403
    `exportSizeLimitExceeded`, the `files.download` LRO (started with only
    `mimeType` - unlike `export`/`get`/`list`, its request message has no
    `supportsAllDrives` field, and Drive answers 400 `invalid` if it's
    sent), then fetch its `downloadUri` with the bearer token. No size, no
    resume; every Attempt starts from 0. The first acceptance pass saw a
    Sheet over 10 MB fail on Attempt 1 with no further Attempts (ticket
    19): the build sent `supportsAllDrives=true` on the `files.download`
    start call, Drive's 400 isn't a transient status, so the file failed
    outright instead of ever reaching `downloadUri`. Fixed by dropping
    that param from the start call only (`export`/`get`/`list` keep it).
- Attempts: transient = network error, 5xx, 429, a 401 that survives a
  refresh, a failed token fetch. Nothing else is transient. Permanent =
  403 `fileNotDownloadable`, abuse flag, 404, `exportSizeLimitExceeded`
  after the fallback, `canDownload` false, and any other 4xx than 401 and
  429 (a 400, a 403 with another reason or with a non-JSON body). The
  build first treated every unrecognised error as transient. Five Attempts without progress; any new bytes
  written reset the count. Waits before Attempts 2–5: 2 s, 10 s, 30 s,
  60 s; `Retry-After` on 429/503 honoured, capped at 5 min. Offline:
  wait for `online` without using an Attempt. Attempts 2–4 resume, 5
  restarts from 0.
- Token: fetched at Run start, refreshed before a chunk when older than
  10 min, and on a 401 (same range retried, no Attempt used).
- Completion: after `close()`, size on disk must equal Drive `size`
  (skipped for Native Files); mismatch → transient failure, next Attempt
  from 0. No MD5.
- Overwrites go through `createWritable()` without keeping existing data;
  its swap file replaces the real file only on `close()`, so the old file
  survives any failure, Stop or closed window.
- Wake Lock held while `running` when the checkbox is on; released on
  pause/finish; re-requested when the window becomes visible.

### Target Folder scan triggers (from "Target Folder scan")

- Target Folder chosen or Refresh → whole Target Folder; "Reading Target
  Folder… N items"; Download waits.
- Read Drive done, naming checkboxes, "Skip existing files" → re-merge
  only.
- Download → re-read the Source sub-folder only, before the confirm.
- During and after a Run → no re-read; rows update from the Run's writes
  and each exists check. A file that appeared after Download was pressed
  is **exists** even with skipping off.

### UI (from "UI layout and Tree view prototype")

- Final prototype: branch `prototype/ui-layout`,
  `drive_downloader/prototype/ui-layout.html` (round 4, commit
  `05266a4`); `?state=` shows any state, `?page=launcher` the Launcher
  Page. The build follows it.
- Disk Window top to bottom, revised after the first acceptance pass
  (it replaces the prototype's order):
  - header: title and "Docs: see the Launcher Page tab"; no Help link;
  - the URL field, max-width about 90 characters;
  - one row with Read Drive, Local Target Folder and Refresh buttons;
  - "Target: 📁 name" or "No folder chosen";
  - URL/read errors and Target Folder scan errors beneath that;
  - the four option checkboxes in a vertical list;
  - one row with Download, Pause, Resume and Stop, then Expand all and
    Collapse all; the overall bar;
  - the two trees in aligned rows, one scroll;
  - the status line.
- The Tree header row keeps only group and column titles; Expand all,
  Collapse all and Refresh are buttons now, not header links.
  Refresh shows when a folder is chosen, no scan is running and nothing
  is locked. Expand/Collapse all are disabled when there are no rows.
- Labels: "Replace spaces with underscores"; "Local Target Folder" for
  the button once called "Location…", in its error messages ("choose a
  folder with Local Target Folder") and in the Launcher Page docs
  ("2. Choose a Local Target Folder"). Code identifiers keep their names.
- Font: the system monospace stack
  (`ui-monospace, "Cascadia Mono", "Liberation Mono", Menlo, Consolas,
monospace`) on both pages; buttons and fields inherit it. Widen tree
  columns if monospace truncates names or sizes noticeably.
- Overwrite confirm is a custom dialog; its backdrop must stay hidden
  while its `hidden` attribute is set (a class `display` rule overrides
  the browser default).

### Docs

- `drive_downloader/README.md`: deploy steps (`clasp create --type webapp
--title "drive_downloader" --rootDir src`, restore `appsscript.json`
  from git afterwards, enable "Show appsscript.json manifest file in
  editor", `clasp push`, deploy), services and scopes.
- `.clasp.json` is local-only (gitignored repo-wide), a change made
  outside this spec.
- The Launcher Page carries the user docs; `drive_downloader/CONTEXT.md`
  stays the glossary and gains any new terms the build settles. It notes
  that "Local Target Folder" is the button label for choosing the
  **Target Folder**; "Location" stays under _Avoid_.

## Testing Decisions

- Good tests exercise external behaviour through the highest seam and
  never reach into internals: given inputs and fakes, assert outputs,
  Item Statuses, rows, Results, calls to the Drive/disk ports and final
  disk contents. No assertions on private helpers or internal state
  shape.
- **Seam 1, backend**: `loadApp("drive_downloader", mocks)` with mocked
  `Drive`, `UrlFetchApp` and `ScriptApp`. Tests call the public GAS
  functions: `doGet` (serves the Launcher Page with the embedded Disk
  Window), Tree reader start and step (every URL shape, each error kind,
  resource-key calls via UrlFetchApp, Shortcuts to files and folders,
  loops, unreachable targets, unsupported and blocked Items, `orderBy`
  passed, continuation when the time budget runs out), token. After the
  first acceptance pass: `doGet` requires all scopes before serving (the
  `ScriptApp` mock records the call).
- **Seam 2, Disk Window core**: a new harness helper, alongside
  `loadApp`, that evaluates the App's client script partials into one
  `vm` context, the way the browser runs them. Tests build the controller
  with a fake Drive (scripted responses: ranges, 206, errors, 401s,
  `Retry-After`, LRO), an in-memory fake directory handle (files, sizes,
  case, swap-file semantics, `QuotaExceededError`, permission loss), a
  fake server port, and fake timers. They drive commands and assert the
  view model and the fake disk: naming and numbering cases, merge and
  Results, overwrite count, selection, every Run transition in the table,
  Attempts and backoff, token refresh, completion check, disk-error
  pause, Stop cleanup, 0-byte handling, files appearing after Download.
- Added after the first acceptance pass, same seam, no new one:
  - the Skip-existing preview:
    - rows show "exists", unticked and disabled, counted settled;
    - folder ticks and clicks ignore those files;
    - turning the option off restores each file's own tick state;
    - "exists" wins over "unselected";
    - folder-in-the-way files and 0-byte leftovers are handled;
  - retry classification: a 400, a 403 with another reason and a
    non-JSON 403 fail after one Attempt with their reason; network, 5xx,
    429 and a lasting 401 still retry;
  - the Read Drive authorization message;
  - the Native File over 10 MB path, reproducing the diagnosed failure
    with the fake Drive.
- DOM rendering and the Launcher Page window plumbing are not
  unit-tested; they are covered by acceptance. That includes the layout,
  labels, font, URL field width, button placement and `pointerdown`
  toggles. The Launcher Page smoke test follows the renamed docs heading.
- Prior art: `tools/load-app.js` and its own tests; the smoke tests in
  `template/` and `drive_downloader/test/`.
- `npm run check` must pass.

### Acceptance (manual, deployed `/exec`, desktop Chrome)

The user prepares these Source Folders in Drive (the build can't create
them) and runs through the checklist; the map closes when it passes:

1. **Big folder**: at least one single file of 20 GB+, plus a few normal
   files. Download completes; size on disk matches; finalizing is shown;
   Pause/Resume mid-file and a network drop (Wi-Fi off/on) resume from
   the same byte; Stop mid-file leaves no partial file.
2. **Mixed folder**: about 1000 Items, nested several levels; Shortcuts to
   files and folders, one looping back into its ancestry, one to a file
   the user can't access; Native Files under and over 10 MB; a Form;
   duplicate names differing only in case; names with illegal characters
   and spaces; a file with downloads disabled by its owner (from another
   account). Tree, statuses, Local Names and Results match the spec; a
   second Run skips everything as exists; with skipping off, the confirm
   count is right and files are overwritten.
3. **Public-by-link folder** with a resource key, owned by another
   account and never opened by the user: Read Drive and Download work.
4. **Bad URLs**: malformed text, a file URL, a folder the user can't
   access, an empty folder; each shows its own error text.
5. **Browser setup**: a normal Chrome profile with several Google
   accounts signed in (the deploying account not first); record whether
   it works or the docs must require a single-account profile.
6. **Windows**: closing the Launcher Page closes the Disk Window; "Leave
   site?" appears on both during a Run; Open focuses an existing Disk
   Window; the remembered folder and options survive a new visit.
7. **First-pass revisions**, on a fresh deployment:
   - consent is asked when the Launcher Page opens, and Read Drive works
     first time;
   - with Skip existing on, existing files show "exists", unticked and
     disabled, before Download; turning it off restores their ticks;
   - folders expand and collapse mid-transfer;
   - a Sheet over 10 MB downloads;
   - the new layout, labels and monospace font are in place;
   - the overwrite dialog shows only when Download finds files to
     overwrite.

## Out of Scope

- Zip or archive output.
- Browsers other than desktop Chrome; mobile.
- Multiple users or public access.
- Drive links written inside file contents; only Drive Shortcuts count.
- A "retry failed" button.
- Deleting anything on disk, including orphan swap files; syncing
  deletions from Drive.
- Surviving a reload or closed window mid-Run (Run state lives in memory
  only).
- MD5 checks.
- Preventing sleep on lid close.
- Docs inside the Disk Window (they stay on the Launcher Page).
- A web font; the system monospace stack is enough.

## Further Notes

- Never run clasp; hand the user the exact commands.
- Chrome's Safe Browsing pass pauses visibly at the end of big files
  (finalizing); a file briefly needs twice its size in free space when it
  is overwritten.
- Brave lacks the File System Access API unless flagged; not supported.
- First acceptance pass (2026-09-27), what worked:
  - Launcher Page, Read Drive (after consent), the local folder
    permission prompt;
  - both naming options;
  - Download, Pause/Resume, Stop, and the overwrite confirm;
  - selection;
  - Doc, Sheet and Slides exports under 10 MB.

  Not yet exercised: items 1–6 of the checklist in full. Fixed during
  the pass: the overwrite dialog always showing (CSS), and the README
  deploy steps.

- The failure reason of a failed file shows only on hover over its
  chip; hover it when reporting a failure.
- Research files and spikes: branches `research/folder-picker-in-gas-iframe`,
  `research/browser-direct-drive-api`, `research/read-drive-in-gas`,
  `prototype/byte-path-spike` (App `drive_downloader_spike/`, a reference
  for the opener bridge, Disk Window writing and the byte path).
