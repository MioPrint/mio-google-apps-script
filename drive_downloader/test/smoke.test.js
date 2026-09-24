import { describe, expect, it } from "vitest";
import { loadApp } from "../../tools/load-app.js";

describe("drive_downloader", () => {
  it("doGet serves the index template", () => {
    const app = loadApp("drive_downloader");

    const output = app.doGet();

    expect(output.getContent()).toContain("<h1>Drive Downloader</h1>");
  });
});
