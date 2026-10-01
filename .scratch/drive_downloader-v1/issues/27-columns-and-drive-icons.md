# 27: Columns and Drive icons

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 21, 32, 63, 124; UI)

**What to build:** The Drive tree's columns are Name, Size, Status (Type dropped); the Target Folder tree's are Name, Size, Result (Modified dropped). Drive names carry 📁 / 📄 like the Target side, with ↪ before the icon for a Shortcut. The Type label stays available on the row for ticket 29's name tooltip.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Type and Modified columns removed from header and rows; grid columns rebalanced so names get the room
- [ ] Rows no longer carry a modified time; the Target Folder scan may still read it
- [ ] Drive names show 📁 / 📄, Shortcuts ↪ before the icon
- [ ] Tests updated for rows without modified text
- [ ] Manual check on a deployment: both sides read alike; nothing noticeably truncated at a typical popup size
- [ ] `npm run check` passes
