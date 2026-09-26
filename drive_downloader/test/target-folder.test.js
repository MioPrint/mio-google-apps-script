#!/usr/bin/env node

/**
 * Tests for the Target Folder scan and its merge with the Tree.
 *
 * Description
 *     Runs the scan and merge client partials through loadClientCore
 *     against an in-memory fake directory, asserting the aligned rows and
 *     Results the Disk Window shows beside the Tree.
 */

import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";
import { createFakeDirectory, domError, fakeFile } from "./fake-disk.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PARTIALS = [
  "frontend/tree.js.html",
  "frontend/naming.js.html",
  "frontend/target-scan.js.html",
  "frontend/merge.js.html",
];
const app = loadClientCore("drive_downloader", PARTIALS);

/**
 * A Drive Item as the Tree reader returns it.
 *
 * Inputs
 *     overrides: fields to set on top of a plain 10-byte text file.
 *
 * Outputs
 *     The Item.
 */
function item(overrides) {
  return {
    id: overrides.name,
    parentId: "root",
    mimeType: "text/plain",
    size: 10,
    createdTime: "2020-01-01T00:00:00.000Z",
    canDownload: true,
    ...overrides,
  };
}

/**
 * A Drive folder Item.
 *
 * Inputs
 *     name: its Drive name, also used as its id.
 *     parentId: its parent's id ("root" by default).
 *
 * Outputs
 *     The Item.
 */
function folderItem(name, parentId = "root") {
  return item({ name, parentId, mimeType: FOLDER_MIME, size: null });
}

/**
 * The Tree of a Source Folder named "Holiday 2025" holding the Items.
 *
 * Inputs
 *     items: flat Drive Items.
 *
 * Outputs
 *     The nested Tree.
 */
function holidayTree(items) {
  return app.buildTree({ id: "root", name: "Holiday 2025" }, items);
}

/**
 * Scans a fake directory.
 *
 * Inputs
 *     entries: nested spec of the Target Folder "Backup".
 *
 * Outputs
 *     Promise of the scanned local tree.
 */
function scan(entries) {
  return app.scanTargetFolder(createFakeDirectory("Backup", entries));
}

/**
 * Merge view state, everything expanded on the Drive side.
 *
 * Inputs
 *     tree: the Tree, for its Local Names (null when there is none).
 *     overrides: `collapsed` (Drive folder ids) and/or `expandedLocal`
 *         (local folder keys).
 *
 * Outputs
 *     The view state.
 */
function view(tree, overrides = {}) {
  return {
    collapsed: new Set(),
    expandedLocal: new Set(),
    localNames: tree ? app.computeLocalNames(tree, false) : new Map(),
    ...overrides,
  };
}

/**
 * Pairs as compact `[left name, right name, Result]` triples.
 *
 * Inputs
 *     rows: merged rows.
 *
 * Outputs
 *     The triples; a missing side is null.
 */
function summarize(rows) {
  return rows.map((r) => [
    r.left ? r.left.name : null,
    r.right ? r.right.name : null,
    r.right ? r.right.result : null,
  ]);
}

describe("drive_downloader Target Folder", () => {
  describe("scanTargetFolder", () => {
    it("reads the whole folder recursively, reporting progress per item", async () => {
      const dir = createFakeDirectory("Backup", {
        "a.txt": fakeFile({ size: 3, modified: 1000 }),
        Sub: { "b.bin": fakeFile({ size: 7, modified: 2000 }), Empty: {} },
      });
      const counts = [];

      const local = await app.scanTargetFolder(dir, (n) => counts.push(n));

      expect(JSON.parse(JSON.stringify(local))).toEqual({
        name: "Backup",
        isFolder: true,
        children: [
          { name: "a.txt", isFolder: false, size: 3, modified: 1000 },
          {
            name: "Sub",
            isFolder: true,
            children: [
              { name: "b.bin", isFolder: false, size: 7, modified: 2000 },
              { name: "Empty", isFolder: true, children: [] },
            ],
          },
        ],
      });
      expect(counts).toEqual([1, 2, 3, 4]);
    });

    it("rejects when the folder can't be read", async () => {
      const dir = createFakeDirectory("Backup");
      dir.fake.failWith = domError("NotFoundError");

      await expect(app.scanTargetFolder(dir)).rejects.toMatchObject({
        name: "NotFoundError",
      });
    });
  });

  describe("mergeRows", () => {
    it("with no Tree, shows the Target Folder alone: local-only, folders first, natural order, folders collapsed", async () => {
      const local = await scan({
        "file10.txt": fakeFile(),
        "file2.txt": fakeFile(),
        Photos: { "beach.jpg": fakeFile() },
        archive: {},
      });

      const collapsed = app.mergeRows(null, local, view(null));
      const expanded = app.mergeRows(
        null,
        local,
        view(null, { expandedLocal: new Set(["Photos"]) }),
      );

      expect(summarize(collapsed)).toEqual([
        [null, "Backup", "target"],
        [null, "archive", "local only"],
        [null, "Photos", "local only"],
        [null, "file2.txt", "local only"],
        [null, "file10.txt", "local only"],
      ]);
      const photos = collapsed.find((r) => r.right.name === "Photos").right;
      expect(photos.collapsed).toBe(true);
      expect(photos.localToggle).toBe("Photos");
      expect(summarize(expanded)).toContainEqual([
        null,
        "beach.jpg",
        "local only",
      ]);
    });

    it("with no Target Folder, shows the Tree alone", () => {
      const tree = holidayTree([item({ name: "a.txt" })]);

      const rows = app.mergeRows(tree, null, view(tree));

      expect(summarize(rows)).toEqual([
        ["Holiday 2025", null, null],
        ["a.txt", null, null],
      ]);
    });

    it("without a matching sub-folder, plans one new folder with every child new, under Local Names", async () => {
      const tree = holidayTree([
        folderItem("Docs"),
        item({ name: "notes: draft?.txt", parentId: "Docs", size: 3072 }),
        item({ name: "README.txt" }),
      ]);
      const local = await scan({ "shopping list.txt": fakeFile() });

      const rows = app.mergeRows(tree, local, view(tree));

      expect(summarize(rows)).toEqual([
        [null, "Backup", "target"],
        ["Holiday 2025", "Holiday 2025", "new folder"],
        ["Docs", "Docs", "new folder"],
        ["notes: draft?.txt", "notes+ draft+.txt", "new"],
        ["README.txt", "README.txt", "new"],
        [null, "shopping list.txt", "local only"],
      ]);
      const planned = rows.slice(1, 5).map((r) => r.right.planned);
      expect(planned).toEqual([true, true, true, true]);
      expect(rows[3].right.sizeText).toBe("3 KB");
      expect(rows[3].right.depth).toBe(rows[3].left.depth + 1);
    });

    it("reuses a sub-folder matched ignoring case: keep existing files, new missing ones, local-only after", async () => {
      const modified = new Date(2026, 8, 20, 21, 4).getTime();
      const tree = holidayTree([
        folderItem("Photos"),
        item({ name: "IMG_1.jpg", parentId: "Photos" }),
        item({ name: "IMG_2.jpg", parentId: "Photos" }),
        item({ name: "README.txt" }),
      ]);
      const local = await scan({
        "holiday 2025": {
          "todo.txt": fakeFile(),
          photos: {
            "img_1.JPG": fakeFile({ size: 99, modified }),
            "IMG_10 crop.jpg": fakeFile(),
            edited: {},
          },
        },
      });

      const rows = app.mergeRows(tree, local, view(tree));

      expect(summarize(rows)).toEqual([
        [null, "Backup", "target"],
        ["Holiday 2025", "holiday 2025", "matched"],
        ["Photos", "photos", "matched"],
        ["IMG_1.jpg", "img_1.JPG", "keep"],
        ["IMG_2.jpg", "IMG_2.jpg", "new"],
        [null, "edited", "local only"],
        [null, "IMG_10 crop.jpg", "local only"],
        ["README.txt", "README.txt", "new"],
        [null, "todo.txt", "local only"],
      ]);
      const kept = rows[3].right;
      expect(kept.planned).toBe(false);
      expect(kept.sizeText).toBe("99 B");
      expect(kept.modifiedText).toBe("2026-09-20 21:04");
    });

    it("with several local names matching, exact case wins, else the first in name order; the rest are local-only", async () => {
      const tree = holidayTree([
        item({ name: "Report.pdf" }),
        item({ name: "notes.txt" }),
      ]);
      const local = await scan({
        "Holiday 2025": {
          "report.PDF": fakeFile({ size: 10 }),
          "Report.pdf": fakeFile({ size: 10 }),
          "Notes.txt": fakeFile({ size: 10 }),
          "NOTES.txt": fakeFile({ size: 10 }),
        },
      });

      const rows = app.mergeRows(tree, local, view(tree));

      expect(summarize(rows).slice(2)).toEqual([
        ["Report.pdf", "Report.pdf", "keep"],
        ["notes.txt", "NOTES.txt", "keep"],
        [null, "Notes.txt", "local only"],
        [null, "report.PDF", "local only"],
      ]);
    });

    it("treats an empty local file as missing when the Drive file isn't empty", async () => {
      const tree = holidayTree([
        item({ name: "big.bin", size: 500 }),
        item({ name: "empty.txt", size: 0 }),
      ]);
      const local = await scan({
        "Holiday 2025": {
          "big.bin": fakeFile({ size: 0 }),
          "empty.txt": fakeFile({ size: 0 }),
        },
      });

      const rows = app.mergeRows(tree, local, view(tree));

      expect(summarize(rows).slice(2)).toEqual([
        ["big.bin", "big.bin", "new"],
        ["empty.txt", "empty.txt", "keep"],
      ]);
      expect(rows[2].right.sizeText).toBe("0 B");
    });

    it("keeps a local folder where a Drive file goes, and a local file where a Drive folder goes", async () => {
      const tree = holidayTree([
        folderItem("Clips"),
        item({ name: "x.mp4", parentId: "Clips" }),
        item({ name: "data" }),
      ]);
      const local = await scan({
        "Holiday 2025": { Clips: fakeFile(), data: { "old.csv": fakeFile() } },
      });

      const rows = app.mergeRows(
        tree,
        local,
        view(tree, { expandedLocal: new Set(["Holiday 2025/data"]) }),
      );

      expect(summarize(rows).slice(2)).toEqual([
        ["Clips", "Clips", "keep"],
        ["x.mp4", "x.mp4", "new"],
        ["data", "data", "keep"],
        [null, "old.csv", "local only"],
      ]);
      expect(rows[4].right.isFolder).toBe(true);
    });

    it("collapsing a matched folder collapses both sides", async () => {
      const tree = holidayTree([
        folderItem("Photos"),
        item({ name: "a.jpg", parentId: "Photos" }),
      ]);
      const local = await scan({
        "Holiday 2025": {
          Photos: { "a.jpg": fakeFile(), "b.jpg": fakeFile() },
        },
      });

      const rows = app.mergeRows(
        tree,
        local,
        view(tree, { collapsed: new Set(["Photos"]) }),
      );

      expect(summarize(rows)).toEqual([
        [null, "Backup", "target"],
        ["Holiday 2025", "Holiday 2025", "matched"],
        ["Photos", "Photos", "matched"],
      ]);
      expect(rows[2].left.collapsed).toBe(true);
      expect(rows[2].right.collapsed).toBe(true);
      expect(rows[2].right.driveToggle).toBe("Photos");
    });

    it("shows 'untouched' for an unticked file already on disk, and nothing for one that isn't", async () => {
      const tree = holidayTree([
        item({ name: "keep.txt" }),
        item({ name: "gone.txt" }),
      ]);
      const local = await scan({ "Holiday 2025": { "keep.txt": fakeFile() } });

      const rows = app.mergeRows(
        tree,
        local,
        view(tree, { unselected: new Set(["keep.txt", "gone.txt"]) }),
      );

      expect(summarize(rows)).toEqual([
        [null, "Backup", "target"],
        ["Holiday 2025", "Holiday 2025", "matched"],
        ["keep.txt", "keep.txt", "untouched"],
        ["gone.txt", null, null],
      ]);
    });
  });
});
