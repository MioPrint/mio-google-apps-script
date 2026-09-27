# 15: Up-front authorization

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 108, 109; Architecture "Authorization up front")

**What to build:** Opening the App's URL asks for Google consent for every manifest scope before the Launcher Page shows. As a result, the first Read Drive never fails with "You do not have permission to call drive.files.get". If authorization is still missing, Read Drive says where to grant it instead of showing the raw exception.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Confirm that Apps Script's `ScriptApp.requireAllScopes` (full auth mode) exists and, called from `doGet` in a web app that executes as the deploying user, prompts for consent. If it doesn't, drop it: add an "authorize once" step to the README deploy steps and say so in this ticket's Comments
- [ ] `doGet` requires all scopes before serving the Launcher Page
- [ ] A Read Drive failure caused by missing authorization shows "Authorize the App in the Launcher Page tab, then press Read Drive again." under the URL field; other Read Drive failures keep their current text
- [ ] Backend test via `loadApp`: `doGet` makes the scope call (ScriptApp mock records it) and still serves the Launcher Page
- [ ] Client-core test: a permission-style server error from the Tree reader maps to the authorization message
- [ ] README deploy steps mention the consent screen now appears on first open
- [ ] `npm run check` passes
