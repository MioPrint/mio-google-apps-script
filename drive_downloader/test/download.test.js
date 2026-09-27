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
import {
  createFakeDirectory,
  domError,
  fakeFile,
  fileText,
} from "./fake-disk.js";
import { createFakeDrive } from "./fake-drive.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
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
 * Drains the microtask queue, so a Run driven only by resolved/rejected
 * promises (no real timers) settles into whatever state it's blocked at
 * (e.g. paused, awaiting Resume) before the test inspects it.
 *
 * Outputs
 *     A Promise resolving once every currently queued microtask has run.
 */
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * A fake setTimeout/clearTimeout port: nothing fires on its own.
 *
 * Description
 *     A Run waiting to retry stays waiting until the test fires it.
 *
 * Inputs
 *     None.
 *
 * Outputs
 *     `{ setTimeout, clearTimeout, pending, fireLatest }`: `pending` the
 *     ms of every still-scheduled timer, `fireLatest` runs the most
 *     recently scheduled one (the Run only ever waits on one at a time)
 *     and flushes microtasks so the Run reacts before the next assertion.
 */
function createFakeTimers() {
  const scheduled = [];
  let nextId = 1;
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      scheduled.push({ id, ms, fn });
      return id;
    },
    clearTimeout(id) {
      const i = scheduled.findIndex((t) => t.id === id);
      if (i >= 0) scheduled.splice(i, 1);
    },
    get pending() {
      return scheduled.map((t) => t.ms);
    },
    async fireLatest() {
      const t = scheduled.pop();
      if (!t) throw new Error("fireLatest: no pending timer");
      t.fn();
      await flush();
    },
  };
}

/**
 * A fake navigator.onLine/online port.
 *
 * Description
 *     Lets a test drop and restore the network without a real one.
 *
 * Inputs
 *     initial: starting online state (true by default).
 *
 * Outputs
 *     `{ isOnline, onOnline, goOffline, goOnline }`.
 */
function createFakeOnline(initial = true) {
  let online = initial;
  const listeners = new Set();
  return {
    isOnline: () => online,
    onOnline(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    goOffline() {
      online = false;
    },
    async goOnline() {
      online = true;
      for (const fn of [...listeners]) fn();
      await flush();
    },
  };
}

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
 *         entries), `chunkSize` (bytes per ranged request), `timers` (a
 *         `createFakeTimers()` to share across a re-opened setup(), a
 *         fresh one by default), `online` (likewise, a `createFakeOnline()`
 *         default, online), `failTokenTimes` ("getToken" rejects this many
 *         times before it starts succeeding, 0 by default).
 *
 * Outputs
 *     Promise of `{ controller, drive, dir, disk, clock, snapshots,
 *     serverCalls, timers, online }`: `disk` is the live entries object,
 *     `snapshots` every view model seen on a change notification,
 *     `serverCalls` the name of every Server port call.
 */
async function setup({
  contents = {},
  items,
  disk = {},
  chunkSize,
  wakeLock,
  onVisible,
  timers,
  online,
  failTokenTimes = 0,
} = {}) {
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
  const fakeTimers = timers || createFakeTimers();
  const fakeOnline = online || createFakeOnline();
  const serverCalls = [];
  let tokenFailuresLeft = failTokenTimes;
  const serverPort = (fn) => {
    serverCalls.push(fn);
    if (fn === "treeReaderStart")
      return Promise.resolve({
        folder: { id: "root", name: "Holiday 2025" },
        continuation: "cont",
      });
    if (fn === "treeReaderStep")
      return Promise.resolve({ items: treeItems, continuation: null });
    if (fn === "getToken") {
      if (tokenFailuresLeft > 0) {
        tokenFailuresLeft -= 1;
        return Promise.reject(new Error("token service unavailable"));
      }
      return Promise.resolve(drive.issueToken());
    }
    return Promise.reject(new Error(`unexpected call: ${fn}`));
  };
  const snapshots = [];
  const controller = app.createController(serverPort, null, {
    pickDirectory: async () => dir,
    fetch: (url, init) => drive.fetch(url, init),
    now: () => clock.now,
    chunkSize,
    onChange: () => snapshots.push(controller.getViewModel()),
    setTimeout: fakeTimers.setTimeout,
    clearTimeout: fakeTimers.clearTimeout,
    isOnline: fakeOnline.isOnline,
    onOnline: fakeOnline.onOnline,
    ...(wakeLock ? { wakeLock } : {}),
    ...(onVisible ? { onVisible } : {}),
  });
  controller.setUrl("https://drive.google.com/drive/folders/root");
  await controller.readDrive();
  await controller.chooseLocation();
  snapshots.length = 0;
  return {
    controller,
    drive,
    dir,
    disk,
    clock,
    snapshots,
    serverCalls,
    timers: fakeTimers,
    online: fakeOnline,
  };
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

  describe("Overwrite and existing files", () => {
    it("before Download, an existing file shows pending with an 'overwrites' hover note and Result 'overwrite' once skipping is off", async () => {
      const { controller } = await setup({
        contents: { "a.txt": "new" },
        disk: { "Holiday 2025": { "a.txt": fakeFile({ data: "old" }) } },
      });

      let vm = controller.getViewModel();
      expect(rightRow(vm, "a.txt").result).toBe("keep");
      expect(leftRow(vm, "a.txt").reason).toBeUndefined();

      controller.setSkipExisting(false);

      vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "pending" });
      expect(rightRow(vm, "a.txt").result).toBe("overwrite");
      expect(leftRow(vm, "a.txt").reason).toBe("overwrites");
    });

    it("toggling Skip existing files re-merges without re-reading the disk", async () => {
      const { controller, dir } = await setup({
        contents: { "a.txt": "new" },
        disk: { "Holiday 2025": { "a.txt": fakeFile({ data: "old" }) } },
      });
      let scanCalls = 0;
      const values = dir.values.bind(dir);
      dir.values = (...args) => {
        scanCalls += 1;
        return values(...args);
      };

      controller.setSkipExisting(false);

      expect(scanCalls).toBe(0);
      expect(rightRow(controller.getViewModel(), "a.txt").result).toBe(
        "overwrite",
      );
    });

    it("with skipping off, Download shows a confirm dialog counting overwrites; Cancel returns to ready untouched", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "a.txt": "new-a", "b.txt": "new-b" },
        disk: { "Holiday 2025": { "a.txt": fakeFile({ data: "old-a" }) } },
      });
      controller.setSkipExisting(false);

      await controller.download();

      let vm = controller.getViewModel();
      expect(vm.runState).toBe("confirming");
      expect(vm.confirmOverwriteCount).toBe(1);
      expect(drive.requests).toEqual([]);

      controller.cancelOverwrite();

      vm = controller.getViewModel();
      expect(vm.runState).toBe("ready");
      expect(vm.confirmOverwriteCount).toBe(null);
      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("old-a");
      expect(drive.requests).toEqual([]);
    });

    it("locks the URL, Location, options and selection while starting a Download and while the confirm dialog is open", async () => {
      const { controller } = await setup({
        contents: { "a.txt": "new-a" },
        disk: { "Holiday 2025": { "a.txt": fakeFile({ data: "old-a" }) } },
      });
      controller.setSkipExisting(false);

      const downloading = controller.download();
      let vm = controller.getViewModel();
      expect(vm.runState).toBe("confirming");
      expect(vm.urlDisabled).toBe(true);
      expect(vm.locationDisabled).toBe(true);
      expect(vm.optionsDisabled).toBe(true);
      expect(vm.selectionLocked).toBe(true);

      await downloading;
      vm = controller.getViewModel();
      expect(vm.runState).toBe("confirming");
      expect(vm.optionsDisabled).toBe(true);

      controller.toggleSelected("a.txt");
      controller.setSkipExisting(true);
      await controller.chooseLocation();
      await controller.readDrive();

      vm = controller.getViewModel();
      expect(vm.confirmOverwriteCount).toBe(1);
      expect(vm.skipExisting).toBe(false);
      expect(vm.locationText).toBe("📁 Backup");
    });

    it("a second Download press while the first is still starting (its own rescan) is ignored, so it can't start two Runs", async () => {
      // Nothing pre-existing, so with skipping off neither press needs a
      // confirm: both would go straight to startRun if the second one
      // weren't locked out - the actual two-Runs race (see isLocked).
      const { controller, drive, disk } = await setup({
        contents: { "a.txt": "new-a" },
      });
      controller.setSkipExisting(false);

      const first = controller.download();
      const second = controller.download();
      await Promise.all([first, second]);

      expect(drive.requests.map((r) => r.id)).toEqual(["a.txt"]);
      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("new-a");
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "done",
      });
    });

    it("Continue overwrites via createWritable() swap-file semantics; Result 'overwritten', on-disk name and case kept", async () => {
      const { controller, disk } = await setup({
        contents: { "notes.txt": "new-notes", "b.txt": "new-b" },
        disk: { "Holiday 2025": { "NOTES.txt": fakeFile({ data: "old" }) } },
      });
      controller.setSkipExisting(false);

      await controller.download();
      expect(controller.getViewModel().confirmOverwriteCount).toBe(1);

      await controller.confirmOverwrite();

      const vm = controller.getViewModel();
      expect(fileText(disk["Holiday 2025"]["NOTES.txt"])).toBe("new-notes");
      expect(Object.keys(disk["Holiday 2025"])).toEqual(["NOTES.txt", "b.txt"]);
      expect(statuses(vm)).toEqual({ "notes.txt": "done", "b.txt": "done" });
      expect(rightRow(vm, "notes.txt").result).toBe("overwritten");
      expect(rightRow(vm, "b.txt").result).toBe("saved");
      expect(vm.confirmOverwriteCount).toBe(null);
    });

    it("with skipping off and nothing existing, Download runs at once with no confirm", async () => {
      const { controller, disk } = await setup({
        contents: { "a.txt": "hello" },
      });
      controller.setSkipExisting(false);

      await controller.download();

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("hello");
      const vm = controller.getViewModel();
      expect(vm.runState).toBe("finished");
      expect(rightRow(vm, "a.txt").result).toBe("saved");
    });

    it("a 0-byte local file is replaced without a confirm and isn't counted in the overwrite total", async () => {
      const { controller, disk } = await setup({
        contents: { "clip.mp4": "movie", "b.txt": "new-b" },
        disk: {
          "Holiday 2025": {
            "Clip.MP4": fakeFile({ size: 0 }),
            "b.txt": fakeFile({ data: "old-b" }),
          },
        },
      });
      controller.setSkipExisting(false);

      let vm = controller.getViewModel();
      expect(rightRow(vm, "clip.mp4").result).toBe("new");
      expect(rightRow(vm, "clip.mp4").sizeText).toBe("0 B");
      expect(leftRow(vm, "clip.mp4").reason).toBe(
        "empty file will be replaced",
      );

      await controller.download();
      expect(controller.getViewModel().confirmOverwriteCount).toBe(1); // b.txt only

      await controller.confirmOverwrite();

      vm = controller.getViewModel();
      expect(fileText(disk["Holiday 2025"]["Clip.MP4"])).toBe("movie");
      expect(statuses(vm)).toEqual({ "clip.mp4": "done", "b.txt": "done" });
      expect(rightRow(vm, "clip.mp4").result).toBe("saved");
      expect(rightRow(vm, "b.txt").result).toBe("overwritten");
    });

    it("a local folder where a file goes fails 'in the way' when overwriting; the folder is untouched", async () => {
      const { controller, disk } = await setup({
        contents: { "notes.txt": "new-notes", "b.txt": "b" },
        disk: { "Holiday 2025": { "Notes.TXT": { "inside.txt": fakeFile() } } },
      });
      controller.setSkipExisting(false);
      expect(rightRow(controller.getViewModel(), "notes.txt").result).toBe(
        "in the way",
      );

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "notes.txt": "failed", "b.txt": "done" });
      expect(leftRow(vm, "notes.txt").reason).toBe(
        "a folder named Notes.TXT is in the way",
      );
      expect(rightRow(vm, "notes.txt").result).toBe("in the way");
      expect(Object.keys(disk["Holiday 2025"]["Notes.TXT"])).toEqual([
        "inside.txt",
      ]);
    });

    it("a file present at the per-file check but not in the Download-time scan is 'exists', not overwritten", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "a.txt": "new-a", "other.txt": "new-other" },
        disk: {
          "Holiday 2025": { "other.txt": fakeFile({ data: "old-other" }) },
        },
      });
      controller.setSkipExisting(false);

      await controller.download();
      expect(controller.getViewModel().confirmOverwriteCount).toBe(1);

      disk["Holiday 2025"]["a.txt"] = fakeFile({ data: "surprise" });

      await controller.confirmOverwrite();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "exists", "other.txt": "done" });
      expect(drive.requests.map((r) => r.id)).toEqual(["other.txt"]);
      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("surprise");
      expect(leftRow(vm, "a.txt").reason).toBe(
        "appeared after Download was pressed",
      );
      expect(rightRow(vm, "other.txt").result).toBe("overwritten");
    });

    it("Stop mid-overwrite leaves the old file untouched, the item pending, Result 'kept' once the Run has ended", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "big.bin": "0123456789" },
        disk: {
          "Holiday 2025": { "big.bin": fakeFile({ data: "OLDOLDOLD!" }) },
        },
        chunkSize: 4,
      });
      controller.setSkipExisting(false);
      drive.onRequest = () => {
        if (drive.requests.length === 2) controller.stop();
      };

      await controller.download();
      await controller.confirmOverwrite();

      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("OLDOLDOLD!");
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "big.bin": "pending" });
      expect(vm.runState).toBe("finished");
      expect(rightRow(vm, "big.bin").result).toBe("kept");
    });

    it("a file never reached before Stop shows 'not written', not 'new', once the Run has ended", async () => {
      const { controller, dir } = await setup({
        contents: { "a.txt": "aaaa", "z.txt": "zzzz" },
      });
      controller.setSkipExisting(false);
      dir.fake.onClose = (name, bytes) => {
        controller.stop();
        return bytes;
      };

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "done", "z.txt": "pending" });
      expect(rightRow(vm, "z.txt").result).toBe("not written");
    });

    it("a failed overwrite (Attempts exhausted) keeps the old file, Result 'kept'", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "new-a" },
        disk: { "Holiday 2025": { "a.txt": fakeFile({ data: "old-a" }) } },
      });
      controller.setSkipExisting(false);
      for (let i = 0; i < 5; i++) {
        drive.failNext("a.txt", { status: 500, reason: "backendError" });
      }

      await controller.download();
      const running = controller.confirmOverwrite();
      await flush();
      for (let i = 0; i < 4; i++) await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("old-a");
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "failed" });
      expect(rightRow(vm, "a.txt").result).toBe("kept");
    });

    it("a file that fails before the disk check (blocked by its owner) keeps Result 'kept' when a real local file survives untouched", async () => {
      const { controller, drive } = await setup({
        items: [file("secret.pdf", { size: 3, canDownload: false })],
        disk: { "Holiday 2025": { "secret.pdf": fakeFile({ data: "old" }) } },
      });
      controller.setSkipExisting(false);

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "secret.pdf": "failed" });
      expect(drive.requests).toEqual([]);
      expect(rightRow(vm, "secret.pdf").result).toBe("kept");
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

    it("a 401 that survives the refresh is transient: it retries, and fails only after five Attempts", async () => {
      const { controller, drive, timers } = await setup({
        contents: { "a.txt": "aaa" },
      });
      for (let i = 0; i < 5; i++) {
        drive.failNext("a.txt", { status: 401, reason: "authError" });
        drive.failNext("a.txt", { status: 401, reason: "authError" });
      }

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([10000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([30000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([60000]);
      await timers.fireLatest();
      await running;

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "failed" });
      expect(leftRow(vm, "a.txt").reason).toMatch(/401/);
    });
  });

  describe("failures", () => {
    it("fails a file on a fetch error only after five Attempts, with the last reason, and carries on", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "aaa", "b.txt": "bbb", "c.txt": "ccc" },
      });
      for (let i = 0; i < 5; i++) {
        drive.failNext("a.txt", { status: 500, reason: "backendError" });
        drive.failNext("b.txt", new TypeError("Failed to fetch"));
      }

      const running = controller.download();
      await flush();
      for (let i = 0; i < 4; i++) await timers.fireLatest(); // a.txt's Attempts 2-5
      for (let i = 0; i < 4; i++) await timers.fireLatest(); // b.txt's Attempts 2-5
      await running;

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

    it("fails a file whose size on disk doesn't match Drive, after five Attempts each restarting from 0", async () => {
      const { controller, dir, timers } = await setup({
        contents: { "a.txt": "aaaa" },
      });
      dir.fake.onClose = (name, bytes) => bytes.subarray(0, 2);

      const running = controller.download();
      await flush();
      for (let i = 0; i < 4; i++) await timers.fireLatest();
      await running;

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

  describe("Attempts and retries", () => {
    it("permanent failures (403 fileNotDownloadable, abuse flag, 404) fail at once, no Attempts", async () => {
      const { controller, drive, timers } = await setup({
        contents: { "a.txt": "a", "b.txt": "b", "c.txt": "c" },
      });
      drive.failNext("a.txt", { status: 403, reason: "fileNotDownloadable" });
      drive.failNext("b.txt", {
        status: 403,
        reason: "cannotDownloadAbusiveFile",
      });
      drive.failNext("c.txt", { status: 404, reason: "notFound" });

      await controller.download();

      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({
        "a.txt": "failed",
        "b.txt": "failed",
        "c.txt": "failed",
      });
      expect(leftRow(vm, "a.txt").reason).toBe(
        "Drive answered HTTP 403 (fileNotDownloadable)",
      );
      expect(leftRow(vm, "b.txt").reason).toBe(
        "Drive answered HTTP 403 (cannotDownloadAbusiveFile)",
      );
      expect(leftRow(vm, "c.txt").reason).toBe(
        "Drive answered HTTP 404 (notFound)",
      );
      expect(timers.pending).toEqual([]);
    });

    it("a transient failure (network error) retries and recovers", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "hello" },
      });
      drive.failNext("a.txt", new TypeError("Failed to fetch"));

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("hello");
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "done",
      });
    });

    it("a failed token fetch is transient: it retries and recovers", async () => {
      // The Run's own pre-fetch (before the first chunk) fails silently
      // and is retried right there, so it takes 2 failures - not 1 - to
      // reach the Attempts machinery here.
      const { controller, disk, timers } = await setup({
        contents: { "a.txt": "hello" },
        failTokenTimes: 2,
      });

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("hello");
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "done",
      });
    });

    it("an Attempt that writes new bytes before failing resumes at once, spending no wait", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      // Fails the 2nd request (the 2nd chunk), after the 1st has already
      // written its bytes.
      drive.onRequest = () => {
        if (drive.requests.length === 2)
          drive.failNext("big.bin", new TypeError("Failed to fetch"));
      };

      await controller.download();

      expect(drive.requests.map((r) => r.range)).toEqual([
        "bytes=0-3",
        "bytes=4-7",
        "bytes=4-7",
        "bytes=8-9",
      ]);
      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
      expect(timers.pending).toEqual([]);
      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
    });

    it("resets to Attempt 1 with a full budget once an Attempt writes new bytes, even after four failures without progress", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      // Requests 1-4 (Attempts 1-4, each restarting from 0) fail before
      // writing anything. Request 6 - the 2nd chunk of Attempt 5, after
      // its 1st chunk got through - fails too, but that's progress, so
      // it resets to Attempt 1 with a full budget again instead of
      // giving up.
      drive.onRequest = () => {
        const n = drive.requests.length;
        if (n >= 1 && n <= 4)
          drive.failNext("big.bin", { status: 500, reason: "backendError" });
        else if (n === 6)
          drive.failNext("big.bin", new TypeError("Failed to fetch"));
      };

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([10000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([30000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([60000]);
      await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
      expect(timers.pending).toEqual([]);
    });

    it("Attempts 2-4 resume from bytes already written; Attempt 5 truncates and restarts from 0", async () => {
      const { controller, drive, disk, timers, snapshots } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      // Request 2 (the 2nd chunk) fails right after the 1st chunk
      // succeeds: progressed, so it resets to Attempt 1 (no wait)
      // instead of escalating. Requests 3-6 then fail before writing
      // anything new, so the count escalates through Attempts 2, 3, 4, 5.
      drive.onRequest = () => {
        const n = drive.requests.length;
        if (n === 2)
          drive.failNext("big.bin", new TypeError("Failed to fetch"));
        else if (n >= 3 && n <= 6)
          drive.failNext("big.bin", { status: 500, reason: "backendError" });
      };

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([10000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([30000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([60000]);
      await timers.fireLatest();
      await running;

      expect(drive.requests.map((r) => r.range)).toEqual([
        "bytes=0-3",
        "bytes=4-7", // fails, progressed -> reset to Attempt 1
        "bytes=4-7", // fails, no progress -> Attempt 2 (resumes at 4)
        "bytes=4-7", // Attempt 3 (resumes at 4)
        "bytes=4-7", // Attempt 4 (resumes at 4)
        "bytes=4-7", // Attempt 5 decided here; restarts from 0 next
        "bytes=0-3", // Attempt 5's restart
        "bytes=4-7",
        "bytes=8-9",
      ]);
      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
      expect(snapshots.some((vm) => vm.statusLine.includes("attempt 5"))).toBe(
        true,
      );
    });

    it('shows "retry N/4 in Ws" in the status line and on hover while waiting', async () => {
      const { controller, drive, timers } = await setup({
        contents: { "a.txt": "aaa" },
      });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });

      const running = controller.download();
      await flush();
      expect(controller.getViewModel().statusLine).toBe(
        "Downloading Holiday 2025/a.txt · retry 1/4 in 2 s",
      );
      const row = leftRow(controller.getViewModel(), "a.txt");
      expect(row.progress.text).toBe("retry 1/4 in 2 s");
      expect(row.progress.title).toBe("retry 1/4 in 2 s");

      await timers.fireLatest();
      expect(controller.getViewModel().statusLine).toBe(
        "Downloading Holiday 2025/a.txt · retry 2/4 in 10 s",
      );

      await timers.fireLatest();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });

    it("honours Retry-After on 429/503, capped at 5 minutes", async () => {
      const { controller, drive, timers } = await setup({
        contents: { "a.txt": "a", "b.txt": "b" },
      });
      drive.failNext("a.txt", {
        status: 429,
        reason: "userRateLimitExceeded",
        retryAfter: 45,
      });
      drive.failNext("b.txt", {
        status: 503,
        reason: "backendError",
        retryAfter: 10000, // far past 5 minutes - must be capped
      });

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([45000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([5 * 60 * 1000]);
      await timers.fireLatest();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "done",
        "b.txt": "done",
      });
    });

    it("a size mismatch after finalizing is transient: it restarts from 0 and can succeed on retry", async () => {
      const { controller, dir, disk, timers } = await setup({
        contents: { "a.txt": "aaaa" },
      });
      let closeCount = 0;
      dir.fake.onClose = (name, bytes) => {
        closeCount += 1;
        return closeCount === 1 ? bytes.subarray(0, 2) : bytes;
      };

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("aaaa");
      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });

    it("waits for the network when offline, spending no Attempt", async () => {
      const { controller, drive, disk, timers, online } = await setup({
        contents: { "a.txt": "hello" },
      });
      online.goOffline();
      drive.failNext("a.txt", new TypeError("Failed to fetch"));

      const running = controller.download();
      await flush();

      let vm = controller.getViewModel();
      expect(timers.pending).toEqual([]); // waiting for online, not a timer
      expect(leftRow(vm, "a.txt").progress.text).toBe(
        "waiting for the network…",
      );
      expect(vm.statusLine).toBe(
        "Downloading Holiday 2025/a.txt · waiting for the network…",
      );

      await online.goOnline();
      await running;

      vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "done" });
      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("hello");
      // Only the original failed request and the one retry after coming
      // back online - the offline wait spent no Attempt.
      expect(drive.requests.length).toBe(2);
    });

    it("Pause cancels a retry wait; Resume starts the next Attempt at once, no further wait", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "hello" },
      });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      expect(controller.getViewModel().runState).toBe("running");

      await controller.pause();
      await flush();

      expect(timers.pending).toEqual([]); // the wait was cancelled, not fired
      expect(controller.getViewModel().runState).toBe("paused");

      await controller.resume();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("hello");
      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });

    it("Stop while waiting to retry abandons the file, same as during transferring", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "hello", "b.txt": "b" },
      });
      drive.failNext("a.txt", { status: 500, reason: "backendError" });

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);

      controller.stop();
      await running;

      expect(timers.pending).toEqual([]);
      expect(disk["Holiday 2025"]).not.toHaveProperty("a.txt");
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "a.txt": "pending", "b.txt": "pending" });
      expect(vm.runState).toBe("finished");
    });

    it("Stop, paused for a disk error during Attempt 5's restart, abandons the file rather than leaving it stuck", async () => {
      const { controller, drive, disk, dir, timers } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      // Fails requests 1-4 (bytes=0-3) so the count escalates to Attempt
      // 5, which restarts from 0 by truncating the writable.
      drive.onRequest = () => {
        const n = drive.requests.length;
        if (n >= 1 && n <= 4)
          drive.failNext("big.bin", { status: 500, reason: "backendError" });
      };

      const running = controller.download();
      await flush();
      await timers.fireLatest();
      await timers.fireLatest();
      await timers.fireLatest();
      // Before Attempt 5 starts, its truncate(0) hits a disk error.
      dir.fake.failWriteWith = domError("QuotaExceededError", "full");
      await timers.fireLatest();

      expect(controller.getViewModel().runState).toBe("paused");

      controller.stop();
      await running;

      // Not left stuck mid-restart: the partial file is gone and the
      // Item is back to pending, same as any other Stop.
      expect(disk["Holiday 2025"]).not.toHaveProperty("big.bin");
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "big.bin": "pending" });
      expect(vm.runState).toBe("finished");
    });

    it('clamps the retry number to 1, not "retry 0/4", when a progress-reset Attempt still carries a Retry-After wait', async () => {
      const { controller, drive, timers } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      // The 2nd chunk fails after the 1st succeeds - progressed, so it
      // resets to Attempt 1 - but Drive still asks for a Retry-After wait.
      drive.onRequest = () => {
        if (drive.requests.length === 2)
          drive.failNext("big.bin", {
            status: 429,
            reason: "userRateLimitExceeded",
            retryAfter: 15,
          });
      };

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([15000]);
      expect(controller.getViewModel().statusLine).toBe(
        "Downloading Holiday 2025/big.bin · retry 1/4 in 15 s",
      );

      await timers.fireLatest();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
    });

    it("defaults an unrecognized status or an unlisted 403 reason to transient, not permanent", async () => {
      const { controller, drive, disk, timers } = await setup({
        contents: { "a.txt": "a", "b.txt": "b" },
      });
      drive.failNext("a.txt", { status: 409, reason: "conflict" });
      drive.failNext("b.txt", { status: 403, reason: "someOtherReason" });

      const running = controller.download();
      await flush();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      expect(timers.pending).toEqual([2000]);
      await timers.fireLatest();
      await running;

      expect(fileText(disk["Holiday 2025"]["a.txt"])).toBe("a");
      expect(fileText(disk["Holiday 2025"]["b.txt"])).toBe("b");
      expect(statuses(controller.getViewModel())).toEqual({
        "a.txt": "done",
        "b.txt": "done",
      });
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
      // A permanent failure (not a transient one - see "Attempts and
      // retries" below), so this Run settles without any retry waits.
      drive.failNext("a.txt", { status: 404, reason: "notFound" });
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

  describe("Pause, Resume, Stop", () => {
    it("is safe to call Pause synchronously, right after download() starts", async () => {
      // download() must attach pause()/resume()/stop() before its own
      // first await (acquiring the Wake Lock), or a Pause requested in
      // that gap would find state.run.pause not yet a function.
      const { controller } = await setup({ contents: { "a.txt": "a" } });

      const running = controller.download();
      await controller.pause();
      await flush();

      expect(controller.getViewModel().runState).toBe("paused");

      await controller.resume();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });

    it("goes running -> paused -> running -> finished, with Pause/Resume/Stop enabled correctly", async () => {
      const app = loadClientCore("drive_downloader", PARTIALS);
      const idle = app.createController(() => Promise.resolve(), null);
      let vm = idle.getViewModel();
      expect(vm.runState).toBe("idle");
      expect(vm.pauseDisabled).toBe(true);
      expect(vm.resumeDisabled).toBe(true);
      expect(vm.stopDisabled).toBe(true);

      const { controller, drive } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      vm = controller.getViewModel();
      expect(vm.runState).toBe("ready");
      expect(vm.pauseDisabled).toBe(true);
      expect(vm.resumeDisabled).toBe(true);
      expect(vm.stopDisabled).toBe(true);

      drive.onRequest = () => {
        if (drive.requests.length === 1) controller.pause();
      };
      const running = controller.download();
      vm = controller.getViewModel();
      expect(vm.runState).toBe("running");
      expect(vm.downloadDisabled).toBe(true);
      expect(vm.pauseDisabled).toBe(false);
      expect(vm.resumeDisabled).toBe(true);
      expect(vm.stopDisabled).toBe(false);

      await flush();
      vm = controller.getViewModel();
      expect(vm.runState).toBe("paused");
      expect(vm.downloadDisabled).toBe(true);
      expect(vm.pauseDisabled).toBe(true);
      expect(vm.resumeDisabled).toBe(false);
      expect(vm.stopDisabled).toBe(false);

      drive.onRequest = null;
      await controller.resume();
      await running;

      vm = controller.getViewModel();
      expect(vm.runState).toBe("finished");
      expect(vm.downloadDisabled).toBe(false);
      expect(vm.pauseDisabled).toBe(true);
      expect(vm.resumeDisabled).toBe(true);
      expect(vm.stopDisabled).toBe(true);
    });

    it("Pause aborts the in-flight fetch and keeps the writable; Resume sends Range from bytes written", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      drive.onRequest = () => {
        if (drive.requests.length === 2) controller.pause();
      };

      const running = controller.download();
      await flush();

      let vm = controller.getViewModel();
      expect(vm.runState).toBe("paused");
      expect(vm.statusLine).toBe("Paused at Holiday 2025/big.bin · 4 / 10 B");
      expect(drive.requests.map((r) => r.range)).toEqual([
        "bytes=0-3",
        "bytes=4-7",
      ]);
      expect(statuses(vm)).toEqual({ "big.bin": "downloading" });

      drive.onRequest = null;
      await controller.resume();
      await running;

      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
      expect(drive.requests.map((r) => r.range)).toEqual([
        "bytes=0-3",
        "bytes=4-7",
        "bytes=4-7",
        "bytes=8-9",
      ]);
      vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ "big.bin": "done" });
      expect(vm.runState).toBe("finished");
    });

    it("Stop aborts the writable, removes the new file, puts it back to pending, and ends the Run leaving files not reached pending", async () => {
      const { controller, drive, disk } = await setup({
        contents: { "big.bin": "0123456789", "z.txt": "zz" },
        chunkSize: 4,
      });
      drive.onRequest = () => {
        if (drive.requests.length === 2) controller.stop();
      };

      await controller.download();

      expect(disk["Holiday 2025"]).not.toHaveProperty("big.bin");
      const vm = controller.getViewModel();
      expect(vm.runState).toBe("finished");
      expect(statuses(vm)).toEqual({
        "big.bin": "pending",
        "z.txt": "pending",
      });
      expect(vm.statusLine).toBe("Run finished · 2 pending");
    });

    it("Pause during finalizing shows Pausing…, then pauses before the next file", async () => {
      const { controller, dir } = await setup({
        contents: { "a.bin": "aaaa", "b.txt": "bbbb" },
      });
      let statusDuringClose;
      dir.fake.onClose = (name, bytes) => {
        controller.pause();
        statusDuringClose = controller.getViewModel().statusLine;
        return bytes;
      };

      const running = controller.download();
      await flush();

      expect(statusDuringClose).toBe("Pausing…");
      const vm = controller.getViewModel();
      expect(vm.runState).toBe("paused");
      expect(statuses(vm)).toEqual({ "a.bin": "done", "b.txt": "pending" });

      await controller.resume();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({
        "a.bin": "done",
        "b.txt": "done",
      });
    });

    it("Stop during finalizing shows Finishing current file…, keeps the file as done, and ends without starting the next", async () => {
      const { controller, dir } = await setup({
        contents: { "a.bin": "aaaa", "b.txt": "bbbb" },
      });
      let statusDuringClose;
      dir.fake.onClose = (name, bytes) => {
        controller.stop();
        statusDuringClose = controller.getViewModel().statusLine;
        return bytes;
      };

      await controller.download();

      expect(statusDuringClose).toBe("Finishing current file…");
      const vm = controller.getViewModel();
      expect(vm.runState).toBe("finished");
      expect(statuses(vm)).toEqual({ "a.bin": "done", "b.txt": "pending" });
      expect(vm.statusLine).toBe("Run finished · 1 done · 1 pending");
    });
  });

  describe("Disk errors", () => {
    it("pauses the Run with a message, keeps the file's bytes, and Resume re-requests permission and retries", async () => {
      const { controller, dir, disk } = await setup({
        contents: { "big.bin": "0123456789" },
        chunkSize: 4,
      });
      dir.fake.failWriteWith = domError("QuotaExceededError", "full");

      const running = controller.download();
      await flush();

      let vm = controller.getViewModel();
      expect(vm.runState).toBe("paused");
      expect(vm.pauseMessage).toBe(
        "Not enough free disk space. Free up space, then press Resume.",
      );
      expect(vm.statusLine).toBe(
        "Paused at Holiday 2025/big.bin · 0 / 10 B — " +
          "Not enough free disk space. Free up space, then press Resume.",
      );
      expect(statuses(vm)).toEqual({ "big.bin": "downloading" });

      dir.fake.failWriteWith = null;
      await controller.resume();
      await running;

      expect(dir.fake.requestCount).toBe(1);
      expect(fileText(disk["Holiday 2025"]["big.bin"])).toBe("0123456789");
      expect(statuses(controller.getViewModel())).toEqual({
        "big.bin": "done",
      });
    });

    it("a Target Folder moved or deleted pauses the Run instead of failing", async () => {
      const { controller, dir } = await setup({
        contents: { "a.txt": "aaa" },
      });
      dir.fake.failWith = domError("NotFoundError");

      const running = controller.download();
      await flush();

      const vm = controller.getViewModel();
      expect(vm.runState).toBe("paused");
      expect(vm.pauseMessage).toMatch(/moved or deleted/);
      // Every disk call shares fake.failWith, so this hits opening the
      // Source sub-folder itself, before "a.txt" is even reached.
      expect(statuses(vm)).toEqual({ "a.txt": "pending" });

      dir.fake.failWith = null;
      await controller.resume();
      await running;

      expect(statuses(controller.getViewModel())).toEqual({ "a.txt": "done" });
    });
  });

  describe("Wake Lock", () => {
    // A fake WakeLockSentinel: release() is the app asking to let go,
    // simulateSystemRelease() is Chrome dropping it unasked (tab hidden).
    function createFakeWakeLock() {
      const sentinels = [];
      return {
        port: {
          request: async () => {
            const listeners = [];
            const sentinel = {
              released: false,
              release: async () => {
                sentinel.released = true;
              },
              addEventListener: (type, fn) => {
                if (type === "release") listeners.push(fn);
              },
              simulateSystemRelease: () => {
                sentinel.released = true;
                listeners.forEach((fn) => fn());
              },
            };
            sentinels.push(sentinel);
            return sentinel;
          },
        },
        sentinels,
      };
    }

    it("holds the Wake Lock while running, releases on Pause, re-acquires on Resume, releases when finished", async () => {
      const { port, sentinels } = createFakeWakeLock();
      const { controller, dir } = await setup({
        contents: { "a.bin": "aaaa", "b.txt": "bbbb" },
        wakeLock: port,
      });
      dir.fake.onClose = (name, bytes) => {
        controller.pause();
        return bytes;
      };

      const running = controller.download();
      await flush();

      expect(controller.getViewModel().wakeLockHeld).toBe(false);
      expect(sentinels).toHaveLength(1);
      expect(sentinels[0].released).toBe(true);

      await controller.resume();
      expect(controller.getViewModel().wakeLockHeld).toBe(true);
      expect(sentinels).toHaveLength(2);

      await running;

      expect(controller.getViewModel().wakeLockHeld).toBe(false);
      expect(sentinels[1].released).toBe(true);
    });

    it("re-acquires the Wake Lock when the page becomes visible again during a Run", async () => {
      const { port, sentinels } = createFakeWakeLock();
      let visibleHandler;
      const { controller, drive } = await setup({
        contents: { "a.txt": "a" },
        wakeLock: port,
        onVisible: (fn) => {
          visibleHandler = fn;
        },
      });
      const releaseHold = drive.holdNext();

      const running = controller.download();
      await flush();

      expect(controller.getViewModel().runState).toBe("running");
      expect(controller.getViewModel().wakeLockHeld).toBe(true);
      expect(sentinels).toHaveLength(1);

      // Chrome drops the lock unasked when the tab is hidden; the Run
      // itself keeps going.
      sentinels[0].simulateSystemRelease();
      expect(controller.getViewModel().wakeLockHeld).toBe(false);

      await visibleHandler();

      expect(controller.getViewModel().wakeLockHeld).toBe(true);
      expect(sentinels).toHaveLength(2);

      releaseHold();
      await running;

      expect(controller.getViewModel().wakeLockHeld).toBe(false);
    });
  });

  describe("Shortcuts", () => {
    it("skips a loop without any Drive request, settling it with the status loop, and mirrors the rest", async () => {
      const items = [
        folder("Sub"),
        file("loopSc", {
          parentId: "Sub",
          mimeType: SHORTCUT_MIME,
          size: null,
          loop: true,
          target: {
            id: "root",
            resourceKey: null,
            name: "Holiday 2025",
            mimeType: FOLDER_MIME,
            size: null,
          },
        }),
        file("ok.txt", { parentId: "Sub", size: 2 }),
      ];
      const { controller, drive, disk } = await setup({
        contents: { "ok.txt": "ok" },
        items,
      });

      await controller.download();

      expect(drive.requests.map((r) => r.id)).toEqual(["ok.txt"]);
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({ loopSc: "loop", "ok.txt": "done" });
      expect(fileText(disk["Holiday 2025"].Sub["ok.txt"])).toBe("ok");
      expect(rightRow(vm, "loopSc").result).toBe("not written");
    });

    it("downloads a Shortcut's target once per place it appears, using the target's bytes and resource key", async () => {
      const items = [
        folder("A"),
        folder("B"),
        file("shortcutInA", {
          parentId: "A",
          name: "Video A",
          mimeType: SHORTCUT_MIME,
          size: null,
          target: {
            id: "shared",
            resourceKey: "rk-shared",
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 3,
          },
        }),
        file("shortcutInB", {
          parentId: "B",
          name: "Video B",
          mimeType: SHORTCUT_MIME,
          size: null,
          target: {
            id: "shared",
            resourceKey: "rk-shared",
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 3,
          },
        }),
      ];
      const { controller, drive, disk } = await setup({
        contents: { shared: "abc" },
        items,
      });

      await controller.download();

      expect(fileText(disk["Holiday 2025"].A["Video A.mp4"])).toBe("abc");
      expect(fileText(disk["Holiday 2025"].B["Video B.mp4"])).toBe("abc");
      expect(drive.requests.map((r) => r.id)).toEqual(["shared", "shared"]);
      expect(
        drive.requests.every((r) => r.resourceKeys === "shared/rk-shared"),
      ).toBe(true);
      const vm = controller.getViewModel();
      expect(statuses(vm)).toEqual({
        shortcutInA: "done",
        shortcutInB: "done",
      });
    });
  });
});
