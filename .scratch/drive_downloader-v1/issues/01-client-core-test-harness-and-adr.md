# 01: Client-core test harness and ADR

Spec: `.scratch/drive_downloader-v1/spec.md`

**What to build:** Prefactor that makes the Disk Window core testable. A new harness helper, beside `loadApp`, evaluates an App's client script partials (`*.js.html`) into one `vm` context the way the browser runs them, with caller-supplied fakes for the Drive, disk and server ports and browser globals. An ADR in drive_downloader records why this App keeps its real logic client-side (bytes and disk access only exist in the browser), departing from the AGENTS.md "keep client logic thin" rule.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Helper loads the listed client partials in order, strips the `<script>` wrapper, and runs them in one shared `vm` context; top-level declarations resolve as globals (same semantics as `loadApp`)
- [x] Caller globals/fakes are seeded into the context (caller wins over defaults)
- [x] Clear error when a listed partial is missing or holds no script
- [x] The helper has its own tests, alongside `loadApp`'s
- [x] drive_downloader has one trivial client partial and a test proving it loads through the helper
- [x] ADR in `drive_downloader/docs/adr/` (client-side core, three ports, two test layers); `CONTEXT-MAP.md` / App docs point to it as `docs/agents/domain.md` expects
- [x] AGENTS.md "Testing" section mentions the new helper
- [x] `npm run check` passes
