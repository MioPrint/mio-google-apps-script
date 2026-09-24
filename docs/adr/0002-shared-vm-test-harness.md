# Test harness runs App sources in one shared vm context

`loadApp` evaluates every `.js` file under an App's `src/` into a single
Node `vm` context, in clasp's file-push order, rather than requiring source
files to export via `module.exports` guards. This mirrors how GAS actually
loads a project — every file sharing one global scope — so tests exercise
the real cross-file global wiring, and App source stays free of Node-only
module boilerplate that would never run in GAS.
