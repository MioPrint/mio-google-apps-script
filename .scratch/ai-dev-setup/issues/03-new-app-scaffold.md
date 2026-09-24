# 03: `new-app` scaffold and template

Spec: `.scratch/ai-dev-setup/spec.md`

**What to build:** `npm run new-app <name> [--dest <dir>]` creates a new App from a template. The new App is a working minimal web app that passes the full gate right away. The command then prints the clasp steps the user must run. It never runs clasp itself.

**Blocked by:** 02 (Lint, format and the `npm run check` gate)

**Status:** ready-for-agent

- [x] Template: README skeleton, tsconfig, manifest with the agreed defaults, backend entry (`doGet` + `include()`), index page, and a smoke test using `loadApp`
- [x] Template placeholders substituted with the App name
- [x] CLI rejects names that aren't snake_case and targets that already exist, with a clear message and a non-zero exit
- [x] `--dest` defaults to the repo root
- [x] CLI prints next steps: from the App folder run `clasp create --type webapp --rootDir src`, then check that the manifest wasn't overwritten
- [x] Automated CLI test (temp folder): expected folder shape, name substituted, invalid and duplicate names rejected, and `loadApp` on the new App can call `doGet`
- [x] The template is excluded from App discovery (typecheck) and from the direct test run where appropriate, but its contents still pass lint/format
- [x] `npm run check` passes

## Comments

- Code review (`/code-review`) ran two axes against this diff:
  - **Standards**: no hard violations. One judgement call noted (`ScaffoldError` has no JSDoc, no in-repo precedent either way) and one Duplicated Code smell (`new-app.js`'s `collectFiles` mirrors `load-app.js`'s `collectJsFiles`); left as-is, not worth a shared helper for a 10-line walk.
  - **Spec**: one real defect found and fixed — the ticket's own documented invocation `npm run new-app <name> --dest <dir>` (no `--` separator) causes npm to swallow the `--dest` flag and silently scaffold into the repo root instead of the requested directory. Fixed by having the CLI reject unrecognized arguments loudly (non-zero exit, message pointing at the `--` separator) instead of silently defaulting. Covered by a new test in `tools/new-app.test.js`.
