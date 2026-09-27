import { describe, expect, it } from "vitest";
import { loadApp } from "../../tools/load-app.js";

describe("drive_downloader", () => {
  it("doGet serves the Launcher Page with the Disk Window embedded", () => {
    const app = loadApp("drive_downloader");

    const content = app.doGet().getContent();

    expect(content).toContain("<h1>Drive Downloader</h1>");
    expect(content).toContain("Open Drive Downloader");
    // The embedded Disk Window is JSON-escaped, so its own <h1> only shows
    // up as an escaped <, never a real tag.
    expect(content).toContain("\\u003ch1>Drive Downloader\\u003c/h1>");
    expect(content).not.toContain("<?!=");
  });

  it("doGet's Launcher Page carries the user documentation", () => {
    const app = loadApp("drive_downloader");

    const content = app.doGet().getContent();

    for (const heading of [
      "Before you start",
      "1. Paste a folder link and Read Drive",
      "2. Choose a Location",
      "3. Adjust the options",
      "4. Download",
      "Item Statuses",
      "Right-tree Results",
      "Names and sizes",
      "Skip versus overwrite",
      "Shortcuts",
      "Native File exports",
      "Limits",
      "Sleep",
    ]) {
      expect(content).toContain(`<h2>${heading}</h2>`);
    }
  });

  it("getToken returns the OAuth token", () => {
    const app = loadApp("drive_downloader", {
      ScriptApp: { getOAuthToken: () => "test-token" },
    });

    expect(app.getToken()).toBe("test-token");
  });
});
