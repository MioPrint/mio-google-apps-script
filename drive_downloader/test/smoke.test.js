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

  it("getToken returns the OAuth token", () => {
    const app = loadApp("drive_downloader", {
      ScriptApp: { getOAuthToken: () => "test-token" },
    });

    expect(app.getToken()).toBe("test-token");
  });
});
