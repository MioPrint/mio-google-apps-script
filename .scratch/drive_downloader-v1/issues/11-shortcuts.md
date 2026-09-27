# 11: Shortcuts

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Shortcuts to files and folders are followed and mirrored as what they point at, once per place they appear. A Shortcut back into its own ancestry is "loop" and skipped; one whose target can't be reached is failed. A ↪ badge marks Shortcuts, and "Use Shortcut target names" picks which name is used.

**Blocked by:** 06, 09

**Status:** ready-for-agent

- [x] Tree reader: Shortcut to folder → walked as a folder; Shortcut to file → one `files.get` for size etc.; Items carry the Shortcut's own name and the target's id, name, mime type, size, resource key
- [x] Target in the Shortcut's own ancestry → flagged loop (status "loop", disabled box, skipped); target 404 → failed with reason
- [x] Download fetches the target's bytes (with its resource key); a target in several places is downloaded once per place
- [x] ↪ badge on Shortcuts; hover shows the other name; Type label "↪ MP4 video" style
- [x] "Use Shortcut target names" checkbox, off by default, remembered, locked during a Run: off = Shortcut's own name, on = target's name, for Tree label and Local Name; toggling re-merges (and may shift `(n)` suffixes)
- [x] When the name used lacks the target's extension it is appended (`Holiday video` → `clip.mp4` gives `Holiday video.mp4`)
- [x] Backend tests: folder and file Shortcuts, loop, unreachable target, resource keys
- [x] Client-core tests: naming with both checkbox states, extension append, loop skipped, multiple-place download
- [x] `npm run check` passes
