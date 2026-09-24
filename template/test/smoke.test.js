import { describe, expect, it } from "vitest";
import { loadApp } from "../../tools/load-app.js";

describe("%%APP_NAME%%", () => {
  it("doGet serves the index template", () => {
    const app = loadApp("%%APP_NAME%%");

    const output = app.doGet();

    expect(output.getContent()).toContain("<h1>%%APP_TITLE%%</h1>");
  });
});
