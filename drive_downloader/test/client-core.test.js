import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

describe("drive_downloader Disk Window core", () => {
  it("loads core.js.html through loadClientCore", () => {
    const app = loadClientCore("drive_downloader", ["frontend/core.js.html"]);

    expect(app.coreLoaded()).toBe(true);
  });

  it("the controller obtains a token through a fake server port", async () => {
    const app = loadClientCore("drive_downloader", [
      "frontend/controller.js.html",
    ]);
    const serverPort = (fn) => Promise.resolve(`${fn}-value`);

    const controller = app.createController(serverPort);

    await expect(controller.getToken()).resolves.toBe("getToken-value");
  });

  it("the controller rejects with the server port's error", async () => {
    const app = loadClientCore("drive_downloader", [
      "frontend/controller.js.html",
    ]);
    const serverPort = () => Promise.reject(new Error("server exploded"));

    const controller = app.createController(serverPort);

    await expect(controller.getToken()).rejects.toThrow("server exploded");
  });
});
