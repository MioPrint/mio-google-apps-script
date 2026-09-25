# 01: loadApp: filePushOrder in both path forms, loud on unmatched entries, plus core tests

Spec: `.scratch/ai-dev-setup-review-fixes/spec.md`

**What to build:** `loadApp` honours `.clasp.json` `filePushOrder` entries written relative to either the App's source folder or the App folder. It throws a clear error naming any entry that matches no source file, instead of silently falling back to path order. New automated tests pin down the `loadApp` contract from ADR 0002: shared global scope across files, caller mocks winning over defaults, and push order.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A `filePushOrder` entry (extension ignored) matches a source file by its path relative to the source folder
- [ ] A `filePushOrder` entry prefixed with the source folder (relative to the App folder) matches the same file
- [ ] Listed files are evaluated first in list order; the rest follow in path order
- [ ] An entry matching no source `.js` file makes `loadApp` throw an error that names the entry
- [ ] The `loadApp` interface is unchanged; existing smoke and `new-app` tests still pass
- [ ] New tests use throwaway App fixtures in a temp folder, loaded by absolute path, and cover:
  - [ ] top-level `const`/`let`/`class` in one file are visible from another file and through the returned object
  - [ ] a caller mock overrides the default HtmlService mock
  - [ ] `filePushOrder` honoured in both path forms, with unlisted files after
  - [ ] an unmatched entry throws
- [ ] Tests assert external behaviour only: evaluation order observed through globals the fixture files set, not internal helpers
- [ ] `npm run check` passes
