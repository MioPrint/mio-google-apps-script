# 04: Agent guidance, domain docs and permissions

Spec: `.scratch/ai-dev-setup/spec.md`

**What to build:** Agents arriving in the repo know its conventions and commands, the GAS gotchas, and the clasp policy. They use the multi-context domain docs, and they can run the checks without prompts but can never run clasp.

**Blocked by:** 03 (`new-app` scaffold and template)

**Status:** ready-for-agent

- [x] AGENTS.md covers:
  - repo purpose and App layout
  - GAS gotchas: shared global scope across files, no modules, V8, 6-minute execution limit, quotas
  - commands: `check`, `new-app`, formatting
  - testing via `loadApp`
  - `npm run check` must pass before done
  - never run clasp; tell the user what to push
  - read the App README (and App CONTEXT.md if present) first
  - existing skill sections kept; domain line updated to multi-context
- [x] Root CONTEXT.md defines **App** (one top-level folder = one Apps Script project; web app by default, not required), with terms to avoid: project, script
- [x] Root CONTEXT-MAP.md lists the root context and each App context (drive_downloader: none yet)
- [x] `docs/agents/domain.md` rewritten for multi-context, with per-App CONTEXT.md and `docs/adr/` created lazily
- [x] `docs/agents/issue-tracker.md`: feature slugs prefixed with the App name; repo-wide work unprefixed
- [x] ADR 0001: plain JS + JSDoc + `tsc --noEmit`, no build step
- [x] ADR 0002: tests evaluate all App sources in one shared `vm` context with mocked GAS globals, not module-export guards
- [x] Committed project Claude settings: allow npm check scripts and direct vitest/tsc/eslint/prettier; deny any clasp invocation
- [x] `npm run check` passes (docs formatted)
