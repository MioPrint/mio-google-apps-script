import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

const CONTROLLER_PARTIALS = [
  "frontend/tree.js.html",
  "frontend/controller.js.html",
];

function createFakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => void values.set(key, value),
  };
}

function driveItem(overrides) {
  return {
    id: "id",
    parentId: "root",
    name: "name",
    mimeType: "text/plain",
    size: 10,
    createdTime: "2020-01-01T00:00:00.000Z",
    canDownload: true,
    ...overrides,
  };
}

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

  describe("readDrive", () => {
    it("builds the Tree from every chunk a step returns, fully expanded", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const steps = [
        {
          items: [driveItem({ id: "a", name: "a.txt" })],
          continuation: "cont-1",
        },
        { items: [driveItem({ id: "b", name: "b.txt" })], continuation: null },
      ];
      const serverPort = (fn, arg) => {
        if (fn === "treeReaderStart")
          return Promise.resolve({ folder, continuation: "cont-0" });
        if (fn === "treeReaderStep") {
          const step = arg === "cont-0" ? steps[0] : steps[1];
          return Promise.resolve(step);
        }
        throw new Error(`unexpected call: ${fn}`);
      };
      const controller = app.createController(serverPort, createFakeStorage());

      controller.setUrl("https://drive.google.com/drive/folders/root");
      const reading = controller.readDrive();
      expect(controller.getViewModel().reading).toBe(true);
      await reading;

      const vm = controller.getViewModel();
      expect(vm.reading).toBe(false);
      expect(vm.rows.map((r) => r.id)).toEqual(["root", "a", "b"]);
      expect(vm.rows.every((r) => !r.collapsed)).toBe(true);
    });

    it("remembers the last Source Folder URL across controllers", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const storage = createFakeStorage();
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({
              folder: { id: "root", name: "Holiday" },
              continuation: null,
            })
          : Promise.reject(new Error(`unexpected call: ${fn}`));
      const first = app.createController(serverPort, storage);
      first.setUrl("https://drive.google.com/drive/folders/root");
      await first.readDrive();

      const second = app.createController(serverPort, storage);

      expect(second.getViewModel().url).toBe(
        "https://drive.google.com/drive/folders/root",
      );
    });

    it.each([
      [
        "malformed",
        "That isn't a Google Drive folder URL. Paste a link like https://drive.google.com/drive/folders/...",
      ],
      ["notFound", "Folder not found, or you don't have access to it."],
      [
        "notAFolder",
        "That link opens a file, not a folder. Paste a folder URL.",
      ],
      ["empty", "That folder is empty. Nothing to download."],
    ])("shows the %s error in the view model", async (kind, message) => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const serverPort = () => Promise.resolve({ error: kind });
      const controller = app.createController(serverPort, createFakeStorage());

      controller.setUrl("https://drive.google.com/drive/whatever");
      await controller.readDrive();

      const vm = controller.getViewModel();
      expect(vm.urlError).toBe(message);
      expect(vm.rows).toEqual([]);
      expect(vm.reading).toBe(false);
    });

    it("never rejects: an unexpected server error surfaces as a urlError instead", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const serverPort = () =>
        Promise.reject(new Error("Drive files.list failed: 500"));
      const controller = app.createController(serverPort, createFakeStorage());

      controller.setUrl("https://drive.google.com/drive/folders/root");
      await expect(controller.readDrive()).resolves.toBeUndefined();

      const vm = controller.getViewModel();
      expect(vm.urlError).toBe(
        "Couldn't read Drive: Drive files.list failed: 500",
      );
      expect(vm.reading).toBe(false);
    });
  });

  describe("collapse state", () => {
    async function readSampleTree() {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const items = [
        driveItem({
          id: "sub",
          name: "Sub",
          mimeType: "application/vnd.google-apps.folder",
        }),
        driveItem({ id: "leaf", parentId: "sub", name: "leaf.txt" }),
      ];
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage());
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();
      return controller;
    }

    it("toggleCollapsed hides a folder's rows, expandAll and collapseAll override it", async () => {
      const controller = await readSampleTree();

      controller.toggleCollapsed("sub");
      expect(controller.getViewModel().rows.map((r) => r.id)).toEqual([
        "root",
        "sub",
      ]);

      controller.expandAll();
      expect(controller.getViewModel().rows.map((r) => r.id)).toEqual([
        "root",
        "sub",
        "leaf",
      ]);

      controller.collapseAll();
      expect(controller.getViewModel().rows.map((r) => r.id)).toEqual([
        "root",
        "sub",
      ]);
    });
  });
});
