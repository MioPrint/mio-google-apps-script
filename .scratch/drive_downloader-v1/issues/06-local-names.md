# 06: Local Names

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Every Item gets its full Local Name: illegal characters → `+`, optional spaces → `_`, and duplicates among siblings (ignoring case, files and folders together) numbered in sibling order. The right tree, the status line and every disk write use it; toggling the checkbox re-merges without re-reading the disk.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] "Replace spaces with _" checkbox (files and folders), remembered across visits, locked during a Run
- [ ] Uniqueness on the final Local Name, ignoring case, across files and folders, among all Drive siblings
- [ ] A name used once stays plain; every duplicate numbered `(1)`, `(2)`… in sibling order (`folder,name_natural,createdTime`), skipping numbers a real sibling already has
- [ ] Number before the last extension (`archive.tar (1).gz`), at the end for folders (`Docs (1)`)
- [ ] Toggling the checkbox (outside a Run) recomputes Local Names and re-merges Results, no disk re-read; after `finished` it returns to `ready`
- [ ] Naming is a pure module with tests covering each rule above, including case-only duplicates, numbering collisions with real `(1)` siblings, dotfiles and names with no extension
- [ ] `npm run check` passes
