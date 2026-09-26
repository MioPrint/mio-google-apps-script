import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
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

      const root = app.driveRow(tree, 0, true, new Set());
      const sub = app.driveRow(tree.children[0], 1, false, new Set());
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

      const row = app.driveRow(tree.children[0], 1, false, new Set());
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

      const row = app.driveRow(tree.children[0], 1, false, new Set(["sub"]));

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
});
