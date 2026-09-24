# 03: `new-app` scaffold and template

Spec: `.scratch/ai-dev-setup/spec.md`

**What to build:** `npm run new-app <name> [--dest <dir>]` creates a new App from a template. The new App is a working minimal web app that passes the full gate right away. The command then prints the clasp steps the user must run. It never runs clasp itself.

**Blocked by:** 02 (Lint, format and the `npm run check` gate)

**Status:** ready-for-agent

- [ ] Template: README skeleton, tsconfig, manifest with the agreed defaults, backend entry (`doGet` + `include()`), index page, and a smoke test using `loadApp`
- [ ] Template placeholders substituted with the App name
- [ ] CLI rejects names that aren't snake_case and targets that already exist, with a clear message and a non-zero exit
- [ ] `--dest` defaults to the repo root
- [ ] CLI prints next steps: from the App folder run `clasp create --type webapp --rootDir src`, then check that the manifest wasn't overwritten
- [ ] Automated CLI test (temp folder): expected folder shape, name substituted, invalid and duplicate names rejected, and `loadApp` on the new App can call `doGet`
- [ ] The template is excluded from App discovery (typecheck) and from the direct test run where appropriate, but its contents still pass lint/format
- [ ] `npm run check` passes
