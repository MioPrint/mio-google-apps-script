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

  describe("status panel", () => {
    it("starts empty", () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const controller = app.createController(() => Promise.resolve("t"));

      const vm = controller.getViewModel();
      expect(vm.statusErrors).toEqual([]);
      expect(vm.statusText).toBe("");
    });

    it("a token error lands in the panel; a later token clears it", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      let fail = true;
      let changes = 0;
      const serverPort = () =>
        fail ? Promise.reject(new Error("no token")) : Promise.resolve("t");
      const controller = app.createController(serverPort, createFakeStorage(), {
        onChange: () => changes++,
      });

      await controller.checkToken();
      expect(controller.getViewModel().statusErrors).toEqual([
        "Token error: no token",
      ]);
      expect(changes).toBe(1);

      fail = false;
      await controller.checkToken();
      expect(controller.getViewModel().statusErrors).toEqual([]);
    });

    it("lists errors before the status text, in URL, Target Folder, token order", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ error: "empty" })
          : Promise.reject(new Error("no token"));
      const backup = createFakeDirectory("Backup");
      backup.fake.permission = "prompt";
      const controller = app.createController(serverPort, createFakeStorage(), {
        handleStore: { get: async () => backup, set: async () => {} },
      });

      await controller.checkToken();
      await controller.restoreLocation();
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();

      const vm = controller.getViewModel();
      expect(vm.statusErrors).toEqual([
        "That folder is empty. Nothing to download.",
        vm.targetError,
        "Token error: no token",
      ]);
      expect(vm.statusText).toBe("");
    });

    it("a new Read Drive clears its error", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const serverPort = () => Promise.resolve({ error: "malformed" });
      const controller = app.createController(serverPort, createFakeStorage());
      controller.setUrl("x");
      await controller.readDrive();

      controller.setUrl("y");

      expect(controller.getViewModel().statusErrors).toEqual([]);
    });
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
      expect(controller.getViewModel().statusText).toBe("Reading Drive…");
      await reading;

      const vm = controller.getViewModel();
      expect(vm.reading).toBe(false);
      expect(vm.statusText).toBe("");
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
      expect(vm.statusErrors).toEqual([message]);
      expect(vm.rows).toEqual([]);
      expect(vm.reading).toBe(false);
    });

    it("maps a permission-style server error to the authorization message", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const serverPort = () =>
        Promise.reject(
          new Error("You do not have permission to call drive.files.get."),
        );
      const controller = app.createController(serverPort, createFakeStorage());

      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();

      const vm = controller.getViewModel();
      expect(vm.urlError).toBe(
        "Authorize the App in the Launcher Page tab, then press Read Drive again.",
      );
      expect(vm.statusErrors).toEqual([vm.urlError]);
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

    it("expandCollapseDisabled is true with no rows, false once the Tree is read", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const controller = app.createController(
        () => Promise.resolve(),
        createFakeStorage(),
      );
      expect(controller.getViewModel().expandCollapseDisabled).toBe(true);

      const withTree = await readSampleTree();
      expect(withTree.getViewModel().expandCollapseDisabled).toBe(false);
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
        onChange: () => scanTexts.push(controller.getViewModel().statusText),
      }));

      await controller.chooseLocation();

      const vm = controller.getViewModel();
      expect(scanTexts).toContain("Reading Target Folder… 3 items");
      expect(vm.statusText).toBe("");
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
      expect(vm.statusErrors).toEqual([vm.targetError]);
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

    it("starts with Use Shortcut target names unchecked and remembers it across controllers", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const storage = createFakeStorage();
      const first = app.createController(() => Promise.resolve(), storage);
      expect(first.getViewModel().useShortcutTargetNames).toBe(false);

      first.setUseShortcutTargetNames(true);
      expect(first.getViewModel().useShortcutTargetNames).toBe(true);

      const second = app.createController(() => Promise.resolve(), storage);
      expect(second.getViewModel().useShortcutTargetNames).toBe(true);
    });

    it("toggling Use Shortcut target names re-merges the Tree label and Local Name without a re-read", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday" };
      const items = [
        driveItem({
          id: "s",
          name: "Holiday video",
          mimeType: "application/vnd.google-apps.shortcut",
          size: null,
          target: {
            id: "target1",
            resourceKey: null,
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 500,
          },
        }),
      ];
      let treeReaderCalls = 0;
      const serverPort = (fn) => {
        if (fn === "treeReaderStart") {
          treeReaderCalls += 1;
          return Promise.resolve({ folder, continuation: "cont" });
        }
        return Promise.resolve({ items, continuation: null });
      };
      const controller = app.createController(serverPort, createFakeStorage());
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();

      const leftRow = (vm) =>
        vm.rows.find((r) => r.left && r.left.id === "s").left;
      expect(leftRow(controller.getViewModel()).name).toBe("Holiday video.mp4");

      controller.setUseShortcutTargetNames(true);

      expect(leftRow(controller.getViewModel()).name).toBe("clip.mp4");
      expect(treeReaderCalls).toBe(1);
    });
  });

  describe("Keep screen awake", () => {
    it("starts checked and remembers a change across controllers", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const storage = createFakeStorage();
      const first = app.createController(() => Promise.resolve(), storage);
      expect(first.getViewModel().keepAwake).toBe(true);

      await first.setKeepAwake(false);
      expect(first.getViewModel().keepAwake).toBe(false);

      const second = app.createController(() => Promise.resolve(), storage);
      expect(second.getViewModel().keepAwake).toBe(false);
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

  describe("Skip-existing preview", () => {
    const FOLDER_MIME = "application/vnd.google-apps.folder";

    async function setup(items, diskEntries) {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday 2025" };
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage(), {
        pickDirectory: async () => createFakeDirectory("Backup", diskEntries),
      });
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();
      await controller.chooseLocation();
      return controller;
    }

    function leftRow(vm, id) {
      const row = vm.rows.find((r) => r.left && r.left.id === id);
      return row && row.left;
    }

    function rightRow(vm, name) {
      const row = vm.rows.find((r) => r.right && r.right.name === name);
      return row && row.right;
    }

    it("shows a real local match as 'exists', unticked and disabled, keeping 'keep' on the Target side", async () => {
      const controller = await setup(
        [driveItem({ id: "a.txt", name: "a.txt", size: 10 })],
        { "Holiday 2025": { "A.TXT": fakeFile({ size: 10 }) } },
      );

      const vm = controller.getViewModel();
      expect(leftRow(vm, "a.txt").statusText).toBe("exists");
      expect(leftRow(vm, "a.txt").selectionState).toBe("unchecked");
      expect(leftRow(vm, "a.txt").selectionDisabled).toBe(true);
      expect(rightRow(vm, "A.TXT").result).toBe("keep");
    });

    it("shows a local folder in a file's place as 'exists' too", async () => {
      const controller = await setup(
        [driveItem({ id: "data", name: "data", size: 10 })],
        { "Holiday 2025": { data: { "old.csv": fakeFile() } } },
      );

      const vm = controller.getViewModel();
      expect(leftRow(vm, "data").statusText).toBe("exists");
      expect(leftRow(vm, "data").selectionDisabled).toBe(true);
    });

    it("shows a Native File's real on-disk size in the preview instead of '?'", async () => {
      const controller = await setup(
        [
          driveItem({
            id: "budget",
            name: "budget",
            mimeType: "application/vnd.google-apps.spreadsheet",
            size: null,
          }),
        ],
        { "Holiday 2025": { "budget.xlsx": fakeFile({ size: 42 }) } },
      );

      const vm = controller.getViewModel();
      expect(leftRow(vm, "budget").statusText).toBe("exists");
      expect(leftRow(vm, "budget").sizeText).toBe("42 B");
    });

    it("doesn't treat a 0-byte leftover as existing", async () => {
      const controller = await setup(
        [driveItem({ id: "big.bin", name: "big.bin", size: 500 })],
        { "Holiday 2025": { "big.bin": fakeFile({ size: 0 }) } },
      );

      const vm = controller.getViewModel();
      expect(leftRow(vm, "big.bin").statusText).toBe("pending");
      expect(leftRow(vm, "big.bin").selectionState).toBe("checked");
      expect(leftRow(vm, "big.bin").selectionDisabled).toBe(false);
    });

    it("exists wins over a file the user had already unticked", async () => {
      const app = loadClientCore("drive_downloader", CONTROLLER_PARTIALS);
      const folder = { id: "root", name: "Holiday 2025" };
      const items = [driveItem({ id: "a.txt", name: "a.txt", size: 10 })];
      const serverPort = (fn) =>
        fn === "treeReaderStart"
          ? Promise.resolve({ folder, continuation: "cont" })
          : Promise.resolve({ items, continuation: null });
      const controller = app.createController(serverPort, createFakeStorage(), {
        pickDirectory: async () =>
          createFakeDirectory("Backup", {
            "Holiday 2025": { "a.txt": fakeFile({ size: 10 }) },
          }),
      });
      controller.setUrl("https://drive.google.com/drive/folders/root");
      await controller.readDrive();
      controller.toggleSelected("a.txt");
      expect(leftRow(controller.getViewModel(), "a.txt").statusText).toBe(
        "unselected",
      );

      await controller.chooseLocation();

      expect(leftRow(controller.getViewModel(), "a.txt").statusText).toBe(
        "exists",
      );
    });

    it("turning the option off gives each file back its own tick state, on again restores the preview", async () => {
      const controller = await setup(
        [
          driveItem({ id: "a.txt", name: "a.txt", size: 10 }),
          driveItem({ id: "b.txt", name: "b.txt", size: 10 }),
        ],
        { "Holiday 2025": { "a.txt": fakeFile({ size: 10 }) } },
      );
      controller.toggleSelected("b.txt");

      let vm = controller.getViewModel();
      expect(leftRow(vm, "a.txt").statusText).toBe("exists");
      expect(leftRow(vm, "b.txt").statusText).toBe("unselected");

      controller.setSkipExisting(false);
      vm = controller.getViewModel();
      expect(leftRow(vm, "a.txt").statusText).toBe("pending");
      expect(leftRow(vm, "a.txt").selectionState).toBe("checked");
      expect(leftRow(vm, "b.txt").statusText).toBe("unselected");

      controller.setSkipExisting(true);
      vm = controller.getViewModel();
      expect(leftRow(vm, "a.txt").statusText).toBe("exists");
      expect(leftRow(vm, "b.txt").statusText).toBe("unselected");
    });

    it("a folder's tick state and checkbox click ignore 'exists' files below it", async () => {
      const controller = await setup(
        [
          driveItem({
            id: "sub",
            name: "Sub",
            mimeType: FOLDER_MIME,
            size: null,
          }),
          driveItem({ id: "a.txt", parentId: "sub", name: "a.txt", size: 10 }),
          driveItem({ id: "b.txt", parentId: "sub", name: "b.txt", size: 10 }),
        ],
        { "Holiday 2025": { Sub: { "a.txt": fakeFile({ size: 10 }) } } },
      );

      let vm = controller.getViewModel();
      expect(leftRow(vm, "a.txt").statusText).toBe("exists");
      // b.txt is the only selectable file below Sub, and it's ticked.
      expect(leftRow(vm, "sub").selectionState).toBe("checked");

      controller.toggleSelected("sub");
      vm = controller.getViewModel();
      expect(leftRow(vm, "sub").selectionState).toBe("unchecked");
      expect(leftRow(vm, "b.txt").statusText).toBe("unselected");
      expect(leftRow(vm, "a.txt").statusText).toBe("exists");
    });

    it("a folder whose files all exist is not selectable", async () => {
      const controller = await setup(
        [
          driveItem({
            id: "sub",
            name: "Sub",
            mimeType: FOLDER_MIME,
            size: null,
          }),
          driveItem({ id: "a.txt", parentId: "sub", name: "a.txt", size: 10 }),
        ],
        { "Holiday 2025": { Sub: { "a.txt": fakeFile({ size: 10 }) } } },
      );

      const vm = controller.getViewModel();
      expect(leftRow(vm, "sub").selectionState).toBe("unchecked");
      expect(leftRow(vm, "sub").selectionDisabled).toBe(true);
    });

    it("counts 'exists' files as settled in the overall bar, with their bytes left out", async () => {
      const controller = await setup(
        [
          driveItem({ id: "a.txt", name: "a.txt", size: 10 }),
          driveItem({ id: "b.txt", name: "b.txt", size: 20 }),
        ],
        { "Holiday 2025": { "a.txt": fakeFile({ size: 10 }) } },
      );

      const vm = controller.getViewModel();
      expect(vm.overall.text).toBe("1 / 2 files · 0 B / 20 B");
    });
  });
});
