#!/usr/bin/env node

/**
 * Tests for Download: the Run mirroring the Tree into the Target Folder.
 *
 * Description
 *     Drives the Disk Window controller through loadClientCore with a fake
 *     Drive (bytes, ranges, tokens, errors), an in-memory fake Target
 *     Folder and a fake clock, asserting the view model and what ends up
 *     on the fake disk.
 */

import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";
import { createFakeDirectory, fakeFile, fileText } from "./fake-disk.js";
import { createFakeDrive } from "./fake-drive.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PARTIALS = [
  "frontend/tree.js.html",
  "frontend/naming.js.html",
  "frontend/target-scan.js.html",
  "frontend/merge.js.html",
  "frontend/run.js.html",
  "frontend/controller.js.html",
];
const MINUTE = 60 * 1000;

/**
 * A Drive file Item as the Tree reader returns it.
 *
 * Inputs
 *     id: its id, also its Drive name unless overridden.
 *     overrides: fields to set on top of a plain text file.
 *
 * Outputs
 *     The Item.
 */
function file(id, overrides = {}) {
  return {
    id,
    parentId: "root",
    name: id,
    mimeType: "text/plain",
    size: 0,
    createdTime: "2020-01-01T00:00:00.000Z",
    canDownload: true,
    resourceKey: null,
    ...overrides,
  };
}

/**
 * A Drive folder Item.
 *
 * Inputs
 *     id: its id, also its Drive name.
 *     parentId: its parent's id ("root" by default).
 *
 * Outputs
 *     The Item.
 */
function folder(id, parentId = "root") {
  return file(id, { parentId, mimeType: FOLDER_MIME, size: null });
}

/**
 * Builds a controller with the Tree read and a fake Target Folder chosen.
 *
 * Description
 *     The Target Folder is "Backup", over a fake Drive.
 *
 *     Each `contents` entry becomes a Drive file Item under the Source
 *     Folder "Holiday 2025" (sized from its bytes) unless `items` gives the
 *     Items outright. The clock starts at 0 and only moves when a test
 *     moves it.
 *
 * Inputs
 *     options: `contents` ({ id: bytes }), `items` (Tree Items, overriding
 *         the ones built from `contents`), `disk` (the Target Folder's
 *         entries), `chunkSize` (bytes per ranged request).
 *
 * Outputs
 *     Promise of `{ controller, drive, dir, disk, clock, snapshots,
 *     serverCalls }`: `disk` is the live entries object, `snapshots` every
 *     view model seen on a change notification, `serverCalls` the name of
 *     every Server port call.
 */
async function setup({ contents = {}, items, disk = {}, chunkSize } = {}) {
  const app = loadClientCore("drive_downloader", PARTIALS);
  const drive = createFakeDrive(contents);
  const treeItems =
    items ||
    Object.entries(contents).map(([id, data]) =>
      file(id, { size: Buffer.from(data).length }),
    );
  const clock = { now: 0 };
  const dir = createFakeDirectory("Backup", disk);
  dir.fake.now = () => clock.now;
  const serverCalls = [];
  const serverPort = (fn) => {
    serverCalls.push(fn);
    if (fn === "treeReaderStart")
      return Promise.resolve({
        folder: { id: "root", name: "Holiday 2025" },
        continuation: "cont",
      });
    if (fn === "treeReaderStep")
      return Promise.resolve({ items: treeItems, continuation: null });
    if (fn === "getToken") return Promise.resolve(drive.issueToken());
    return Promise.reject(new Error(`unexpected call: ${fn}`));
  };
  const snapshots = [];
  const controller = app.createController(serverPort, null, {
    pickDirectory: async () => dir,
    fetch: (url, init) => drive.fetch(url, init),
    now: () => clock.now,
    chunkSize,
    onChange: () => snapshots.push(controller.getViewModel()),
  });
  controller.setUrl("https://drive.google.com/drive/folders/root");
  await controller.readDrive();
  await controller.chooseLocation();
  snapshots.length = 0;
  return { controller, drive, dir, disk, clock, snapshots, serverCalls };
}

/**
 * The Drive-side row of an Item.
 *
 * Inputs
 *     vm: a view model.
 *     id: the Item's id.
 *
 * Outputs
 *     The left row, or undefined when not shown.
 */
function leftRow(vm, id) {
  const row = vm.rows.find((r) => r.left && r.left.id === id);
  return row && row.left;
}

/**
 * The Target-Folder-side row beside an Item.
 *
 * Inputs
 *     vm: a view model.
 *     id: the Item's id.
 *
 * Outputs
 *     The right row, or null/undefined when none.
 */
function rightRow(vm, id) {
  const row = vm.rows.find((r) => r.left && r.left.id === id);
  return row && row.right;
}

/**
 * Each file Item's status, by id.
 *
 * Inputs
 *     vm: a view model.
 *
 * Outputs
 *     `{ [id]: statusText }` for file rows.
 */
function statuses(vm) {
  return Object.fromEntries(
    vm.rows
      .filter((r) => r.left && !r.left.isFolder)
      .map((r) => [r.left.id, r.left.statusText]),
  );
}

describe("drive_downloader Download", () => {
  it("mirrors the Tree into the Source sub-folder, in Tree order, with the right bytes", async () => {
    const items = [
      folder("Photos"),
      file("a.jpg", { parentId: "Photos", size: 5 }),
      file("readme.txt", { size: 11 }),
    ];
    const { controller, drive, disk } = await setup({
      contents: { "a.jpg": "12345", "readme.txt": "hello world" },
      items,
    });

    await controller.download();

    expect(fileText(disk["Holiday 2025"].Photos["a.jpg"])).toBe("12345");
    expect(fileText(disk["Holiday 2025"]["readme.txt"])).toBe("hello world");
    expect(drive.requests.map((r) => r.id)).toEqual(["a.jpg", "readme.txt"]);
    const vm = controller.getViewModel();
    expect(statuses(vm)).toEqual({ "a.jpg": "done", "readme.txt": "done" });
    expect(rightRow(vm, "a.jpg").result).toBe("saved");
    expect(rightRow(vm, "a.jpg").planned).toBe(false);
    expect(leftRow(vm, "Photos").statusText).toBe("1 / 1 files");
    expect(vm.overall.text).toBe("2 / 2 files · 16 B / 16 B");
    expect(vm.overall.fraction).toBe(1);
    expect(vm.runState).toBe("finished");
    expect(vm.statusLine).toBe("Run finished · 2 done");
  });

  it("fetches in Range chunks with the GAS token and the resource-key header", async () => {
    const { controller, drive, disk } = await setup({
      contents: { "big.bin": "0123456789" },
      items: [file("big.bin", { size: 10, resourceKey: "rk-1" })],
      chunkSize: 4,
    });

    await controller.download();

    expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
    expect(drive.requests.map((r) => r.range)).toEqual([
      "bytes=0-3",
      "bytes=4-7",
      "bytes=8-9",
    ]);
    expect(
      drive.requests.every((r) => r.authorization === "Bearer token-1"),
    ).toBe(true);
    expect(drive.requests[0].resourceKeys).toBe("big.bin/rk-1");
  });

  it("skips files that exist, fetching only what's missing; a second Run skips everything", async () => {
    const { controller, drive, disk } = await setup({
      contents: { "a.txt": "aaa", "b.txt": "bbb" },
      disk: { "Holiday 2025": { "A.TXT": fakeFile({ data: "old" }) } },
    });

    await controller.download();

    expect(drive.requests.map((r) => r.id)).toEqual(["b.txt"]);
    expect(fileText(disk["Holiday 2025"]["A.TXT"])).toBe("old");
    expect(Object.keys(disk["Holiday 2025"])).toEqual(["A.TXT", "b.txt"]);
    let vm = controller.getViewModel();
    expect(statuses(vm)).toEqual({ "a.txt": "exists", "b.txt": "done" });
    expect(rightRow(vm, "a.txt").result).toBe("keep");
    expect(vm.overall.text).toBe("2 / 2 files · 3 B / 3 B");
    expect(vm.statusLine).toBe("Run finished · 1 done · 1 exists");

    drive.requests.length = 0;
    await controller.download();

    vm = controller.getViewModel();
    expect(drive.requests).toEqual([]);
    expect(statuses(vm)).toEqual({ "a.txt": "exists", "b.txt": "exists" });
    expect(vm.statusLine).toBe("Run finished · 2 exists");
  });

  it("replaces a 0-byte local file under its on-disk name, but keeps a 0-byte one whose Drive file is empty too", async () => {
    const { controller, disk } = await setup({
      contents: { "clip.mp4": "movie", "empty.txt": "" },
      disk: {
        "Holiday 2025": {
          "Clip.MP4": fakeFile({ size: 0 }),
          "empty.txt": fakeFile({ size: 0 }),
        },
      },
    });

    await controller.download();

    expect(Object.keys(disk["Holiday 2025"])).toEqual([
      "Clip.MP4",
      "empty.txt",
    ]);
    expect(fileText(disk["Holiday 2025"]["Clip.MP4"])).toBe("movie");
    expect(statuses(controller.getViewModel())).toEqual({
      "clip.mp4": "done",
      "empty.txt": "exists",
    });
  });

  it("with several local names matching, writes into the exact-case one", async () => {
    const { controller, disk } = await setup({
      contents: { "notes.txt": "new" },
      disk: {
        "Holiday 2025": {
          "Notes.txt": fakeFile({ size: 0 }),
          "notes.txt": fakeFile({ size: 0 }),
        },
      },
    });

    await controller.download();

    expect(fileText(disk["Holiday 2025"]["notes.txt"])).toBe("new");
    expect(disk["Holiday 2025"]["Notes.txt"].size).toBe(0);
  });

  it("checks existence just before each file, so a file that appeared after the scan is skipped", async () => {
    const { controller, drive, disk } = await setup({
      contents: { "a.txt": "aaa" },
      disk: { "Holiday 2025": {} },
    });

    disk["Holiday 2025"]["a.txt"] = fakeFile({ data: "mine" });
    await controller.download();

    expect(drive.requests).toEqual([]);
    expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("mine");
    expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "exists" });
  });

  describe("Local Names", () => {
    it("writes every file under its full Local Name: illegal characters, spaces and duplicate numbering", async () => {
      const { controller, disk } = await setup({
        contents: { a: "111", b: "222" },
        items: [
          file("a", { name: "My Report?.txt", size: 3 }),
          file("b", { name: "My Report?.txt", size: 3 }),
        ],
      });
      controller.setReplaceSpaces(true);

      await controller.download();

      expect(Object.keys(disk["Holiday_2025"]).sort()).toEqual([
        "My_Report+ (1).txt",
        "My_Report+.txt",
      ]);
      expect(fileText(disk["Holiday_2025"]["My_Report+.txt"])).toBe("111");
      expect(fileText(disk["Holiday_2025"]["My_Report+ (1).txt"])).toBe("222");
      const vm = controller.getViewModel();
      expect(rightRow(vm, "a").name).toBe("My_Report+.txt");
      expect(rightRow(vm, "b").name).toBe("My_Report+ (1).txt");
    });

    it("locks Replace spaces with _ during a Run", async () => {
      const { controller } = await setup({ contents: { "a.txt": "a" } });

      const running = controller.download();
      controller.setReplaceSpaces(true);
      expect(controller.getViewModel().replaceSpaces).toBe(false);
      await running;

      expect(controller.getViewModel().replaceSpaces).toBe(false);
    });

    it("toggling Replace spaces with _ after finished recomputes Local Names and re-merges Results without reading the disk, back to ready", async () => {
      const { controller, dir } = await setup({
        contents: { a: "hello" },
        items: [file("a", { name: "My File.txt", size: 5 })],
      });
      await controller.download();
      expect(controller.getViewModel().runState).toBe("finished");
      expect(rightRow(controller.getViewModel(), "a").name).toBe("My File.txt");

      let scanCalls = 0;
      const values = dir.values.bind(dir);
      dir.values = (...args) => {
        scanCalls += 1;
        return values(...args);
      };
      controller.setReplaceSpaces(true);

      const vm = controller.getViewModel();
      expect(scanCalls).toBe(0);
      expect(vm.runState).toBe("ready");
      expect(rightRow(vm, "a").name).toBe("My_File.txt");
      expect(rightRow(vm, "a").result).toBe("new");
    });
  });

  describe("folders", () => {
    it("reuses an existing Source sub-folder matched ignoring case, and its sub-folders", async () => {
      const { controller, disk } = await setup({
        contents: { "a.txt": "a" },
        items: [folder("Docs"), file("a.txt", { parentId: "Docs", size: 1 })],
        disk: { "holiday 2025": { docs: {} } },
      });

      await controller.download();

      expect(Object.keys(disk)).toEqual(["holiday 2025"]);
      expect(Object.keys(disk["holiday 2025"])).toEqual(["docs"]);
      expect(fileText(disk["holiday 2025"].docs["a.txt"])).toBe("a");
      expect(rightRow(controller.getViewModel(), "Docs").result).toBe(
        "matched",
      );
    });

    it("creates empty Drive folders, but no folder holding only files the Run can't fetch", async () => {
      const { controller, disk } = await setup({
        items: [
          folder("Empty"),
          folder("Forms"),
          file("survey", {
            parentId: "Forms",
            mimeType: "application/vnd.google-apps.form",
            size: null,
          }),
        ],
      });

      await controller.download();

      expect(disk["Holiday 2025"]).toEqual({ Empty: {} });
      expect(statuses(controller.getViewModel())).toEqual({
        survey: "failed",
      });
    });

    it("fails every file below a folder that can't be created, and carries on with the rest", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "a.txt": "a", "b.txt": "b", "c.txt": "c" },
        items: [
          folder("Docs"),
          folder("Deep", "Docs"),
          file("a.txt", { parentId: "Docs", size: 1 }),
          file("b.txt", { parentId: "Deep", size: 1 }),
          file("c.txt", { size: 1 }),
        ],
        disk: { "Holiday 2025": { Docs: fakeFile({ data: "in the way" }) } },
      });

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({
        "a.txt": "failed",
        "b.txt": "failed",
        "c.txt": "done",
      });
      expect(leftRow(vm, "a.txt").reason).toBe("folder could not be created");
      expect(leftRow(vm, "b.txt").reason).toBe("folder could not be created");
      expect(drive.requests.map((r) => r.id)).toEqual(["c.txt"]);
      expect(fileText(disk["Holiday 2025"].Docs)).toBe("in the way");
    });
  });

  describe("tokens", () => {
    it("fetches a token when the Run starts and refreshes it before a chunk once it's older than 10 minutes", async () => {
      const { controller, drive, clock } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      drive.onRequest = () => {
        clock.now += 6 * MINUTE;
      };

      await controller.download();

      expect(drive.requests.map((r) => r.authorization)).toEqual([
        "Bearer token-1",
        "Bearer token-1",
        "Bearer token-2",
      ]);
      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
    });

    it("on a 401 refreshes the token and retries the same range", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      drive.onRequest = () => {
        if (drive.requests.length === 2) drive.expireTokens();
      };

      await controller.download();

      expect(drive.requests.map((r) => [r.range, r.authorization])).toEqual([
        ["bytes=0-3", "Bearer token-1"],
        ["bytes=4-7", "Bearer token-1"],
        ["bytes=4-7", "Bearer token-2"],
        ["bytes=8-9", "Bearer token-2"],
      ]);
      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
    });

    it("fails the file when a 401 survives the refresh", async () => {
      const { controller, drive } = await setup({
        contents: { "a.txt": "aaa" },
      });
      drive.failNext("a.txt", { status: 401, reason: "authError" });
      drive.failNext("a.txt", { status: 401, reason: "authError" });

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "failed" });
      expect(leftRow(vm, "a.txt").reason).toMatch(/401/);
    });
  });

  describe("failures", () => {
    it("fails a file on a fetch error, with the reason, leaves no file behind and carries on", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "a.txt": "aaa", "b.txt": "bbb", "c.txt": "ccc" },
      });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });
      drive.failNext("b.txt", new TypeError("Failed to fetch"));

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({
        "a.txt": "failed",
        "b.txt": "failed",
        "c.txt": "done",
      });
      expect(leftRow(vm, "a.txt").reason).toBe(
        "Drive answered HTTP 500 (backendError)",
      );
      expect(leftRow(vm, "b.txt").reason).toBe(
        "network error: Failed to fetch",
      );
      expect(rightRow(vm, "a.txt").result).toBe("not written");
      expect(Object.keys(disk["Holiday 2025"])).toEqual(["c.txt"]);
      expect(vm.overall.text).toBe("3 / 3 files · 3 B / 3 B");
      expect(vm.statusLine).toBe("Run finished · 1 done · 2 failed");
    });

    it("fails a file whose size on disk doesn't match Drive after finalizing", async () => {
      const { controller, dir } = await setup({
        contents: { "a.txt": "aaaa" },
      });
      dir.fake.onClose = (name, bytes) => bytes.subarray(0, 2);

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "failed" });
      expect(leftRow(vm, "a.txt").reason).toBe(
        "size on disk (2 B) doesn't match Drive (4 B)",
      );
    });

    it("fails files the Run can't fetch yet without asking Drive", async () => {
      const { controller, drive } = await setup({
        items: [
          file("Budget", {
            mimeType: "application/vnd.google-apps.spreadsheet",
            size: null,
          }),
          file("secret.pdf", { size: 3, canDownload: false }),
        ],
      });

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({
        Budget: "failed",
        "secret.pdf": "failed",
      });
      expect(leftRow(vm, "secret.pdf").reason).toBe(
        "downloads disabled by owner",
      );
      expect(drive.requests).toEqual([]);
    });
  });

  describe("progress", () => {
    it("shows the downloading file's bar and bytes, then finalizing, and the overall and folder totals", async () => {
      const { controller, snapshots } = await setup({
        contents: { "big.bin": "0123456789", "z.txt": "zz" },
        chunkSize: 4,
      });

      await controller.download();

      const transferring = snapshots.find(
        (vm) =>
          leftRow(vm, "big.bin").progress &&
          leftRow(vm, "big.bin").progress.text === "4 / 10 B",
      );
      expect(transferring).toBeDefined();
      expect(leftRow(transferring, "big.bin").statusText).toBe("downloading");
      expect(leftRow(transferring, "big.bin").progress.fraction).toBe(0.4);
      expect(rightRow(transferring, "big.bin").result).toBe("writing");
      expect(transferring.overall.text).toBe("0 / 2 files · 4 B / 12 B");
      expect(transferring.statusLine).toBe(
        "Downloading Holiday 2025/big.bin · 4 / 10 B · 40% · attempt 1",
      );

      const finalizing = snapshots.find(
        (vm) =>
          leftRow(vm, "big.bin").progress &&
          leftRow(vm, "big.bin").progress.text === "finalizing…",
      );
      expect(finalizing).toBeDefined();
      expect(leftRow(finalizing, "big.bin").progress.fraction).toBe(1);
      expect(finalizing.statusLine).toBe("Finalizing Holiday 2025/big.bin…");

      const afterFirst = snapshots.find(
        (vm) => leftRow(vm, "big.bin").statusText === "done",
      );
      expect(afterFirst.overall.text).toBe("1 / 2 files · 10 B / 12 B");
      expect(leftRow(afterFirst, "root").statusText).toBe("Source Folder");
    });
  });

  describe("Run states and controls", () => {
    it("goes idle, ready, running, finished, with Download enabled only in ready and finished", async () => {
      const app = loadClientCore("drive_downloader", PARTIALS);
      const controller = app.createController(() => Promise.resolve(), null);
      expect(controller.getViewModel().runState).toBe("idle");
      expect(controller.getViewModel().downloadDisabled).toBe(true);

      const { controller: ready, snapshots } = await setup({
        contents: { "a.txt": "a" },
      });
      let vm = ready.getViewModel();
      expect(vm.runState).toBe("ready");
      expect(vm.downloadDisabled).toBe(false);

      const running = ready.download();
      vm = ready.getViewModel();
      expect(vm.runState).toBe("running");
      expect(vm.downloadDisabled).toBe(true);
      await running;

      expect(snapshots.every((s) => s.runState === "running")).toBe(false);
      vm = ready.getViewModel();
      expect(vm.runState).toBe("finished");
      expect(vm.downloadDisabled).toBe(false);
    });

    it("locks the URL, Read Drive, Location and options while running, and unlocks them when finished", async () => {
      const { controller, snapshots } = await setup({
        contents: { "a.txt": "a" },
      });

      await controller.download();

      const during = snapshots.filter((s) => s.runState === "running");
      expect(during.length).toBeGreaterThan(0);
      for (const vm of during) {
        expect(vm.urlDisabled).toBe(true);
        expect(vm.readDisabled).toBe(true);
        expect(vm.locationDisabled).toBe(true);
        expect(vm.optionsDisabled).toBe(true);
        expect(vm.refreshVisible).toBe(false);
      }
      const vm = controller.getViewModel();
      expect(vm.urlDisabled).toBe(false);
      expect(vm.readDisabled).toBe(false);
      expect(vm.locationDisabled).toBe(false);
      expect(vm.optionsDisabled).toBe(false);
      expect(vm.refreshVisible).toBe(true);
    });

    it("ignores Read Drive, Location, Refresh and Download while running", async () => {
      const { controller, serverCalls } = await setup({
        contents: { "a.txt": "a" },
      });
      const running = controller.download();
      const callsBefore = serverCalls.length;

      await controller.readDrive();
      await controller.chooseLocation();
      await controller.refreshTarget();
      await controller.download();
      await running;

      expect(
        serverCalls.slice(callsBefore).filter((fn) => fn !== "getToken"),
      ).toEqual([]);
      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });

    it("a new Location after a Run starts from ready, without the old statuses", async () => {
      const { controller } = await setup({ contents: { "a.txt": "a" } });
      await controller.download();

      await controller.chooseLocation();

      const vm = controller.getViewModel();
      expect(vm.runState).toBe("ready");
      expect(statuses(vm)).toEqual({ "a.txt": "pending" });
    });

    it("keeps statuses after the Run; a new Run resets them; Read Drive after finished makes it ready", async () => {
      const { controller, drive, snapshots } = await setup({
        contents: { "a.txt": "aaa" },
      });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });
      await controller.download();
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "failed",
      });

      snapshots.length = 0;
      await controller.download();
      expect(statuses(snapshots[0])).toEqual({ "a.txt": "pending" });
      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });

      await controller.readDrive();
      const vm = controller.getViewModel();
      expect(vm.runState).toBe("ready");
      expect(statuses(vm)).toEqual({ "a.txt": "pending" });
      expect(vm.statusLine).toBe("");
    });

    it("expands every Drive folder when the Run starts", async () => {
      const { controller } = await setup({
        contents: { "a.txt": "a" },
        items: [folder("Docs"), file("a.txt", { parentId: "Docs", size: 1 })],
      });
      controller.collapseAll();
      expect(leftRow(controller.getViewModel(), "a.txt")).toBeUndefined();

      const running = controller.download();
      expect(leftRow(controller.getViewModel(), "a.txt")).toBeDefined();
      await running;
    });

    it('has "Skip existing files" checked every time the Disk Window opens', async () => {
      const { controller } = await setup();

      controller.setSkipExisting(false);
      const reopened = await setup();

      expect(controller.getViewModel().skipExisting).toBe(false);
      expect(reopened.controller.getViewModel().skipExisting).toBe(true);
    });
  });

  describe("Selection", () => {
    it("skips an unticked file without asking Drive, excluded from the totals", async () => {
      const { controller, drive } = await setup({
        contents: { "a.txt": "aaa", "b.txt": "bbbbb" },
      });

      controller.toggleSelected("a.txt");
      await controller.download();

      expect(drive.requests.map((r) => r.id)).toEqual(["b.txt"]);
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "unselected", "b.txt": "done" });
      expect(vm.overall.text).toBe("1 / 1 files · 5 B / 5 B");
      expect(vm.statusLine).toBe("Run finished · 1 done");
    });

    it("creates no folder for a fully unticked branch, but still creates an empty ticked folder", async () => {
      const { controller, disk } = await setup({
        items: [
          folder("Empty"),
          folder("Docs"),
          file("a.txt", { parentId: "Docs", size: 1 }),
        ],
      });

      controller.toggleSelected("a.txt");
      await controller.download();

      expect(disk["Holiday 2025"]).toEqual({ Empty: {} });
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "unselected",
      });
    });

    it("locks the selection checkboxes while running, ignoring a toggle", async () => {
      const { controller } = await setup({ contents: { "a.txt": "a" } });

      const running = controller.download();
      expect(controller.getViewModel().selectionLocked).toBe(true);
      controller.toggleSelected("a.txt");
      await running;

      expect(controller.getViewModel().selectionLocked).toBe(false);
      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });
  });
});
