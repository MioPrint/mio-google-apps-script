# Spec: AI dev setup — code-review fixes

Labels: ready-for-agent

Follow-up to `.scratch/ai-dev-setup/spec.md`. Where the two disagree, this spec amends that one.

## Problem Statement

The AI dev setup is implemented and `npm run check` passes. A two-axis code review against the original spec still found a few concrete defects and small gaps:

- Frontend HTML lint flags ordinary client code. A function called from an `onclick` attribute is reported as unused.
- The `new-app` command's "run directly" check compares URLs built by hand. If the repo path has characters that get URL-encoded (e.g. a space), the command exits 0 without doing anything or printing anything.
- `loadApp` ignores `.clasp.json` `filePushOrder` entries it can't match. They are silently dropped and the files fall back to path order. Entries prefixed with the source folder (`src/...`) never match.
- The template is skipped by typecheck, so type drift in it goes unnoticed until someone scaffolds an App.
- `loadApp` behaviours the spec relies on (top-level `const`/`let`/`class` visible across files, caller mocks winning, `filePushOrder`) have no automated tests.
- Agents can't run `npm test` without a permission prompt.
- AGENTS.md says an App's `.clasp.json` is "committed", but no App has one yet. The scaffold's next steps never tell the user to commit it.
- The frontend partials convention is not documented anywhere agents read.
- App READMEs have a "Services & scopes" section that lists services only, with nowhere to record OAuth scopes.

No real Apps exist yet, so the tooling is unproven. The fixes must stay small, with no refactoring.

## Solution

Fix the defects and close the gaps with small, local changes:

- HTML lint treats top-level client functions like App source does.
- The `new-app` command runs reliably from any path.
- `loadApp` accepts `filePushOrder` entries in either path form and fails loudly on entries it can't match.
- Typecheck covers the template.
- New tests pin down `loadApp`'s core behaviour.
- One more check command is allowed without a prompt.
- AGENTS.md, the scaffold output and the READMEs say what to commit, how frontend code is organised, and where scopes go.

Refactoring findings from the review (duplicated file walks, the list of non-App folders kept in several places, unused mock surface, placeholder literals) are deliberately left alone until real Apps exist.

## User Stories

1. As an agent, I want a top-level function in an HTML partial that is only called from markup (e.g. `onclick`) not to be flagged as unused, so that `npm run check` doesn't fail on normal client code.
2. As an agent, I want undefined names in client code still flagged by lint, so that typos in browser code, which tsc never checks, are still caught.
3. As an agent, I want a documented way to declare a helper shared across partials (a `/* global name */` comment), so that code split across `include()`d partials lints cleanly.
4. As the developer, I want `npm run new-app` to scaffold and print next steps no matter what characters the repo path contains, so that it never silently does nothing.
5. As the developer, I want the scaffold's next steps to tell me to commit the `.clasp.json` that `clasp create` produces, so that each App's clasp binding ends up in the repo as the layout requires.
6. As an agent, I want `loadApp` to accept `filePushOrder` entries written relative to the App's source folder, so that the existing form keeps working.
7. As an agent, I want `loadApp` to also accept `filePushOrder` entries written relative to the App folder (prefixed with the source folder), so that either form clasp may expect works in tests.
8. As an agent, I want `loadApp` to throw a clear error naming any `filePushOrder` entry that matches no source file, so that a misconfigured push order never silently changes the evaluation order.
9. As an agent, I want files listed in `filePushOrder` evaluated first in the listed order, and the rest after them in path order, so that tests match how GAS loads the App.
10. As an agent, I want a test proving top-level `const`, `let` and `class` in one file are visible from another file and through `loadApp`'s returned object, so that the shared-global-scope contract (ADR 0002) can't regress unnoticed.
11. As an agent, I want a test proving caller mocks override the default GAS mocks, so that per-test service stubs are reliable.
12. As an agent, I want tests proving both `filePushOrder` path forms are honoured and that an unmatched entry throws, so that the new behaviour is pinned down.
13. As the developer, I want typecheck to include the template's source, so that template drift is caught by `npm run check` rather than after scaffolding.
14. As an agent, I want `npm test` allowed in the committed project permissions alongside `npm run test`, so that I can run tests either way without a prompt.
15. As an agent, I want AGENTS.md's App layout to say `.clasp.json` is created by `clasp create` and must then be committed, so that an unbound App without one isn't mistaken for a layout violation.
16. As an agent, I want AGENTS.md to describe the frontend convention (HtmlService templates with `include()` partials, client JS/CSS in `*.js.html` / `*.css.html`, thin client logic, real logic server-side), so that I organise frontend code consistently.
17. As the developer, I want each App README, and the template's README, to list OAuth scopes (currently "none yet") next to services, so that the scopes an App needs are recorded as the spec asks.
18. As an agent, I want the ESLint config's description comment to match the actual HTML rules, so that the config documents itself accurately.
19. As the developer, I want the stray shebang removed from the ESLint config, so that a config file doesn't pretend to be an executable.

## Implementation Decisions

- **Lint (HTML scope)**: `no-unused-vars` limited to local scope, the same as App source. `no-undef` stays on, since it is the only undefined-name backstop for browser code. A helper shared across partials is declared with an ESLint `/* global name */` comment. The config's description comment is updated, and the shebang is removed.
- **`new-app` CLI**: the "run directly" check converts the invoked script path to a file URL with Node's standard path-to-URL conversion before comparing it with the module URL. The next-steps output gains a line telling the user to commit `.clasp.json` after `clasp create`. The interface is otherwise unchanged.
- **`loadApp` push order**:
  - Each `filePushOrder` entry, with its extension removed, may match a source file by its path relative to the source folder or relative to the App folder.
  - An entry that matches no source `.js` file makes `loadApp` throw an error naming the entry.
  - Listed files are evaluated first in list order, then the rest in path order.
  - The `loadApp` interface is unchanged. Amends the original spec's "ordered by the `.clasp.json` `filePushOrder` if set".
- **Typecheck runner**: the template is no longer excluded from App discovery. It gets type-checked like an App, with its own tsconfig. The test runner still excludes the template's own test folder, because its smoke test uses the unsubstituted name placeholder. The `new-app` test already covers `loadApp` on a scaffolded App.
- **Permissions**: committed project settings add `npm test` to the allowed commands. The clasp deny rules are unchanged. `npm run format` stays allowed.
- **AGENTS.md**: the App layout line for `.clasp.json` becomes "created by `clasp create`; commit it". Add a short Frontend note stating the partials convention above.
- **READMEs**: the template README and drive_downloader's README each gain an "OAuth scopes: none yet" line under "Services & scopes".
- **Deliberately unchanged** (review judgement calls):
  - Typecheck and `loadApp` each resolve the source folder their own way. AGENTS.md mandates `src`, so revisit once a real `.clasp.json` exists.
  - The duplicated file-walk helpers.
  - The list of non-App folders spread across typecheck, test and lint config.
  - The unused HtmlService mock setters.
  - The inline placeholder strings.
  - The `engines` pin and the `.clasp.json` Prettier ignore.

## Testing Decisions

- Good tests assert external behaviour only: values reachable through `loadApp`'s returned object, the order in which files ran (observed through globals the App files set), thrown errors, and CLI output and exit codes. They don't assert on internal helpers.
- Seams (all existing, agreed):
  1. **`loadApp`**: new direct tests using throwaway App fixtures written to a temp folder and loaded by absolute path. They cover:
     - top-level `const`/`let`/`class` visible across files and through the returned object
     - a caller mock overriding the default HtmlService mock
     - `filePushOrder` honoured in both path forms, with unlisted files after
     - an unmatched entry throwing
  2. **`new-app` CLI**: extend the existing CLI test to assert the next steps include the commit-`.clasp.json` line. The existing subprocess test also covers the fixed "run directly" check for normal paths.
  3. **`npm run check`**: checked by hand, not automated.
     - A temporary HTML partial with a top-level function called only from `onclick` lints clean; revert it.
     - A planted type error in the template's backend makes typecheck fail; revert it.
- Prior art: the `new-app` test (temp-folder fixtures, subprocess CLI runs) and the smoke tests in drive_downloader and the template.

## Out of Scope

- Refactors from the review's smell findings (shared App-discovery helper, shared file walk, token map for placeholders, trimming default mocks).
- Unifying how typecheck and `loadApp` find the source folder.
- Committing a stub `.clasp.json` for unbound Apps.
- Confirming clasp's exact `filePushOrder` path format. Accepting both forms makes it moot for tests.
- Adding example partials or `include()` usage to the template.
- CI, and anything else the original spec lists as out of scope.

## Further Notes

- Source: the two-axis `/code-review` of `8aa4088...HEAD` against `.scratch/ai-dev-setup/spec.md`.
- Planned as one small ticket's worth of work. Split further only if `/to-tickets` finds a natural seam.
