# 07: Tree naming, sibling order and Native File sizes

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: resolved
Blocked by: None

## Question

Settle three Tree details raised by "Reading the Tree in GAS":

- Which sibling order decides who gets `name (2).ext` (Drive's `orderBy`,
  e.g. `createdTime`, `name`, or `folder,name`)?
- Does a Shortcut appear under its own name or its target's, and which
  name becomes its Local Name?
- What size does the Tree show for a Native File, given that Drive's size
  isn't the exported size (none, "?", or an estimate)?
- Which Item Status a file gets when its owner blocked downloads
  (`canDownload` false) or it is flagged as abusive: failed with a reason,
  or unsupported?

## Comments

- 2026-09-25, from "End-to-end byte-path spike": Drive's default
  `files.list` order is arbitrary (neither name nor creation order), so an
  explicit `orderBy` is required. Native Files over 10 MB now download via
  `files.download` with no size known up front.

## Answer

Resolved with the user, 2026-09-25.

**Order and numbering.** Siblings are listed with `orderBy`
`folder,name_natural,createdTime`: folders first, natural name order,
oldest first among equal names. Uniqueness is checked on the final Local
Name (after `+`, `_` and any appended extension), ignoring case, across
files and folders together. A Local Name used once stays plain; every
duplicate is numbered in order: `name (1).ext`, `name (2).ext`…, skipping
numbers already taken by a real sibling. The number goes before the last
extension (`archive.tar (1).gz`); folders get it at the end (`Docs (1)`).
Numbering is among Drive siblings only; a clash with the disk is handled by
the skip/overwrite rule below. Accepted cost: if a duplicate appears between
Runs, the earlier file gets a new `(1)` Local Name, is downloaded again, and
the old copy stays on disk.

**Native Files.** The Office extension is appended unless the name already
ends in it (case-insensitive): `Budget.xlsx` stays as is. Tree size is `?`
until the file is done, then its real size on disk. Folder and overall
totals add up the known sizes and show a `+` suffix (`1.2 GB+`) while any
`?` remains below them; the total grows as Native Files finish. While
downloading, a Native File shows bytes received and no percentage.

**Shortcuts.** New checkbox "Use Shortcut target names", off by default:
off = the Shortcut's own name, on = the target's name. It sets both the Tree
label and the Local Name; hovering shows the other name, and a ↪ badge marks
the Shortcut. When the name used lacks the target's extension, the target's
extension is appended (`Holiday video` → `clip.mp4` gives
`Holiday video.mp4`). Toggling it can shift `(n)` suffixes.

**Blocked and abusive files.** Both get **failed** with a reason, and use no
Attempts. `capabilities.canDownload` false is marked failed at Read Drive
("downloads disabled by owner"), so the user sees it before pressing
Download. The abuse flag has no listing field, so it becomes failed ("flagged
as abusive") when its download is tried (403). "Unsupported" is kept for
file types only.

**Overwriting (replaces the "Never overwrite" requirement).** New checkbox
"Skip existing files", checked by default. Checked: behaves as before
(status "exists", skipped). Unchecked: existing files are overwritten.
`createWritable()` writes to a `.crswap` file that replaces the real file
only on close, so the old file survives any failure, Stop or closed Disk
Window, but a file briefly needs twice its size in free space. A folder
where a file should go, or a file where a folder should go, is **failed**
with a reason ("a folder named X is in the way"); a blocked folder fails its
whole subtree with that reason. Nothing is ever deleted. With skipping on,
both cases count as "exists". Existing sub-folders are still reused.

When the Tree and Target Folder are both known, files that would be
overwritten show as pending with an "overwrites" note on hover. Pressing
Download with overwrites pending asks once: "N existing files will be
overwritten. Continue?" After the Run they show as plain **done**.

**Checkboxes.** All are locked during a Run. "Skip existing files" always
starts checked; spaces→`_` and "Use Shortcut target names" are remembered
between visits.
