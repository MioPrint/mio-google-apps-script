import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadClientCore } from "./load-client-core.js";

describe("loadClientCore", () => {
  let appDir;

  beforeEach(() => {
    appDir = fs.mkdtempSync(path.join(os.tmpdir(), "load-client-core-test-"));
  });

  afterEach(() => {
    fs.rmSync(appDir, { recursive: true, force: true });
  });

  function writeFiles(files) {
    for (const [relPath, content] of Object.entries(files)) {
      const full = path.join(appDir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
  }

  it("shares top-level const, let and class across partials and with the caller", () => {
    writeFiles({
      "src/frontend/a.js.html": [
        "<script>",
        "  const GREETING = 'hi';",
        "  let counter = 1;",
        "  class Greeter { greet(name) { return `${GREETING} ${name}`; } }",
        "</script>",
      ].join("\n"),
      "src/frontend/b.js.html": [
        "<script>",
        "  function greetFromB() { return new Greeter().greet('b'); }",
        "  function bumpCounter() { counter += 1; return counter; }",
        "</script>",
      ].join("\n"),
    });

    const app = loadClientCore(appDir, [
      "frontend/a.js.html",
      "frontend/b.js.html",
    ]);

    expect(app.greetFromB()).toBe("hi b");
    expect(app.bumpCounter()).toBe(2);
    expect(app.GREETING).toBe("hi");
    expect(app.counter).toBe(2);
    expect(new app.Greeter().greet("x")).toBe("hi x");
  });

  it("runs partials in the given list order, not file order", () => {
    writeFiles({
      "src/frontend/a.js.html": "<script>order.push('a');</script>",
      "src/frontend/b.js.html": "<script>order.push('b');</script>",
    });

    const app = loadClientCore(
      appDir,
      ["frontend/b.js.html", "frontend/a.js.html"],
      { order: [] },
    );

    expect(app.order).toEqual(["b", "a"]);
  });

  it("seeds caller-supplied fakes into the context", () => {
    writeFiles({
      "src/frontend/core.js.html": [
        "<script>",
        "  function fetchToken() { return serverPort.getToken(); }",
        "</script>",
      ].join("\n"),
    });
    const serverPort = { getToken: () => "fake-token" };

    const app = loadClientCore(appDir, ["frontend/core.js.html"], {
      serverPort,
    });

    expect(app.fetchToken()).toBe("fake-token");
  });

  it("lets a caller global win over the helper's own default of the same name", () => {
    writeFiles({
      "src/frontend/core.js.html": "<script>console.log('hi');</script>",
    });
    const fakeConsole = { log: () => {} };

    const app = loadClientCore(appDir, ["frontend/core.js.html"], {
      console: fakeConsole,
    });

    expect(app.console).toBe(fakeConsole);
  });

  it("strips the <script> wrapper, including attributes, before evaluating", () => {
    writeFiles({
      "src/frontend/core.js.html":
        '<script type="text/javascript">\n  function value() { return 42; }\n</script>',
    });

    const app = loadClientCore(appDir, ["frontend/core.js.html"]);

    expect(app.value()).toBe(42);
  });

  it("throws a clear error when a listed partial is missing", () => {
    writeFiles({ "src/frontend/a.js.html": "<script></script>" });

    expect(() =>
      loadClientCore(appDir, [
        "frontend/a.js.html",
        "frontend/missing.js.html",
      ]),
    ).toThrow(/frontend\/missing\.js\.html.*not found/);
  });

  it("throws a clear error when a listed partial holds no <script> block", () => {
    writeFiles({ "src/frontend/empty.js.html": "<p>not a script</p>" });

    expect(() => loadClientCore(appDir, ["frontend/empty.js.html"])).toThrow(
      /frontend\/empty\.js\.html.*no <script> block/,
    );
  });
});
