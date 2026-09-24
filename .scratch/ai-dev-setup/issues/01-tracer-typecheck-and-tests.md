# 01: Tracer bullet: drive_downloader typechecks and tests via loadApp

Spec: `.scratch/ai-dev-setup/spec.md`

**What to build:** Minimal end-to-end loop proving the App layout and the local feedback loop work. drive_downloader is moved to the standard App layout and becomes a minimal working web app. `npm run typecheck` type-checks every App in isolation (plain JS + JSDoc against GAS types, no build step). `npm test` runs a smoke test that loads the App's source through `loadApp`, in one shared `vm` context with mocked GAS services, the way GAS does.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Root npm package with shared devDeps (typescript, GAS types, vitest); Node pinned to 24; `node_modules` and `.clasprc.json` git-ignored
- [x] Shared base tsconfig (allowJs, checkJs, noEmit, strict, GAS types)
- [x] Typecheck runner finds every App (a folder whose source folder holds `appsscript.json`), type-checks each with its own tsconfig, and fails if any App fails
- [x] Vitest config picks up each App's test folder (and later tooling tests)
- [x] `loadApp(appNameOrPath, mocks?)`: loads all source `.js` files in `filePushOrder` if set in `.clasp.json`, otherwise sorted by path. Uses one `vm` context seeded with `console`, the default mocks and caller mocks (caller wins). Property reads resolve globals, including top-level `const`/`let`/`class`. Accepts an App name or an absolute path
- [x] Default GAS mocks: HtmlService (template/output creation from file, chainable setters) and Logger
- [x] drive_downloader in the standard layout: clasp rootDir = source folder; backend/frontend moved under it; old empty folders removed
- [x] drive_downloader manifest: Europe/Berlin, V8, STACKDRIVER, webapp USER_DEPLOYING / MYSELF
- [x] drive_downloader has a minimal `doGet` serving `frontend/index` via a template, plus `include(filename)`, both with JSDoc and `// @ts-check`
- [x] drive_downloader has a per-App tsconfig and a README (purpose TBD; script/deployment notes; services/scopes)
- [x] Smoke test: `doGet` returns HtmlService output built from the index template, asserted through the mocks
- [x] `npm run typecheck` and `npm test` pass; a planted type error makes typecheck fail (then reverted)
