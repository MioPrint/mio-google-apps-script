# 23: Local Names trimmed

Spec: `.scratch/drive_downloader-v1/spec.md` (story 123; Disk Window core modules "Naming")

**What to build:** Leading and trailing spaces are dropped from every Local Name, with "Replace spaces with underscores" on or off. "My file " becomes "My file" (or "My_file"), never "My_file_". Only the two ends of the whole name are trimmed; spaces before an extension stay. A name of spaces only becomes `+`. A local item still carrying the spaces from an earlier Run shows as local only.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Trimming happens before illegal-character and space replacement, Office-extension appending and numbering; applies to the root too
- [x] Naming tests: option on and off, leading and trailing spaces, inner spaces still follow the option, spaces before an extension kept, a spaces-only name, duplicates that only differ by trailing spaces numbered
- [x] Launcher Page docs on names mention the trim, if they describe Local Names
- [x] `npm run check` passes
