# 02: Launcher Page and Disk Window shell

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** The App's URL opens the Launcher Page: "Drive Downloader", one line of purpose, an "Open Drive Downloader" button and a note to keep the tab open. The button opens the Disk Window, a large popup on the same sandbox origin (`window.open('/blank')`, then the embedded Disk Window document written into it, as in the byte-path spike). The Disk Window reaches GAS only through a promise bridge the Launcher Page exposes over `google.script.run`, via `window.opener`. Verifiable after `clasp push`: the Disk Window shows its header and fetches a token through the bridge.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Manifest: explicit `oauthScopes` `drive.readonly` and `script.external_request`; Advanced Drive service v3 enabled; existing webapp settings kept
- [ ] `doGet` serves the Launcher Page; the Disk Window document is rendered from its own template and embedded safely (escaped JSON)
- [ ] Open creates the popup (about 1180×820); Open while it is open brings it to the front instead of opening a second
- [ ] Popup blocked → a visible message on the Launcher Page
- [ ] Bridge: Disk Window calls named server functions and gets promises; failures reject with the server error
- [ ] Token server function returns `ScriptApp.getOAuthToken()`
- [ ] Launcher Page closing or reloading closes the Disk Window; the Disk Window closes itself if it finds its opener gone
- [ ] Disk Window header "Drive Downloader" with a Help link that focuses the Launcher Page
- [ ] Backend tests via `loadApp`: `doGet` serves the Launcher Page with the embedded Disk Window; token call
- [ ] Client-core test: the controller obtains a token through a fake server port
- [ ] README lists the clasp steps the user runs to deploy this (`clasp create …`, restore `appsscript.json`, `clasp push`, deploy); never run clasp
- [ ] `npm run check` passes
