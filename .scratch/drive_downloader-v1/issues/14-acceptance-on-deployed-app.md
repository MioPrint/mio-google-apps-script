# 14: Acceptance on the deployed App

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** HITL. The user deploys the App (`clasp push`, new deployment, `/exec`) and runs the spec's acceptance checklist in desktop Chrome on real Source Folders the user prepares in Drive. Findings go in this ticket's Comments; defects become new tickets. When it passes, the map `.scratch/drive_downloader-map/map.md` closes.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] Big folder (a 20 GB+ file plus a few normal files): completes, size matches, finalizing shown, Pause/Resume mid-file and Wi-Fi off/on resume from the same byte, Stop mid-file leaves no partial file
- [ ] Mixed folder (~1000 Items, nested; Shortcuts to files and folders, one loop, one to an inaccessible file; Native Files under and over 10 MB; a Form; case-only duplicate names; illegal characters and spaces; a file with downloads disabled by its owner): Tree, statuses, Local Names, Results as specified; second Run all exists; with skipping off, confirm count right and files overwritten
- [ ] Public-by-link folder with a resource key, owned by another account and never opened: Read Drive and Download work
- [ ] Bad URLs (malformed, file URL, inaccessible folder, empty folder): each shows its own error text
- [ ] Normal Chrome profile with several Google accounts signed in (deploying account not first): works, or docs updated to require a single-account profile
- [ ] Windows: closing the Launcher Page closes the Disk Window; "Leave site?" on both during a Run; Open focuses an existing Disk Window; remembered folder and options survive a new visit

## Comments

First deploy pass (user, 2026-09-27):

- `clasp create` needs `--title`, else it prompts interactively; and it
  overwrote `src/appsscript.json` as expected per README step 1 — fixed by
  restoring from git. README's Deploy steps rewritten to give the exact
  restore command and include `--title`.
- `clasp push` didn't push `appsscript.json` until "Show appsscript.json
  manifest file in editor" was enabled in the GAS editor's Project
  Settings. Added as a required step to README's Deploy steps.
- Launcher Page opened fine. Disk Window opened but was stuck behind an
  "Overwrite files?" dialog with no pending overwrite (nothing had been
  read/downloaded yet); Cancel and Continue both did nothing, blocking
  the rest of the checklist. Root cause: `disk.css.html`'s `.modal-back`
  rule set `display: flex` unconditionally, which beats the browser's
  default `[hidden] { display: none }` regardless of the `hidden`
  attribute the controller toggles — the dialog was always visible, and
  since no overwrite was actually pending, both buttons were genuine
  no-ops against `state.pendingOverwriteCount === null`. Fixed with a
  `.modal-back[hidden] { display: none; }` rule.
- `.clasp.json` was created by `clasp create` and was untracked; per
  `AGENTS.md`'s App layout (commit it) it's now added to git.

Re-deploy with the fixed `disk.css.html` and resume the checklist.
