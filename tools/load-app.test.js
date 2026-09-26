import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadApp } from "./load-app.js";

describe("loadApp", () => {
  let appDir;

  beforeEach(() => {
    appDir = fs.mkdtempSync(path.join(os.tmpdir(), "load-app-test-"));
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

  function writeClasp(filePushOrder) {
    writeFiles({
      ".clasp.json": JSON.stringify({ rootDir: "src", filePushOrder }),
    });
  }

  it("shares top-level const, let and class across files and with the caller", () => {
    writeFiles({
      "src/a.js": [
        "const GREETING = 'hi';",
        "let counter = 1;",
        "class Greeter { greet(name) { return `${GREETING} ${name}`; } }",
      ].join("\n"),
      "src/b.js": [
        "function greetFromB() { return new Greeter().greet('b'); }",
        "function bumpCounter() { counter += 1; return counter; }",
      ].join("\n"),
    });

    const app = loadApp(appDir);

    expect(app.greetFromB()).toBe("hi b");
    expect(app.bumpCounter()).toBe(2);
    expect(app.GREETING).toBe("hi");
    expect(app.counter).toBe(2);
    expect(new app.Greeter().greet("x")).toBe("hi x");
  });

  it("lets a caller mock override the default HtmlService mock", () => {
    writeFiles({
      "src/Code.js":
        "function doGet() { return HtmlService.createTemplateFromFile('missing').evaluate(); }",
    });
    const HtmlService = {
      createTemplateFromFile: (name) => ({ evaluate: () => `stub:${name}` }),
    };

    const app = loadApp(appDir, { HtmlService });

    expect(app.doGet()).toBe("stub:missing");
  });

  it("evaluates files in path order without a filePushOrder", () => {
    writeFiles({
      "src/b.js": "order.push('b');",
      "src/a.js": "order.push('a');",
    });

    const app = loadApp(appDir, { order: [] });

    expect(app.order).toEqual(["a", "b"]);
  });

  it("honours filePushOrder relative to the source folder, unlisted files after", () => {
    writeFiles({
      "src/a.js": "order.push('a');",
      "src/b.js": "order.push('b');",
      "src/backend/c.js": "order.push('c');",
      "src/backend/d.js": "order.push('d');",
    });
    writeClasp(["backend/d.js", "b.js"]);

    const app = loadApp(appDir, { order: [] });

    expect(app.order).toEqual(["d", "b", "a", "c"]);
  });

  it("honours filePushOrder prefixed with the source folder", () => {
    writeFiles({
      "src/a.js": "order.push('a');",
      "src/b.js": "order.push('b');",
      "src/backend/c.js": "order.push('c');",
      "src/backend/d.js": "order.push('d');",
    });
    writeClasp(["src/backend/d.js", "src/b"]);

    const app = loadApp(appDir, { order: [] });

    expect(app.order).toEqual(["d", "b", "a", "c"]);
  });

  it("throws naming a filePushOrder entry that matches no source file", () => {
    writeFiles({ "src/a.js": "order.push('a');" });
    writeClasp(["a.js", "backend/nope.js"]);

    expect(() => loadApp(appDir)).toThrow("backend/nope.js");
  });

  it("evaluates a template's printing scriptlets, escaping <?= ?> but not <?!= ?>", () => {
    writeFiles({
      "src/Code.js":
        "function doGet() { return HtmlService.createTemplateFromFile('frontend/index').evaluate(); }" +
        "function greeting() { return 'A & B'; }",
      "src/frontend/index.html":
        "<p><?= greeting() ?></p><p><?!= greeting() ?></p>",
    });

    const app = loadApp(appDir);

    expect(app.doGet().getContent()).toBe("<p>A &amp; B</p><p>A & B</p>");
  });
});
