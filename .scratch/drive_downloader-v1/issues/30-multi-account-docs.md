# 30: Multi-account docs

Spec: `.scratch/drive_downloader-v1/spec.md` (story 132; Docs)

**What to build:** The README and the Launcher Page docs say that a Chrome profile with several Google accounts signed in gets Drive's "Sorry, unable to open the file at this time." on the App URL, and give the workaround: a profile signed into only the deploying account, or an Incognito window signed into it. Nothing is fixed in code.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] README (deploy/usage notes) carries the limitation and workaround
- [ ] Launcher Page docs "Before you start" (or equivalent) carry it; smoke test still passes
- [ ] `npm run check` passes
