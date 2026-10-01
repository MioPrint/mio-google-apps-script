#!/usr/bin/env node

/**
 * Tests for the tooltip texts the core puts on tree rows.
 *
 * Description
 *     Runs the Tree, tips, naming, scan and merge partials through
 *     loadClientCore and asserts the name tips and the Status / Result tips
 *     on the rows the Disk Window renders (ticket 29).
 */

import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";
import { createFakeDirectory, fakeFile } from "./fake-disk.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const FORM_MIME = "application/vnd.google-apps.form";

const app = loadClientCore("drive_downloader", [
  "frontend/tree.js.html",
  "frontend/tips.js.html",
  "frontend/naming.js.html",
  "frontend/target-scan.js.html",
  "frontend/merge.js.html",
]);

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

function tree(items) {
  return app.buildTree({ id: "root", name: "Holiday" }, items);
}

// A Drive row as the Disk Window renders it, before any Run unless
// `items` says otherwise.
function drive(items, id, view = {}) {
  const t = tree(items);
  const node = app.findNode(t, id);
  return app.driveRow(node, 1, false, { collapsed: new Set(), ...view });
}

function status(entry) {
  return drive(
    [item({ name: "a.txt", size: 100 })],
    "a.txt",
    entry ? { items: new Map([["a.txt", entry]]) } : {},
  ).statusTip;
}

// Merged rows of a Source Folder "Holiday" against a Target Folder
// "Backup" holding the given on-disk entries.
async function merge(items, disk, view = {}) {
  const t = tree(items);
  const target = await app.scanTargetFolder(
    createFakeDirectory("Backup", disk),
  );
  return app.mergeRows(t, target, {
    collapsed: new Set(),
    expandedLocal: new Set(),
    localNames: app.computeLocalNames(t, false, false),
    ...view,
  });
}

function pair(rows, name) {
  return rows.find((r) => r.left && r.left.name === name);
}

describe("drive_downloader tooltip texts", () => {
  describe("Drive name tips", () => {
    it("shows the full name and the Type label of a plain file", () => {
      const row = drive([item({ name: "photo.jpg" })], "photo.jpg");
      expect(row.nameTip).toBe("photo.jpg\nJPEG");
    });

    it("shows a folder's name and Folder", () => {
      const row = drive(
        [item({ name: "Sub", mimeType: FOLDER_MIME, size: null })],
        "Sub",
      );
      expect(row.nameTip).toBe("Sub\nFolder");
    });

    it("shows what a Native File exports to", () => {
      const row = drive(
        [item({ name: "Budget", mimeType: SHEET_MIME, size: null })],
        "Budget",
      );
      expect(row.nameTip).toBe("Budget\nSheets → .xlsx");
    });

    it("names the other name of a Shortcut, in both naming modes", () => {
      const items = [
        item({
          id: "s",
          name: "Holiday video",
          mimeType: SHORTCUT_MIME,
          size: null,
          target: {
            id: "t",
            resourceKey: null,
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 5,
          },
        }),
      ];
      const own = drive(items, "s", { useShortcutTargetNames: false });
      const target = drive(items, "s", { useShortcutTargetNames: true });
      expect(own.nameTip).toBe(
        "Holiday video.mp4\n↪ MP4 video\nShortcut to: clip.mp4",
      );
      expect(target.nameTip).toBe(
        "clip.mp4\n↪ MP4 video\nShortcut to: Holiday video",
      );
    });
  });

  describe("Drive status tips", () => {
    it("describes each Item Status", () => {
      expect(status(null)).toBe("Waiting for its turn in the Run.");
      expect(status({ status: "done", received: 100 })).toBe("Downloaded.");
      expect(status({ status: "exists", received: 100 })).toBe(
        "Already in the Target Folder; skipped.",
      );
      expect(status({ status: "unselected", received: 0 })).toBe(
        "Unticked; left out of the Run.",
      );
      const unsupported = drive(
        [item({ name: "f", mimeType: FORM_MIME, unsupported: true })],
        "f",
      );
      expect(unsupported.statusTip).toBe(
        "A file type that can't be mirrored (Form, Site, My Map…).",
      );
      const loop = drive(
        [item({ name: "l", mimeType: SHORTCUT_MIME, loop: true })],
        "l",
      );
      expect(loop.statusTip).toBe(
        "A Shortcut back into its own folder; skipped.",
      );
    });

    it("adds a failure's reason after the description", () => {
      expect(
        status({ status: "failed", received: 0, reason: "HTTP 500 (boom)" }),
      ).toBe("Could not be downloaded.\nHTTP 500 (boom)");
    });

    it("adds the bytes, percentage and Attempt while downloading", () => {
      expect(
        status({
          status: "downloading",
          phase: "transferring",
          received: 25,
          attempt: 2,
        }),
      ).toBe("Being downloaded now.\n25 B / 100 B · 25% · Attempt 2");
    });

    it("adds the retry countdown while waiting to retry", () => {
      expect(
        status({
          status: "downloading",
          phase: "waiting",
          received: 25,
          attempt: 2,
          waitMs: 2000,
          waitKind: "backoff",
        }),
      ).toBe("Being downloaded now.\nretry 1/4 in 2 s");
    });

    it("says finalizing while finalizing", () => {
      expect(
        status({ status: "downloading", phase: "finalizing", received: 100 }),
      ).toBe("Being downloaded now.\nfinalizing…");
    });

    it("describes a folder's count, and the Source Folder itself", () => {
      const t = tree([
        item({ name: "Sub", mimeType: FOLDER_MIME, size: null }),
        item({ name: "a.txt", parentId: "Sub" }),
      ]);
      const sub = app.driveRow(t.children[0], 1, false, {
        collapsed: new Set(),
      });
      const root = app.driveRow(t, 0, true, { collapsed: new Set() });
      expect(sub.statusTip).toBe(
        "Files settled / files to handle in this folder.",
      );
      expect(root.statusTip).toBe(
        "The Source Folder you pasted.\n0 / 1 files settled",
      );
    });
  });

  describe("merged rows", () => {
    it("carries the full Local Name as the Target Folder name tip", async () => {
      const rows = await merge(
        [item({ name: "My File.txt" })],
        { Holiday: {}, "notes.md": fakeFile({ size: 1 }) },
        {
          localNames: new Map([
            ["root", "Holiday"],
            ["My File.txt", "My_File.txt"],
          ]),
        },
      );
      expect(pair(rows, "My File.txt").right.nameTip).toBe("My_File.txt");
      expect(rows.find((r) => !r.left).right.nameTip).toBe("notes.md");
    });

    it("notes 'overwrites' and the empty-file replacement on a pending file", async () => {
      const items = [
        item({ name: "a.txt" }),
        item({ name: "b.txt", size: 10 }),
      ];
      const rows = await merge(
        items,
        {
          Holiday: {
            "a.txt": fakeFile({ data: "old" }),
            "b.txt": fakeFile({ size: 0 }),
          },
        },
        { skipExisting: false },
      );
      expect(pair(rows, "a.txt").left.statusTip).toBe(
        "Waiting for its turn in the Run.\noverwrites",
      );
      expect(pair(rows, "b.txt").left.statusTip).toBe(
        "Waiting for its turn in the Run.\nempty file will be replaced",
      );
    });

    it("describes every Result", async () => {
      const items = [
        item({ name: "Sub", mimeType: FOLDER_MIME, size: null }),
        item({ name: "new.txt" }),
        item({ name: "keep.txt" }),
        item({ name: "over.txt" }),
        item({ name: "way", size: 10 }),
        item({ name: "off.txt" }),
      ];
      const disk = {
        Holiday: {
          Sub: {},
          "keep.txt": fakeFile({ data: "old" }),
          "over.txt": fakeFile({ data: "old" }),
          way: {},
          "off.txt": fakeFile({ data: "old" }),
          "local.txt": fakeFile({ size: 1 }),
        },
      };
      const tips = (rows) =>
        Object.fromEntries(
          rows.filter((r) => r.right).map((r) => [r.right.name, r.right]),
        );
      const skipping = tips(await merge(items, disk, {}));
      expect(skipping.Holiday.resultTip).toBe("Folder already there; reused.");
      expect(skipping.Sub.resultTip).toBe("Folder already there; reused.");
      expect(skipping["new.txt"].resultTip).toBe("File the Run will create.");
      expect(skipping["keep.txt"].resultTip).toBe(
        "Already there; left as it is.",
      );
      expect(skipping["local.txt"].resultTip).toBe(
        "Only on disk, not in the Source Folder; left alone.",
      );
      const overwriting = tips(
        await merge(items, disk, {
          skipExisting: false,
          unselected: new Set(["off.txt"]),
        }),
      );
      expect(overwriting["over.txt"].resultTip).toBe(
        "Existing file the Run will overwrite.",
      );
      expect(overwriting.way.resultTip).toBe(
        "A folder and a file need the same name; nothing is deleted to make room.",
      );
      expect(overwriting["off.txt"].resultTip).toBe(
        "Unticked on the Drive side; left alone.",
      );
      const newFolder = tips(
        await merge(
          [item({ name: "Sub", mimeType: FOLDER_MIME, size: null })],
          {
            Holiday: {},
          },
        ),
      );
      expect(newFolder.Sub.resultTip).toBe("Folder the Run will create.");
    });

    it("describes each Result a Run leaves, with the failure reason", async () => {
      const items = [
        item({ name: "w.txt" }),
        item({ name: "d.txt" }),
        item({ name: "o.txt" }),
        item({ name: "f.txt" }),
        item({ name: "k.txt" }),
      ];
      const disk = {
        Holiday: {
          "o.txt": fakeFile({ data: "old" }),
          "k.txt": fakeFile({ data: "old" }),
        },
      };
      const run = (entries) => ({
        skipExisting: false,
        items: new Map(Object.entries(entries)),
      });
      const rows = await merge(
        items,
        disk,
        run({
          "w.txt": {
            status: "downloading",
            phase: "transferring",
            received: 5,
            attempt: 1,
          },
          "d.txt": { status: "done", received: 10 },
          "o.txt": { status: "done", received: 10, overwrite: true },
          "f.txt": { status: "failed", received: 0, reason: "HTTP 500" },
          "k.txt": {
            status: "failed",
            received: 0,
            reason: "HTTP 500",
            overwrite: true,
          },
        }),
      );
      const result = (name) => pair(rows, name).right.resultTip;
      expect(result("w.txt")).toBe(
        "Being written now.\n5 B / 10 B · 50% · Attempt 1",
      );
      expect(result("d.txt")).toBe("Written.");
      expect(result("o.txt")).toBe("Existing file replaced.");
      expect(result("f.txt")).toBe("Nothing was written.\nHTTP 500");
      expect(result("k.txt")).toBe("Existing file left as it was.\nHTTP 500");
    });
  });
});
