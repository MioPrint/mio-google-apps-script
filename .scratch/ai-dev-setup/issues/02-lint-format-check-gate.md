# 02: Lint, format and the `npm run check` gate

Spec: `.scratch/ai-dev-setup/spec.md`

**What to build:** A single command, `npm run check`, that agents run as their definition of done. It runs typecheck, lint, format check and tests in sequence and stops at the first failure. Lint understands GAS globals and also covers inline client scripts in HTML.

**Blocked by:** 01 (Tracer bullet: drive_downloader typechecks and tests via loadApp)

**Status:** ready-for-agent

- [ ] ESLint flat config: recommended + Prettier compatibility
- [ ] App source: `no-undef` off, `no-unused-vars` limited to local scope, so GAS entry points and cross-file globals are not flagged
- [ ] Frontend HTML linted via `eslint-plugin-html`
- [ ] Tooling and tests linted as Node ESM
- [ ] Prettier config + ignore file; `format` (write) and `format:check` scripts
- [ ] `lint` script; `check` script runs typecheck → lint → format:check → test, fail-fast
- [ ] Repo formatted; `npm run check` passes
- [ ] Checked by hand: a planted lint error, a format violation and a failing test each make `check` fail (then reverted)
