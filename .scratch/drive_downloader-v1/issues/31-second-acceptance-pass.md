# 31: Second acceptance pass

Spec: `.scratch/drive_downloader-v1/spec.md` (Acceptance item 8)

**What to build:** HITL. The user deploys (`clasp push`, new deployment version, `/exec`) and runs acceptance item 8 in desktop Chrome. Findings go in this ticket's Comments; defects become new tickets. When it passes, the map `.scratch/drive_downloader-map/map.md` closes.

**Blocked by:** 22, 23, 24, 25, 26, 27, 28, 29, 30

**Status:** ready-for-agent

- [x] Clicking a folder name toggles it mid-transfer, first click; no double toggle when idle
- [x] Download keeps the expand/collapse state
- [x] Spinner and ⏸️ through Read Drive, Local Target Folder, Refresh, Download, Pause, Wi-Fi off/on
- [x] Status panel beside the options; errors there; no layout shift
- [x] Option labels don't toggle; Refresh disabled, not hidden, during a Run
- [x] Drive icons, Type/Modified columns gone, Target header name, no Target root row
- [x] Tooltips: delays, fade, texts, none doubled
- [x] A Drive file named with a trailing space mirrors without it
- [x] Multi-account note visible in the Launcher Page docs

## Comments

2026-10-01: User ran acceptance item 8 on deployment in desktop Chrome. All points pass; no defects.
