# Drive Downloader

Mirrors one Google Drive folder, with its sub-folders and shortcuts, into a
folder on the local disk, one file at a time, skipping existing files
unless told to overwrite them.

## Language

### Source and target

**Source Folder**:
The Google Drive folder whose URL the user pastes; the root of what gets
mirrored.
_Avoid_: Drive, drive URL, remote folder

**Target Folder**:
The local folder the user picks with the Location button. The Source Folder
is mirrored into it as a sub-folder of the same Local Name, reusing one
that is already there.
_Avoid_: Location, download location, destination

**Tree**:
The Source Folder's contents as read by Read Drive, shown as a collapsible
file-system tree, row by row beside the Target Folder's contents.
_Avoid_: Listing, file list

**Item**:
One file or folder in the Tree.
_Avoid_: Entry, node

**Shortcut**:
A Drive item that points at another file or folder; it is mirrored as the
thing it points at.
_Avoid_: Link, linked file, linked folder

**Native File**:
A Google Docs, Sheets or Slides file, which has no bytes of its own and is
exported to an Office format when mirrored.
_Avoid_: Google file, workspace file

**Local Name**:
The name an Item gets in the Target Folder: its Drive name with illegal
characters replaced by `+`, optionally spaces replaced by `_`, and made
unique, ignoring case, among its siblings' Local Names (files and folders
alike).
_Avoid_: Filename, sanitized name

**Disk Window**:
The separate browser window, opened from the Launcher Page, that holds the
whole App: URL field, Tree, Location and controls. It is the only place
that can reach the Target Folder, and it closes with the Launcher Page.
_Avoid_: Popup, helper window

**Launcher Page**:
The page the App's URL opens: a button that opens the Disk Window, and the
user documentation. It must stay open while the Disk Window is in use.
_Avoid_: GAS tab, home page, start page

### Downloading

**Run**:
Everything from pressing Download until every Item is settled or the user
presses Stop. A Run may be paused and resumed.
_Avoid_: Job, session, sync

**Attempt**:
One try at transferring a file. A file gets one Attempt, three that resume
from the last byte received, and a final one from the start. Only failures
that may pass (network, server busy) use up Attempts; an Attempt that
receives new bytes before failing gives the file its full count back.
_Avoid_: Retry (for the first try)

**Item Status**:
Where an Item stands: pending, downloading, done, exists (skipped, only
when existing files are skipped), failed (with a reason, including files
whose downloads are blocked), unsupported (a file type that can't be
mirrored), loop (a Shortcut back into its own ancestry, skipped), or
unselected (unticked by the user, skipped).
_Avoid_: State, result

## Decisions

- [ADR-0001](docs/adr/0001-client-side-core.md): the Run, and the naming,
  target-folder-scanning and merging logic behind it, live in the Disk
  Window (client-side), not GAS — a departure from the repo's "keep client
  logic thin" rule.
