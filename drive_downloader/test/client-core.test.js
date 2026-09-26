import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

describe("drive_downloader Disk Window core", () => {
  it("loads core.js.html through loadClientCore", () => {
    const app = loadClientCore("drive_downloader", ["frontend/core.js.html"]);

    expect(app.coreLoaded()).toBe(true);
  });
});
