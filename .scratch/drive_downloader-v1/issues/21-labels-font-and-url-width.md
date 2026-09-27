# 21: Labels, font and URL width

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 51, 56, 70, 116, 117; UI "Labels", "Font")

**What to build:** The Disk Window and the Launcher Page docs use the new labels: "Replace spaces with underscores" and "Local Target Folder" (the button once called "Location…"). Both pages use a monospace font, buttons and fields included, and the URL field is only about as wide as a Drive folder URL.

**Blocked by:** 20

**Status:** ready-for-agent

- [x] Option label "Replace spaces with underscores" in the Disk Window and the Launcher Page docs
- [x] Button label "Local Target Folder"; Target Folder error messages say "choose a folder with Local Target Folder"; the Launcher Page docs heading "2. Choose a Local Target Folder" and its text follow; code identifiers unchanged
- [x] Both pages use the system monospace stack (`ui-monospace, "Cascadia Mono", "Liberation Mono", Menlo, Consolas, monospace`); buttons and inputs inherit it
- [x] Tree columns widened where monospace truncates names or sizes noticeably
- [x] URL field max-width about 90 characters
- [x] Launcher Page smoke test follows the renamed docs heading
- [ ] Manual check on a deployment: labels, font and widths as specified on both pages
- [x] `npm run check` passes
