# 13: User docs and deploy README

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** The Launcher Page carries the user documentation below the Open button, and the developer README has complete deploy steps. Docs match the built behaviour.

**Blocked by:** 07, 10, 11, 12

**Status:** ready-for-agent

- [x] Launcher Page docs: before you start (desktop Chrome only, keep both windows open, pick or create a sub-folder since Chrome refuses Downloads itself, the one-time "unverified app" consent), the four steps, Item Statuses, right-tree Results, names and sizes (`+`, `_`, `(n)`, `?`/`+`), skip versus overwrite, Shortcuts, Native File exports, limits (≤1000 files, one file at a time, Run lost on reload), sleep (Keep screen awake; set the computer not to sleep otherwise; lid close stops a Run)
- [x] Docs written for users, separate from the README; the Disk Window Help link lands on them
- [x] README: purpose, services and scopes, deploy steps the user runs (`clasp create --type webapp --rootDir src`, restore `appsscript.json` from git, `clasp push`, create a deployment, open `/exec`); never run clasp
- [x] `drive_downloader/CONTEXT.md` checked against the build; any new terms added
- [x] Smoke test asserts the Launcher Page contains the docs' main headings
- [x] `npm run check` passes
