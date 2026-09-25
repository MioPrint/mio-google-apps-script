# 07: Tree naming, sibling order and Native File sizes

Map: `.scratch/drive_downloader-map/map.md`

Type: grilling
Status: open
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
