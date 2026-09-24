# Spec: AI-driven development setup

Labels: ready-for-agent

## Problem Statement

The repo holds Google Apps Script web apps, one per top-level folder, managed with clasp. Right now it has one empty App (drive_downloader), no manifest, no tooling, and no conventions. Agents working here have no local feedback loop: no type checks, lint, or tests. They have no standard way to create an App and no documented rules about GAS quirks or who runs clasp. So AI-driven development would be unreliable and inconsistent.

## Solution

Set the repo up so agents can work autonomously and safely:

- Documented conventions in AGENTS.md: App layout, GAS gotchas, commands, clasp policy.
- A standard App layout and a scaffold command that creates new Apps from a template.
- One local gate, `npm run check`, covering type checks (JSDoc + tsc), lint (ESLint), format (Prettier) and tests (Vitest). Agents must pass it before they call work done.
- A test harness that runs an App's source the way GAS does: every file in one shared global scope, with mocked GAS services.
- Project permissions that let agents run the checks freely but never run clasp. The user does all clasp work.
- Multi-context domain docs, so each App can grow its own glossary and ADRs.
- drive_downloader moved to the standard layout, with a minimal working web app and a smoke test.

## User Stories

1. As the developer, I want each top-level folder to be exactly one App (one Apps Script project), so that the repo structure maps one-to-one to my GAS projects.
2. As the developer, I want every App to use the same layout (manifest, backend, frontend, tests, README, clasp config), so that agents and I always know where things live.
3. As the developer, I want only an App's source folder pushed by clasp, so that tests, docs and tooling never leak into GAS.
4. As the developer, I want `.clasp.json` committed per App, so that the mapping from App to script ID is recorded in git.
5. As the developer, I want clasp credentials git-ignored defensively, so that secrets never land in the repo.
6. As the developer, I want to run one command to create a new App from a template, so that new Apps start consistent.
7. As the developer, I want the scaffold command to reject bad or duplicate App names, so that I don't overwrite an existing App or create inconsistent names.
8. As the developer, I want the scaffold command to print the clasp steps I must run next, so that I know how to bind the new App to a GAS project.
9. As the developer, I want new Apps to get a sensible default manifest (Europe/Berlin, V8, Stackdriver logging, web app run as deployer, access limited to me), so that I only change what differs.
10. As the developer, I want new Apps to come with a minimal `doGet`, an `include()` helper and an index page, so that a fresh App is a working web app right away.
11. As the developer, I want new Apps to include a passing smoke test, so that the test loop is proven from the start.
12. As the developer, I want each App to have a short README (purpose, script/deployment notes, GAS services and OAuth scopes used), so that agents read the App's context before touching it.
13. As an agent, I want a single `npm run check` command covering typecheck, lint, format and tests for all Apps, so that I have one clear definition of done.
14. As an agent, I want type checking of plain JS through JSDoc and GAS type definitions, so that I catch API misuse without a build step.
15. As the developer, I want no transpile/build step, so that the code I push is exactly the code in the repo.
16. As an agent, I want each App type-checked in isolation, so that global names in one App don't leak into or clash with another App's checks.
17. As an agent, I want ESLint configured for GAS globals (entry points not flagged as unused, cross-file globals not flagged as undefined), so that lint noise doesn't hide real problems.
18. As an agent, I want inline client-side scripts in HTML files linted too, so that frontend JS gets basic checks even though it isn't type-checked.
19. As an agent, I want Prettier formatting enforced by the check, so that diffs stay clean and consistent.
20. As an agent, I want to load an App's source into a test with one helper call, so that I can test GAS functions in Node.
21. As an agent, I want the test helper to put every App source file in one shared global scope, as GAS does, so that cross-file calls work in tests with no module boilerplate in source.
22. As an agent, I want top-level `const`/`let`/`class` declarations reachable from tests, so that I'm not limited to function declarations.
23. As an agent, I want the test helper to respect the App's clasp file push order when one is set, so that load order matches production.
24. As an agent, I want default mocks for common GAS services (HtmlService, Logger) that I can override or extend per test, so that tests stay short.
25. As an agent, I want to pass extra mocks (DriveApp and others) into the helper, so that I can test App logic that uses any GAS service.
26. As an agent, I want the scaffold command itself covered by an automated test, so that template drift or scaffold bugs are caught by the check.
27. As an agent, I want AGENTS.md to document GAS gotchas (shared global scope, no modules, V8 runtime, 6-minute execution limit, quotas), so that I don't write code that works in Node but fails in GAS.
28. As the developer, I want agents forbidden from running clasp, and told instead to say what I should push, so that I stay in control of what reaches GAS.
29. As an agent, I want the check commands pre-allowed in project permissions, so that I can iterate without permission prompts.
30. As the developer, I want a context map at the repo root pointing to each App's domain context, so that Apps with unrelated domains keep separate glossaries.
31. As the developer, I want a root glossary defining repo-wide terms such as App, so that agents use consistent language.
32. As the developer, I want per-App glossaries and ADRs created only when needed, so that docs don't fill up with empty placeholders.
33. As the developer, I want `.scratch/` feature folders prefixed with the App name (repo-wide work unprefixed), so that specs and tickets for different Apps are easy to tell apart.
34. As the developer, I want the key tooling decisions (plain JS + JSDoc with no build; tests running the App in a shared VM context) recorded as ADRs, so that future readers understand why.
35. As the developer, I want drive_downloader migrated to the standard layout with a minimal web app and smoke test, so that it's ready for feature work in a later session.
36. As the developer, I want the Node version pinned, so that agents and I use the same runtime.

## Implementation Decisions

- **App layout**: the App folder holds the clasp config (rootDir = the source folder), a source folder (manifest, backend `.js` files, frontend `.html` files), a test folder, a README and a per-App tsconfig. HTML is referenced from backend code by its path relative to the source folder (e.g. `frontend/index`).
- **Language**: plain JavaScript with JSDoc and `// @ts-check`, type-checked with `tsc --noEmit` against `@types/google-apps-script`. A shared base tsconfig; each App's tsconfig extends it and includes only that App's source. (ADR 0001)
- **Typecheck runner**: a small Node tool finds every App (a folder whose source folder contains `appsscript.json`) and type-checks each one in isolation. It fails if any App fails.
- **Test harness (`loadApp`)**:
  - Interface: `loadApp(appNameOrPath, mocks?)` returns an object whose property reads resolve to global names in the App's context: functions, `var`s, and top-level `const`/`let`/`class`.
  - Behaviour: collects all `.js` files under the App's source folder, ordered by the `.clasp.json` `filePushOrder` if set, otherwise sorted by path. Creates one Node `vm` context seeded with `console`, the default GAS mocks, then caller mocks (caller wins). Runs each file into that context as a separate script, so all files share one global lexical environment. Names are resolved by evaluating them inside the context.
  - Accepts either an App name (resolved against the repo root) or an absolute path, so it works on scaffolded Apps in temp folders. (ADR 0002)
- **Default GAS mocks**: minimal stubs for HtmlService (template/output creation from file, with chainable setters the template uses) and Logger. Apps add other services per test.
- **Lint**: ESLint flat config with recommended rules + Prettier compatibility. For App source: `no-undef` off (tsc covers it), `no-unused-vars` limited to local scope. Frontend HTML linted with `eslint-plugin-html`. Tooling and tests linted as Node ESM.
- **Format**: Prettier, check mode in the gate, write mode as its own script.
- **Scripts**: `typecheck`, `lint`, `format`, `format:check`, `test`, `check` (all four gates in sequence, fail-fast), `new-app`.
- **Scaffold (`new-app`)**:
  - Interface: `new-app <name> [--dest <dir>]`, where dest defaults to the repo root.
  - Validates the name as snake_case and checks the target doesn't already exist. Copies the template and substitutes the App name in templated files.
  - Prints next steps: bind with `clasp create --type webapp --rootDir src` from the App folder, then check the manifest wasn't overwritten.
  - Does not run clasp.
- **Template contents**: README skeleton, tsconfig, manifest with the agreed defaults, backend entry file (`doGet` serving the index page via a template, plus `include(filename)` returning file content), index page, smoke test using `loadApp`.
- **Frontend**: plain HtmlService templates with `include()` partials. Client JS and CSS live in `*.js.html` / `*.css.html` partials. Keep client logic thin; real logic goes server-side.
- **Permissions**: committed project settings allow the npm check scripts and the direct tool invocations (vitest, tsc, eslint, prettier), and deny any clasp invocation.
- **Git ignore**: `node_modules`, `.clasprc.json`.
- **Node**: pinned to 24 via `.nvmrc`. npm is the package manager, with a single root `package.json`.
- **Domain docs**: move to multi-context.
  - Root `CONTEXT-MAP.md` lists the root context and each App's context (drive_downloader: none yet).
  - Root `CONTEXT.md` defines **App**: one top-level folder = one Apps Script project; a web app by default, but that isn't required. Terms to avoid: "project", "script".
  - `docs/agents/domain.md` rewritten for multi-context, with per-App `CONTEXT.md` and `docs/adr/` created lazily.
- **Issue tracker convention**: `docs/agents/issue-tracker.md` gains the rule that feature slugs are prefixed with the App name, and repo-wide work is unprefixed.
- **AGENTS.md**: repo purpose; App layout; GAS gotchas; commands; testing via `loadApp`; "run `npm run check` before done"; "never run clasp, tell the user what to push"; "read the App README (and App CONTEXT.md if present) first". The existing skill sections stay, with the domain line updated to multi-context.
- **ADRs**:
  - 0001: plain JS + JSDoc, no build step.
  - 0002: tests evaluate all App sources in one shared `vm` context with mocked GAS globals, rather than module-export guards.
- **drive_downloader migration**: move the existing files into the standard layout, delete the now-empty old folders, and add the manifest, tsconfig, README (purpose TBD), minimal `doGet` + `include()`, and a smoke test. No feature work.

## Testing Decisions

- Good tests exercise external behaviour only: call GAS entry points and public App functions through `loadApp`, and assert on returned values and on calls to mocked services. Never assert on internal helpers' structure.
- Seams (agreed):
  1. **`loadApp`**: the single seam for all App code. Covered by the smoke tests in the template and in drive_downloader (`doGet` returns an HtmlService output built from the index template).
  2. **`npm run check`**: the gate for tooling. Checked by hand while implementing: plant a type error, a lint error, a format violation and a failing test, confirm each stage fails, then revert. No automated tests for the gate itself.
  3. **`new-app` CLI**: one automated test runs it into a temp folder, then asserts the expected folder shape, the name substitution, rejection of invalid or duplicate names, and that `loadApp` on the new App can call `doGet`.
- There's no prior art in the repo; these tests set the pattern.

## Out of Scope

- CI (GitHub Actions). Easy to add later on top of `npm run check`.
- Any clasp automation (push, deploy, create, pull). The user does all clasp work.
- drive_downloader features. Requirements come in a later session.
- TypeScript, bundlers, frontend frameworks, or single-file frontend builds.
- Unit-testing client-side JS inside HTML partials. It's linted only.
- End-to-end tests against deployed web apps.

## Further Notes

- `clasp create` may pull a manifest that overwrites the template's `appsscript.json`. The scaffold's next-steps output and the App README tell the user to check this.
- Browser-only code (in HTML partials) isn't type-checked. Keep it thin by convention.
- Manual verification after implementation: the user binds drive_downloader with clasp, pushes, opens the HEAD deployment and confirms the page renders and that only source-folder files were pushed.
