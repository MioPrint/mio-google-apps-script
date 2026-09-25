# Drive Downloader

Mirrors one Google Drive folder, with its sub-folders and shortcuts, into a
folder on the local disk, one file at a time, never overwriting.

## Language

### Source and target

**Source Folder**:
The Google Drive folder whose URL the user pastes; the root of what gets
mirrored.
_Avoid_: Drive, drive URL, remote folder

**Target Folder**:
The local folder the user picks with the Location button; the root the
Source Folder is mirrored into.
_Avoid_: Location, download location, destination

**Tree**:
The Source Folder's contents as read by Read Drive, shown as an expanded
file-system tree.
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
unique among same-named siblings.
_Avoid_: Filename, sanitized name

**Disk Window**:
The separate browser window the App opens to reach the Target Folder; it
must stay open while a Run writes to disk.
_Avoid_: Popup, helper window

### Downloading

**Run**:
Everything from pressing Download until every Item is settled or the user
presses Stop. A Run may be paused and resumed.
_Avoid_: Job, session, sync

**Attempt**:
One try at transferring a file. A file gets one Attempt, three that resume
from the last byte received, and a final one from the start.
_Avoid_: Retry (for the first try)

**Item Status**:
Where an Item stands: pending, downloading, done, exists (skipped),
failed, unsupported, or loop (a Shortcut back into its own ancestry,
skipped).
_Avoid_: State, result
