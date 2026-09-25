# 02: Lint, scaffold, typecheck, permissions and docs fixes

Spec: `.scratch/ai-dev-setup-review-fixes/spec.md`

**What to build:** Ordinary client code in HTML partials passes lint. `npm run new-app` works from any repo path and tells the user to commit `.clasp.json`. Type drift in the template fails `npm run check`. Agents can run `npm test` without a prompt. AGENTS.md and the App READMEs document the `.clasp.json` rule, the frontend partials convention and OAuth scopes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] HTML lint: `no-unused-vars` limited to local scope (as for App source), `no-undef` still on; the config's description comment matches; the shebang is removed from the ESLint config
- [x] Checked by hand: a temporary HTML partial with a top-level function called only from `onclick` lints clean (then reverted)
- [x] `new-app`'s "run directly" check uses Node's standard path-to-file-URL conversion, not a hand-built `file://` string
- [x] `new-app` next steps include a line telling the user to commit `.clasp.json` after `clasp create`; the existing CLI test asserts it
- [x] Typecheck no longer skips the template; the test runner still excludes the template's own test folder
- [x] Checked by hand: a planted type error in the template's backend makes `npm run typecheck` fail (then reverted)
- [x] Committed project permissions allow `npm test`; clasp deny rules unchanged
- [x] AGENTS.md App layout: `.clasp.json` is "created by `clasp create`; commit it"
- [x] AGENTS.md gains a short Frontend note: HtmlService templates + `include()` partials, client JS/CSS in `*.js.html` / `*.css.html`, shared helpers declared with `/* global name */`, thin client logic, real logic server-side
- [x] Template README and drive_downloader README list "OAuth scopes: none yet" under "Services & scopes"
- [x] `npm run check` passes
