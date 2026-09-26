import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";
import { createFakeDirectory, domError, fakeFile } from "./fake-disk.js";

const CONTROLLER_PARTIALS = [
  "frontend/tree.js.html",
  "frontend/naming.js.html",
  "frontend/target-scan.js.html",
  "frontend/merge.js.html",
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
    const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
    const serverPort = (fn) => Promise.resolve(`${fn}-value`);

    const controller = app.createController(serverPort);

    await expect(controller.getToken()).resolves.toBe("getToken-value");
  });

  it("the controller rejects with the server port's error", async () => {
    const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
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
      expect(vm.rows.map((r) => r.left.id)).toEqual(["root", "a", "b"]);
      expect(vm.rows.every((r) => !r.left.collapsed)).toBe(true);
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
      expect(controller.getViewModel().rows.map((r) => r.left.id)).toEqual([
        "root",
        "sub",
      ]);

      controller.expandAll();
      expect(controller.getViewModel().rows.map((r) => r.left.id)).toEqual([
        "root",
        "sub",
        "leaf",
      ]);

      controller.collapseAll();
      expect(controller.getViewModel().rows.map((r) => r.left.id)).toEqual([
        "root",
        "sub",
      ]);
    });
  });
  describe("Location and Target Folder", () => {
    const SOURCE_URL = "https://drive.google.com/drive/folders/root";

    function createFakeHandleStore(initial = null) {
      let value = initial;
      return {
        get: async () => value,
        set: async (handle) => {
          value = handle;
        },
      };
    }

    function createFakePicker(...handles) {
      const picker = async (startIn) => {
        picker.startIns.push(startIn);
        const next = handles.shift();
        if (next instanceof Error) throw next;
        return next;
      };
      picker.startIns = [];
      return picker;
    }

    // A server port for a Source Folder "Holiday 2025" holding a.txt.
    function holidayServerPort(fn) {
      if (fn === "treeReaderStart")
        return Promise.resolve({
          folder: { id: "root", name: "Holiday 2025" },
          continuation: "cont",
        });
      return Promise.resolve({
        items: [driveItem({ id: "a", name: "a.txt" })],
        continuation: null,
      });
    }

    function setup({ picker, handleStore, onChange } = {}) {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const ports = {
        pickDirectory: picker || createFakePicker(),
        handleStore: handleStore || createFakeHandleStore(),
        onChange,
      };
      const controller = app.createController(
        holidayServerPort,
        createFakeStorage(),
        ports,
      );
      controller.setUrl(SOURCE_URL);
      return { controller, ports };
    }

    function rightNames(vm) {
      return vm.rows.filter((r) => r.right).map((r) => r.right.name);
    }

    it("starts with no folder chosen and Download disabled", () => {
      const { controller } = setup();

      const vm = controller.getViewModel();

      expect(vm.locationText).toBe("No folder chosen");
      expect(vm.hasTarget).toBe(false);
      expect(vm.refreshVisible).toBe(false);
      expect(vm.downloadDisabled).toBe(true);
    });

    it("opens the picker in Downloads first, then at the remembered folder", async () => {
      const backup = createFakeDirectory("Backup");
      const other = createFakeDirectory("Other");
      const picker = createFakePicker(backup, other);
      const { controller } = setup({ picker });

      await controller.chooseLocation();
      await controller.chooseLocation();

      expect(picker.startIns).toEqual(["downloads", backup]);
      expect(controller.getViewModel().locationText).toBe("📁 Other");
    });

    it("reads the Target Folder when chosen, showing a running count, and shows it alone with no Tree", async () => {
      const backup = createFakeDirectory("Backup", {
        "a.txt": fakeFile({ size: 1 }),
        Sub: { "b.txt": fakeFile({ size: 1 }) },
      });
      const scanTexts = [];
      let controller;
      ({ controller } = setup({
        picker: createFakePicker(backup),
        onChange: () =>
          scanTexts.push(controller.getViewModel().targetScanText),
      }));

      await controller.chooseLocation();

      const vm = controller.getViewModel();
      expect(scanTexts).toContain("Reading Target Folder… 3 items");
      expect(vm.targetScanText).toBe(null);
      expect(vm.locationText).toBe("📁 Backup");
      expect(vm.hasTarget).toBe(true);
      expect(rightNames(vm)).toEqual(["Backup", "Sub", "a.txt"]);
      expect(vm.downloadDisabled).toBe(true);
    });

    it("keeps Download disabled until both the Tree and the Target Folder are read", async () => {
      const { controller } = setup({
        picker: createFakePicker(createFakeDirectory("Backup")),
      });

      await controller.readDrive();
      expect(controller.getViewModel().downloadDisabled).toBe(true);

      const choosing = controller.chooseLocation();
      expect(controller.getViewModel().downloadDisabled).toBe(true);
      await choosing;

      const vm = controller.getViewModel();
      expect(vm.downloadDisabled).toBe(false);
      expect(vm.rows.map((r) => r.right && r.right.result)).toEqual([
        "target",
        "new folder",
        "new",
      ]);
    });

    it("ignores a cancelled picker", async () => {
      const picker = createFakePicker(domError("AbortError"));
      const { controller } = setup({ picker });

      await controller.chooseLocation();

      const vm = controller.getViewModel();
      expect(vm.locationText).toBe("No folder chosen");
      expect(vm.targetError).toBe(null);
    });

    it("remembers the folder across visits, re-reading it when permission still holds", async () => {
      const backup = createFakeDirectory("Backup", { "a.txt": fakeFile() });
      const handleStore = createFakeHandleStore();
      const first = setup({ picker: createFakePicker(backup), handleStore });
      await first.controller.chooseLocation();

      const { controller } = setup({ handleStore });
      await controller.restoreLocation();

      const vm = controller.getViewModel();
      expect(vm.locationText).toBe("📁 Backup");
      expect(rightNames(vm)).toEqual(["Backup", "a.txt"]);
    });

    it("asks for permission again on a new visit: Refresh re-requests it and reads the folder", async () => {
      const backup = createFakeDirectory("Backup", { "a.txt": fakeFile() });
      backup.fake.permission = "prompt";
      const { controller } = setup({
        handleStore: createFakeHandleStore(backup),
      });

      await controller.restoreLocation();
      let vm = controller.getViewModel();
      expect(vm.locationText).toBe("📁 Backup");
      expect(vm.targetError).toMatch(/Refresh/);
      expect(vm.refreshVisible).toBe(true);
      expect(vm.hasTarget).toBe(false);

      await controller.refreshTarget();
      vm = controller.getViewModel();
      expect(backup.fake.requestCount).toBe(1);
      expect(vm.targetError).toBe(null);
      expect(rightNames(vm)).toEqual(["Backup", "a.txt"]);
    });

    it("Refresh re-reads the whole Target Folder", async () => {
      const entries = { "a.txt": fakeFile() };
      const backup = createFakeDirectory("Backup", entries);
      const { controller } = setup({ picker: createFakePicker(backup) });
      await controller.chooseLocation();

      entries["b.txt"] = fakeFile();
      await controller.refreshTarget();

      expect(rightNames(controller.getViewModel())).toEqual([
        "Backup",
        "a.txt",
        "b.txt",
      ]);
    });

    it.each([
      ["NotFoundError", /moved or deleted/],
      ["NotAllowedError", /permission/i],
    ])(
      "a failed read (%s) shows a message, empties the right tree and disables Download until Refresh succeeds",
      async (errorName, message) => {
        const backup = createFakeDirectory("Backup", { "a.txt": fakeFile() });
        const { controller } = setup({ picker: createFakePicker(backup) });
        await controller.readDrive();
        await controller.chooseLocation();
        expect(controller.getViewModel().downloadDisabled).toBe(false);

        backup.fake.failWith = domError(errorName);
        await controller.refreshTarget();
        let vm = controller.getViewModel();
        expect(vm.targetError).toMatch(message);
        expect(vm.hasTarget).toBe(false);
        expect(vm.rows.every((r) => r.right === null)).toBe(true);
        expect(vm.downloadDisabled).toBe(true);
        expect(vm.locationText).toBe("📁 Backup");

        backup.fake.failWith = null;
        await controller.refreshTarget();
        vm = controller.getViewModel();
        expect(vm.targetError).toBe(null);
        expect(vm.downloadDisabled).toBe(false);
      },
    );

    it("a denied permission request on Refresh leaves the folder unread", async () => {
      const backup = createFakeDirectory("Backup");
      backup.fake.permission = "prompt";
      backup.fake.requestResult = "denied";
      const { controller } = setup({
        handleStore: createFakeHandleStore(backup),
      });
      await controller.restoreLocation();

      await controller.refreshTarget();

      const vm = controller.getViewModel();
      expect(vm.targetError).toMatch(/permission/i);
      expect(vm.hasTarget).toBe(false);
    });

    it("local-only folders start collapsed; Expand all opens them, Collapse all closes both trees", async () => {
      const backup = createFakeDirectory("Backup", {
        "Holiday 2025": { extra: { "x.txt": fakeFile() } },
        Old: { "y.txt": fakeFile() },
      });
      const { controller } = setup({ picker: createFakePicker(backup) });
      await controller.readDrive();
      await controller.chooseLocation();

      expect(rightNames(controller.getViewModel())).toEqual([
        "Backup",
        "Holiday 2025",
        "a.txt",
        "extra",
        "Old",
      ]);

      controller.toggleLocalFolder("Old");
      expect(rightNames(controller.getViewModel())).toContain("y.txt");

      controller.expandAll();
      expect(rightNames(controller.getViewModel())).toEqual([
        "Backup",
        "Holiday 2025",
        "a.txt",
        "extra",
        "x.txt",
        "Old",
        "y.txt",
      ]);

      controller.collapseAll();
      expect(rightNames(controller.getViewModel())).toEqual([
        "Backup",
        "Holiday 2025",
        "a.txt",
        "extra",
        "Old",
      ]);
    });
  });

  describe("Naming options", () => {
    it("starts with Replace spaces with _ unchecked and remembers it across controllers", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const storage = createFakeStorage();
      const first = app.createController(() => Promise.resolve(), storage);
      expect(first.getViewModel().replaceSpaces).toBe(false);

      first.setReplaceSpaces(true);
      expect(first.getViewModel().replaceSpaces).toBe(true);

      const second = app.createController(() => Promise.resolve(), storage);
      expect(second.getViewModel().replaceSpaces).toBe(true);
    });

    it("numbers duplicate Local Names among Drive siblings, files and folders together", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const items = [
        driveItem({ id: "a", name: "photo.jpg" }),
        driveItem({ id: "b", name: "photo.jpg" }),
        driveItem({ id: "c", name: "PHOTO.JPG" }),
      ];
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage(), {
        pickDirectory: async () => createFakeDirectory("Backup"),
      });
      controller.setUrl("https://drive.google.com/drive/folders/root");

      await controller.readDrive();
      await controller.chooseLocation();

      const names = controller
        .getViewModel()
        .rows.filter((r) => r.left && !r.left.isFolder)
        .map((r) => r.right.name);
      expect(names).toEqual(["photo.jpg", "photo (1).jpg", "PHOTO (2).JPG"]);
    });
  });

  describe("Selection", () => {
    const FOLDER_MIME = "application/vnd.google-apps.folder";

    async function readTree(items) {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage());
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();
      return controller;
    }

    function leftRow(vm, id) {
      const row = vm.rows.find((r) => r.left && r.left.id === id);
      return row && row.left;
    }

    it("every Item starts ticked after Read Drive", async () => {
      const controller = await readTree([
        driveItem({ id: "sub", name: "Sub", mimeType: FOLDER_MIME }),
        driveItem({ id: "leaf", parentId: "sub", name: "leaf.txt" }),
      ]);

      const vm = controller.getViewModel();
      expect(leftRow(vm, "root").selectionState).toBe("checked");
      expect(leftRow(vm, "sub").selectionState).toBe("checked");
      expect(leftRow(vm, "leaf").selectionState).toBe("checked");
    });

    it("unticking a file gives it the unselected status and drops it from the totals", async () => {
      const controller = await readTree([
        driveItem({ id: "a", name: "a.txt", size: 10 }),
        driveItem({ id: "b", name: "b.txt", size: 20 }),
      ]);

      controller.toggleSelected("a");

      const vm = controller.getViewModel();
      expect(leftRow(vm, "a").statusText).toBe("unselected");
      expect(leftRow(vm, "a").selectionState).toBe("unchecked");
      expect(leftRow(vm, "b").statusText).toBe("pending");
      expect(vm.overall.text).toBe("0 / 1 files · 0 B / 20 B");
    });

    it("a folder's box ticks or clears its whole branch, and shows mixed when partly ticked", async () => {
      const controller = await readTree([
        driveItem({ id: "sub", name: "Sub", mimeType: FOLDER_MIME }),
        driveItem({ id: "a", parentId: "sub", name: "a.txt" }),
        driveItem({ id: "b", parentId: "sub", name: "b.txt" }),
      ]);

      controller.toggleSelected("a");
      expect(leftRow(controller.getViewModel(), "sub").selectionState).toBe(
        "mixed",
      );

      controller.toggleSelected("sub");
      let vm = controller.getViewModel();
      expect(leftRow(vm, "sub").selectionState).toBe("checked");
      expect(leftRow(vm, "a").statusText).toBe("pending");
      expect(leftRow(vm, "b").statusText).toBe("pending");

      controller.toggleSelected("sub");
      vm = controller.getViewModel();
      expect(leftRow(vm, "sub").selectionState).toBe("unchecked");
      expect(leftRow(vm, "a").statusText).toBe("unselected");
      expect(leftRow(vm, "b").statusText).toBe("unselected");
    });

    it("gives a file that can't be downloaded a disabled box that a folder toggle skips over", async () => {
      const controller = await readTree([
        driveItem({ id: "sub", name: "Sub", mimeType: FOLDER_MIME }),
        driveItem({
          id: "blocked",
          parentId: "sub",
          name: "secret.pdf",
          canDownload: false,
        }),
        driveItem({ id: "ok", parentId: "sub", name: "ok.txt" }),
      ]);

      let vm = controller.getViewModel();
      expect(leftRow(vm, "blocked").selectionDisabled).toBe(true);
      expect(leftRow(vm, "blocked").selectionState).toBe("unchecked");
      expect(leftRow(vm, "sub").selectionState).toBe("checked");

      controller.toggleSelected("blocked");
      expect(leftRow(controller.getViewModel(), "sub").selectionState).toBe(
        "checked",
      );

      controller.toggleSelected("sub");
      vm = controller.getViewModel();
      expect(leftRow(vm, "ok").statusText).toBe("unselected");
      expect(leftRow(vm, "blocked").selectionState).toBe("unchecked");
      expect(leftRow(vm, "blocked").selectionDisabled).toBe(true);
    });

    it("gives a folder with nothing selectable below it a disabled box", async () => {
      const controller = await readTree([
        driveItem({ id: "empty", name: "Empty", mimeType: FOLDER_MIME }),
      ]);

      expect(
        leftRow(controller.getViewModel(), "empty").selectionDisabled,
      ).toBe(true);
    });

    it("keeps Local Names numbered among all siblings even after unticking one", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const items = [
        driveItem({ id: "a", name: "photo.jpg" }),
        driveItem({ id: "b", name: "photo.jpg" }),
      ];
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage(), {
        pickDirectory: async () => createFakeDirectory("Backup"),
      });
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();
      await controller.chooseLocation();

      controller.toggleSelected("a");

      // "a" is unticked and has no local match, so it gets no right-side
      // row at all; "b" keeps the "(1)" numbering "a" would otherwise
      // have claimed, proving the numbering didn't shift.
      const vm = controller.getViewModel();
      expect(vm.rows.find((r) => r.left && r.left.id === "a").right).toBe(null);
      expect(vm.rows.find((r) => r.left && r.left.id === "b").right.name).toBe(
        "photo (1).jpg",
      );
    });
  });
});
