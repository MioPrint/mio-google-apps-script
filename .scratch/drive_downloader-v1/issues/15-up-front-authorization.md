# 15: Up-front authorization

Spec: `.scratch/drive_downloader-v1/spec.md` (stories 108, 109; Architecture "Authorization up front")

**What to build:** Opening the App's URL asks for Google consent for every manifest scope before the Launcher Page shows. As a result, the first Read Drive never fails with "You do not have permission to call drive.files.get". If authorization is still missing, Read Drive says where to grant it instead of showing the raw exception.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Confirm that Apps Script's `ScriptApp.requireAllScopes` (full auth mode) exists and, called from `doGet` in a web app that executes as the deploying user, prompts for consent. If it doesn't, drop it: add an "authorize once" step to the README deploy steps and say so in this ticket's Comments
- [x] `doGet` requires all scopes before serving the Launcher Page
- [x] A Read Drive failure caused by missing authorization shows "Authorize the App in the Launcher Page tab, then press Read Drive again." under the URL field; other Read Drive failures keep their current text
- [x] Backend test via `loadApp`: `doGet` makes the scope call (ScriptApp mock records it) and still serves the Launcher Page
- [x] Client-core test: a permission-style server error from the Tree reader maps to the authorization message
- [x] README deploy steps mention the consent screen now appears on first open
- [x] `npm run check` passes

## Comments

Docs research (agent, 2026-09-27):

- `ScriptApp.requireAllScopes(authMode)` is a real, documented method:
  "Validates if the user has granted consent for all of the scopes
  requested by the script... ends the current execution and renders an
  authorization prompt." Its own reference page adds a caveat: "This
  method only works when users run the script from a surface that
  supports granular consent, for example, from within the Apps Script
  IDE" - standalone deployed web apps aren't in that list, so whether it
  prompts at the deployed `/exec` URL itself is genuinely unconfirmed
  from docs alone.
- Ticket 14's Comments record the actual deployed-app bug this ticket
  fixes: the _base_ GAS authorization check (not `requireAllScopes`
  specifically) already fires on a deployed web app - "the first Read
  Drive failed with 'You do not have permission...', and the
  'Authorization required' dialog opened in the Launcher Page" - just too
  late (mid-flow, via `google.script.run`, invisible from the Disk
  Window) rather than up front. That's evidence the underlying dialog
  does reach a deployed app; it just doesn't prove `requireAllScopes`
  specifically is what triggers it there.
- Resolution: not a clean "keep" or "drop" per the letter of this
  bullet's either/or - `doGet` keeps the call (so opening the URL is
  _intended_ to prompt up front, per story 108), but the README's deploy
  steps also gained a mandatory "authorize the App once" step (running
  `doGet` from the editor - a surface the docs do confirm) so first use
  is guaranteed correct either way, independent of whether the deployed
  surface cooperates. README wording was corrected after review to say
  this plainly rather than asserting the deployed URL definitely won't
  prompt (an unconfirmed negative this agent can't verify without
  deploying). Whether the deployed URL itself shows the prompt up front
  is still worth confirming during ticket 14's acceptance re-pass; if it
  turns out not to, no further code change is needed here since the
  editor step and 109's Read Drive message already cover that case.
