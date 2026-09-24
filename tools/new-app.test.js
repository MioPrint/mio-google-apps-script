import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadApp } from "./load-app.js";
import { ScaffoldError, scaffoldApp } from "./new-app.js";

const CLI_PATH = fileURLToPath(new URL("./new-app.js", import.meta.url));

describe("scaffoldApp", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "new-app-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the expected folder shape with the name substituted", () => {
    const target = scaffoldApp("my_test_app", tmpDir);

    expect(target).toBe(path.join(tmpDir, "my_test_app"));
    expect(fs.existsSync(path.join(target, "src", "appsscript.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(target, "src", "backend", "Code.js"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(target, "src", "frontend", "index.html")),
    ).toBe(true);
    expect(fs.existsSync(path.join(target, "test", "smoke.test.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(target, "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(target, "README.md"))).toBe(true);

    const readme = fs.readFileSync(path.join(target, "README.md"), "utf8");
    expect(readme).toContain("# My Test App");
    expect(readme).not.toContain("%%APP_TITLE%%");

    const indexHtml = fs.readFileSync(
      path.join(target, "src", "frontend", "index.html"),
      "utf8",
    );
    expect(indexHtml).toContain("<h1>My Test App</h1>");
    expect(indexHtml).not.toContain("%%APP_TITLE%%");

    const smokeTest = fs.readFileSync(
      path.join(target, "test", "smoke.test.js"),
      "utf8",
    );
    expect(smokeTest).toContain('loadApp("my_test_app")');
    expect(smokeTest).not.toContain("%%APP_NAME%%");
  });

  it("rejects names that aren't snake_case", () => {
    for (const badName of ["MyApp", "my-app", "my app", "1app", "_my_app"]) {
      expect(() => scaffoldApp(badName, tmpDir)).toThrow(ScaffoldError);
    }
  });

  it("rejects a target that already exists", () => {
    scaffoldApp("dup_app", tmpDir);

    expect(() => scaffoldApp("dup_app", tmpDir)).toThrow(ScaffoldError);
  });

  it("scaffolds an App that loadApp can call doGet on", () => {
    const target = scaffoldApp("loadable_app", tmpDir);

    const app = loadApp(target);
    const output = app.doGet();

    expect(output.getContent()).toContain("<h1>Loadable App</h1>");
  });
});

describe("new-app CLI", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "new-app-cli-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates an App and prints next steps", () => {
    const output = execFileSync(
      process.execPath,
      [CLI_PATH, "cli_app", "--dest", tmpDir],
      { encoding: "utf8" },
    );

    expect(output).toContain("Created App 'cli_app'");
    expect(output).toContain("clasp create --type webapp --rootDir src");
    expect(fs.existsSync(path.join(tmpDir, "cli_app", "README.md"))).toBe(true);
  });

  it("exits non-zero with a clear message for an invalid name", () => {
    expect.assertions(2);
    try {
      execFileSync(
        process.execPath,
        [CLI_PATH, "Not-Snake-Case", "--dest", tmpDir],
        { encoding: "utf8", stdio: "pipe" },
      );
    } catch (err) {
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("snake_case");
    }
  });

  it("exits non-zero for an unrecognized argument, e.g. a --dest npm swallowed", () => {
    expect.assertions(2);
    try {
      execFileSync(process.execPath, [CLI_PATH, "cli_app", tmpDir], {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (err) {
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("unrecognized argument");
    }
  });

  it("exits non-zero for a duplicate target", () => {
    expect.assertions(2);
    execFileSync(
      process.execPath,
      [CLI_PATH, "dup_cli_app", "--dest", tmpDir],
      {
        encoding: "utf8",
      },
    );

    try {
      execFileSync(
        process.execPath,
        [CLI_PATH, "dup_cli_app", "--dest", tmpDir],
        { encoding: "utf8", stdio: "pipe" },
      );
    } catch (err) {
      expect(err.status).not.toBe(0);
      expect(err.stderr).toContain("already exists");
    }
  });
});
