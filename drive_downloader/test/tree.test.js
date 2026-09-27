import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const folder = { id: "root", name: "Holiday" };

function item(overrides) {
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

// A Shortcut Item as the Tree reader returns it (see TreeReader.js).
function shortcutItem(overrides) {
  return item({
    mimeType: SHORTCUT_MIME,
    size: null,
    target: {
      id: "target",
      resourceKey: null,
      name: "target",
      mimeType: "text/plain",
      size: 5,
    },
    ...overrides,
  });
}

describe("drive_downloader Tree", () => {
  const app = loadClientCore("drive_downloader", ["frontend/tree.js.html"]);

  describe("buildTree", () => {
    it("nests Items under their parent regardless of chunk order", () => {
      const items = [
        item({
          id: "sub",
          parentId: "root",
          name: "Sub",
          mimeType: FOLDER_MIME,
        }),
        item({ id: "deep", parentId: "sub", name: "deep.txt" }),
        item({ id: "top", parentId: "root", name: "top.txt" }),
      ];

      const tree = app.buildTree(folder, items);

      expect(tree.id).toBe("root");
      expect(tree.children.map((c) => c.id)).toEqual(["sub", "top"]);
      const sub = tree.children.find((c) => c.id === "sub");
      expect(sub.children.map((c) => c.id)).toEqual(["deep"]);
    });
  });

  describe("driveRow", () => {
    it("totals a folder's descendant file sizes, with a + when any is unknown", () => {
      const items = [
        item({
          id: "sub",
          parentId: "root",
          name: "Sub",
          mimeType: FOLDER_MIME,
        }),
        item({ id: "a", parentId: "root", name: "a.txt", size: 100 }),
        item({ id: "b", parentId: "sub", name: "b.txt", size: 50 }),
        item({
          id: "c",
          parentId: "sub",
          name: "c",
          mimeType: "application/vnd.google-apps.document",
          size: null,
        }),
      ];
      const tree = app.buildTree(folder, items);

      const root = app.driveRow(tree, 0, true, { collapsed: new Set() });
      const sub = app.driveRow(tree.children[0], 1, false, {
        collapsed: new Set(),
      });
      expect(root.sizeText).toBe("150 B+");
      expect(root.statusText).toBe("Source Folder");
      expect(sub.sizeText).toBe("50 B+");
      expect(sub.statusText).toBe("0 / 2 files");
    });

    it("shows pending status and a formatted size for files", () => {
      const items = [
        item({ id: "a", parentId: "root", name: "a.txt", size: 2048 }),
      ];
      const tree = app.buildTree(folder, items);

      const row = app.driveRow(tree.children[0], 1, false, {
        collapsed: new Set(),
      });
      expect(row.statusText).toBe("pending");
      expect(row.sizeText).toBe("2 KB");
    });

    it("marks a collapsed folder but keeps its totals", () => {
      const items = [
        item({
          id: "sub",
          parentId: "root",
          name: "Sub",
          mimeType: FOLDER_MIME,
        }),
        item({ id: "a", parentId: "sub", name: "a.txt", size: 10 }),
      ];
      const tree = app.buildTree(folder, items);

      const row = app.driveRow(tree.children[0], 1, false, {
        collapsed: new Set(["sub"]),
      });

      expect(row.collapsed).toBe(true);
      expect(row.hasChildren).toBe(true);
      expect(row.sizeText).toBe("10 B");
    });
  });

  describe("allFolderIds", () => {
    it("collects every folder id under the root, but not the root itself", () => {
      const items = [
        item({
          id: "sub",
          parentId: "root",
          name: "Sub",
          mimeType: FOLDER_MIME,
        }),
        item({
          id: "deep",
          parentId: "sub",
          name: "Deep",
          mimeType: FOLDER_MIME,
        }),
        item({ id: "leaf", parentId: "deep", name: "leaf.txt" }),
      ];
      const tree = app.buildTree(folder, items);

      expect([...app.allFolderIds(tree)].sort()).toEqual(["deep", "sub"]);
    });
  });

  describe("escapeHtml", () => {
    it("escapes the characters that matter inside HTML text and attributes", () => {
      expect(app.escapeHtml(`<a href="x">&'</a>`)).toBe(
        "&lt;a href=&quot;x&quot;&gt;&amp;'&lt;/a&gt;",
      );
    });
  });

  describe("Shortcuts", () => {
    it("normalizes a Shortcut to a file into a leaf taking on the target's mimeType, size and resource key", () => {
      const items = [
        shortcutItem({
          id: "s",
          name: "Holiday video",
          target: {
            id: "target1",
            resourceKey: "rk-1",
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 500,
          },
        }),
      ];
      const tree = app.buildTree(folder, items);

      const node = tree.children[0];
      expect(node.children).toBeUndefined();
      expect(node.isShortcut).toBe(true);
      expect(node.ownName).toBe("Holiday video");
      expect(node.name).toBe("clip.mp4");
      expect(node.mimeType).toBe("video/mp4");
      expect(node.size).toBe(500);
      expect(node.resourceKey).toBe("rk-1");
      expect(node.driveId).toBe("target1");
    });

    it("normalizes a reachable, non-looping Shortcut to a folder into a folder node keyed by the Shortcut's own id", () => {
      const items = [
        shortcutItem({
          id: "s",
          name: "Link to Sub",
          target: {
            id: "realSub",
            resourceKey: null,
            name: "Sub",
            mimeType: FOLDER_MIME,
            size: null,
          },
        }),
        item({ id: "inside", parentId: "s", name: "inside.txt" }),
      ];
      const tree = app.buildTree(folder, items);

      const node = tree.children.find((c) => c.id === "s");
      expect(node.children.map((c) => c.id)).toEqual(["inside"]);
      expect(node.driveId).toBe("realSub");
    });

    it("builds a loop or unreachable Shortcut as a plain leaf with a disabled checkbox", () => {
      const items = [
        shortcutItem({
          id: "loopSc",
          name: "Back",
          loop: true,
          target: {
            id: "ancestor",
            resourceKey: null,
            name: "Ancestor",
            mimeType: FOLDER_MIME,
            size: null,
          },
        }),
        shortcutItem({
          id: "deadSc",
          name: "Broken",
          unreachable: true,
          target: null,
        }),
      ];
      const tree = app.buildTree(folder, items);

      for (const id of ["loopSc", "deadSc"]) {
        const node = tree.children.find((c) => c.id === id);
        expect(node.children).toBeUndefined();
        const row = app.driveRow(node, 1, false, { collapsed: new Set() });
        expect(row.selectionDisabled).toBe(true);
      }
    });

    it("gives a loop Item the status loop and an unreachable target the status failed, with no Run needed", () => {
      const items = [
        shortcutItem({ id: "loopSc", name: "Back", loop: true }),
        shortcutItem({
          id: "deadSc",
          name: "Broken",
          unreachable: true,
          target: null,
        }),
      ];
      const tree = app.buildTree(folder, items);

      const loopRow = app.driveRow(
        tree.children.find((c) => c.id === "loopSc"),
        1,
        false,
        { collapsed: new Set() },
      );
      const deadRow = app.driveRow(
        tree.children.find((c) => c.id === "deadSc"),
        1,
        false,
        { collapsed: new Set() },
      );
      expect(loopRow.statusText).toBe("loop");
      expect(deadRow.statusText).toBe("failed");
      expect(deadRow.reason).toMatch(/target wasn't found/);
    });

    it("shows the badge and the target's type in the Type label, and the other name on hover", () => {
      const items = [
        shortcutItem({
          id: "s",
          name: "Holiday video",
          target: {
            id: "target1",
            resourceKey: null,
            name: "clip.mp4",
            mimeType: "video/mp4",
            size: 500,
          },
        }),
      ];
      const tree = app.buildTree(folder, items);
      const node = tree.children[0];

      const off = app.driveRow(node, 1, false, {
        collapsed: new Set(),
        useShortcutTargetNames: false,
      });
      expect(off.name).toBe("Holiday video.mp4");
      expect(off.typeLabel).toBe("\u21aa MP4 video");
      expect(off.otherName).toBe("clip.mp4");

      const on = app.driveRow(node, 1, false, {
        collapsed: new Set(),
        useShortcutTargetNames: true,
      });
      expect(on.name).toBe("clip.mp4");
      expect(on.otherName).toBe("Holiday video");
    });

    it("doesn't count a loop's size as unknown in folder totals", () => {
      const items = [
        item({ id: "a", name: "a.txt", size: 10 }),
        shortcutItem({
          id: "loopSc",
          name: "Back",
          loop: true,
          target: {
            id: "ancestor",
            resourceKey: null,
            name: "Ancestor",
            mimeType: FOLDER_MIME,
            size: null,
          },
        }),
      ];
      const tree = app.buildTree(folder, items);

      const row = app.driveRow(tree, 0, true, { collapsed: new Set() });
      expect(row.sizeText).toBe("10 B");
    });

    it("doesn't count an unreachable Shortcut's size as unknown in folder totals", () => {
      const items = [
        item({ id: "a", name: "a.txt", size: 10 }),
        shortcutItem({
          id: "deadSc",
          name: "Broken",
          unreachable: true,
          target: null,
        }),
      ];
      const tree = app.buildTree(folder, items);

      const row = app.driveRow(tree, 0, true, { collapsed: new Set() });
      expect(row.sizeText).toBe("10 B");
    });
  });
});
