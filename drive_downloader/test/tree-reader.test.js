import { describe, expect, it } from "vitest";
import { loadApp } from "../../tools/load-app.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

function createFakeDrive({ metas = {}, pagesByParent = {} } = {}) {
  const getCalls = [];
  const listCalls = [];
  return {
    Files: {
      get(id, optionalArgs) {
        getCalls.push({ id, optionalArgs });
        const meta = metas[id];
        if (!meta) throw new Error("Requested entity was not found.");
        return meta;
      },
      list(optionalArgs) {
        listCalls.push(optionalArgs);
        const match = /'([^']+)' in parents/.exec(optionalArgs.q);
        const parentId = match ? match[1] : null;
        const pages = pagesByParent[parentId] || [{ files: [] }];
        const index = optionalArgs.pageToken
          ? Number(optionalArgs.pageToken)
          : 0;
        const page = pages[index] || { files: [] };
        const nextPageToken =
          index + 1 < pages.length ? String(index + 1) : undefined;
        return { files: page.files, nextPageToken };
      },
    },
    getCalls,
    listCalls,
  };
}

function createFakeUrlFetch(handlers) {
  const calls = [];
  return {
    fetch: (url, options) => {
      calls.push({ url, options });
      const handler = handlers.find((h) => h.test(url));
      if (!handler) throw new Error(`Unhandled fetch: ${url}`);
      const { code, body } = handler.respond(url);
      return {
        getResponseCode: () => code,
        getContentText: () => JSON.stringify(body),
      };
    },
    calls,
  };
}

const scriptAppStub = { getOAuthToken: () => "test-token" };

function file(overrides) {
  return {
    id: "id",
    name: "name",
    mimeType: "text/plain",
    size: "10",
    createdTime: "2020-01-01T00:00:00.000Z",
    capabilities: { canDownload: true },
    ...overrides,
  };
}

function shortcut(id, name, shortcutDetails) {
  return file({ id, name, mimeType: SHORTCUT_MIME, shortcutDetails });
}

describe("drive_downloader Tree reader", () => {
  describe("URL shapes", () => {
    const metas = { root1: { name: "Holiday", mimeType: FOLDER_MIME } };
    const pagesByParent = {
      root1: [{ files: [file({ id: "f1", name: "a.txt" })] }],
    };

    it.each([
      ["https://drive.google.com/drive/folders/root1"],
      ["https://drive.google.com/drive/u/3/folders/root1"],
      ["https://drive.google.com/open?id=root1"],
      ["https://drive.google.com/drive/folders/root1?usp=sharing"],
    ])("accepts %s", (url) => {
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const result = app.treeReaderStart(url);

      expect(result.folder).toEqual({
        id: "root1",
        name: "Holiday",
        resourceKey: null,
      });
    });

    it("rejects a malformed URL", () => {
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const result = app.treeReaderStart(
        "https://drive.google.com/drive/my-drive",
      );

      expect(result).toEqual({ error: "malformed" });
    });
  });

  it("reports notFound for a folder with no access", () => {
    const Drive = createFakeDrive();
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    const result = app.treeReaderStart(
      "https://drive.google.com/drive/folders/missing",
    );

    expect(result).toEqual({ error: "notFound" });
  });

  it("reports notAFolder for a file URL", () => {
    const metas = { file1: { name: "doc.txt", mimeType: "text/plain" } };
    const Drive = createFakeDrive({ metas });
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    const result = app.treeReaderStart(
      "https://drive.google.com/file/d/file1/view",
    );

    expect(result).toEqual({ error: "notAFolder" });
  });

  it("reports empty for a folder with no children", () => {
    const metas = { empty1: { name: "Empty", mimeType: FOLDER_MIME } };
    const pagesByParent = { empty1: [{ files: [] }] };
    const Drive = createFakeDrive({ metas, pagesByParent });
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    const result = app.treeReaderStart(
      "https://drive.google.com/drive/folders/empty1",
    );

    expect(result).toEqual({ error: "empty" });
  });

  it("passes orderBy, pageSize and the Shared Drive flags", () => {
    const metas = { root1: { name: "Holiday", mimeType: FOLDER_MIME } };
    const pagesByParent = { root1: [{ files: [file({ id: "f1" })] }] };
    const Drive = createFakeDrive({ metas, pagesByParent });
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    app.treeReaderStart("https://drive.google.com/drive/folders/root1");

    expect(Drive.listCalls).toHaveLength(1);
    expect(Drive.listCalls[0]).toMatchObject({
      q: "'root1' in parents and trashed = false",
      orderBy: "folder,name_natural,createdTime",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    expect(Drive.listCalls[0].fields).toContain("resourceKey");
  });

  it("carries id, resourceKey, parent, name, mimeType, size, createdTime and canDownload on each Item", () => {
    const metas = { root1: { name: "Holiday", mimeType: FOLDER_MIME } };
    const pagesByParent = {
      root1: [
        {
          files: [
            file({
              id: "f1",
              name: "a.txt",
              size: "42",
              capabilities: { canDownload: false },
            }),
          ],
        },
      ],
    };
    const Drive = createFakeDrive({ metas, pagesByParent });
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    const start = app.treeReaderStart(
      "https://drive.google.com/drive/folders/root1",
    );
    const step = app.treeReaderStep(start.continuation);

    expect(step.items).toEqual([
      {
        id: "f1",
        resourceKey: null,
        parentId: "root1",
        name: "a.txt",
        mimeType: "text/plain",
        size: 42,
        createdTime: "2020-01-01T00:00:00.000Z",
        canDownload: false,
      },
    ]);
    expect(step.continuation).toBeNull();
  });

  it("reads a resource-keyed folder through UrlFetchApp, not the Advanced Drive service", () => {
    const Drive = createFakeDrive();
    const UrlFetchApp = createFakeUrlFetch([
      {
        test: (url) => /\/files\/rk1\?/.test(url),
        respond: () => ({
          code: 200,
          body: { name: "Shared", mimeType: FOLDER_MIME },
        }),
      },
      {
        test: (url) => /\/files\?/.test(url),
        respond: () => ({
          code: 200,
          body: { files: [file({ id: "f1", name: "a.txt" })] },
        }),
      },
    ]);
    const app = loadApp("drive_downloader", {
      Drive,
      UrlFetchApp,
      ScriptApp: scriptAppStub,
    });

    const result = app.treeReaderStart(
      "https://drive.google.com/drive/folders/rk1?resourcekey=0-xyz",
    );

    expect(result.folder).toEqual({
      id: "rk1",
      name: "Shared",
      resourceKey: "0-xyz",
    });
    expect(Drive.getCalls).toHaveLength(0);
    expect(Drive.listCalls).toHaveLength(0);
    expect(UrlFetchApp.calls).toHaveLength(2);
    for (const call of UrlFetchApp.calls) {
      expect(call.options.headers["X-Goog-Drive-Resource-Keys"]).toBe(
        "rk1/0-xyz",
      );
      expect(call.options.headers.Authorization).toBe("Bearer test-token");
    }
  });

  it("has a sub-folder without its own resource key inherit its parent's", () => {
    const Drive = createFakeDrive();
    const UrlFetchApp = createFakeUrlFetch([
      {
        test: (url) => /\/files\/rk1\?/.test(url),
        respond: () => ({
          code: 200,
          body: { name: "Shared", mimeType: FOLDER_MIME },
        }),
      },
      {
        test: (url) =>
          (new URL(url).searchParams.get("q") || "").includes(
            "'rk1' in parents",
          ),
        respond: () => ({
          code: 200,
          body: {
            files: [file({ id: "sub1", name: "Sub", mimeType: FOLDER_MIME })],
          },
        }),
      },
      {
        test: (url) =>
          (new URL(url).searchParams.get("q") || "").includes(
            "'sub1' in parents",
          ),
        respond: () => ({
          code: 200,
          body: { files: [file({ id: "f1", name: "a.txt" })] },
        }),
      },
    ]);
    const app = loadApp("drive_downloader", {
      Drive,
      UrlFetchApp,
      ScriptApp: scriptAppStub,
    });

    const start = app.treeReaderStart(
      "https://drive.google.com/drive/folders/rk1?resourcekey=0-xyz",
    );
    const step = app.treeReaderStep(start.continuation);

    const subCall = UrlFetchApp.calls.find((c) =>
      (new URL(c.url).searchParams.get("q") || "").includes(
        "'sub1' in parents",
      ),
    );
    expect(subCall.options.headers["X-Goog-Drive-Resource-Keys"]).toBe(
      "sub1/0-xyz",
    );
    expect(step.items.map((i) => i.id)).toEqual(["sub1", "f1"]);
  });

  it("returns a continuation when the time budget runs out, and finishes on later calls", () => {
    const metas = { root2: { name: "Big", mimeType: FOLDER_MIME } };
    const pagesByParent = {
      root2: [
        {
          files: [
            file({ id: "subA", name: "A", mimeType: FOLDER_MIME }),
            file({ id: "subB", name: "B", mimeType: FOLDER_MIME }),
          ],
        },
      ],
      subA: [{ files: [file({ id: "fileA", name: "a.txt" })] }],
      subB: [{ files: [file({ id: "fileB", name: "b.txt" })] }],
    };
    const Drive = createFakeDrive({ metas, pagesByParent });
    const app = loadApp("drive_downloader", {
      Drive,
      ScriptApp: scriptAppStub,
    });

    const start = app.treeReaderStart(
      "https://drive.google.com/drive/folders/root2",
    );
    const step1 = app.treeReaderStep(start.continuation, 0);

    expect(step1.continuation).not.toBeNull();
    expect(step1.items.map((i) => i.id).sort()).toEqual([
      "fileA",
      "subA",
      "subB",
    ]);

    const step2 = app.treeReaderStep(step1.continuation, 0);

    expect(step2.continuation).toBeNull();
    expect(step2.items.map((i) => i.id)).toEqual(["fileB"]);
  });

  describe("Shortcuts", () => {
    it("walks a Shortcut to a folder as a folder, carrying its own name and the target's id, name, mimeType and resource key", () => {
      const metas = {
        root1: { name: "Holiday", mimeType: FOLDER_MIME },
        target1: { name: "Real Folder", mimeType: FOLDER_MIME },
      };
      const pagesByParent = {
        root1: [
          {
            files: [
              shortcut("sc1", "Link to Real Folder", {
                targetId: "target1",
                targetMimeType: FOLDER_MIME,
              }),
            ],
          },
        ],
        target1: [{ files: [file({ id: "f1", name: "inside.txt" })] }],
      };
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/root1",
      );
      const step = app.treeReaderStep(start.continuation);

      const shortcutItem = step.items.find((i) => i.id === "sc1");
      expect(shortcutItem.name).toBe("Link to Real Folder");
      expect(shortcutItem.target).toEqual({
        id: "target1",
        resourceKey: null,
        name: "Real Folder",
        mimeType: FOLDER_MIME,
        size: null,
      });
      const childItem = step.items.find((i) => i.id === "f1");
      expect(childItem.parentId).toBe("sc1");
    });

    it("gets one files.get for a Shortcut to a file, carrying the target's id, name, mimeType and size", () => {
      const metas = {
        root1: { name: "Holiday", mimeType: FOLDER_MIME },
        target2: { name: "clip.mp4", mimeType: "video/mp4", size: "999" },
      };
      const pagesByParent = {
        root1: [
          {
            files: [
              shortcut("sc2", "Holiday video", {
                targetId: "target2",
                targetMimeType: "video/mp4",
              }),
            ],
          },
        ],
      };
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/root1",
      );
      const step = app.treeReaderStep(start.continuation);

      expect(step.items).toHaveLength(1);
      const item = step.items[0];
      expect(item.mimeType).toBe(SHORTCUT_MIME);
      expect(item.target).toEqual({
        id: "target2",
        resourceKey: null,
        name: "clip.mp4",
        mimeType: "video/mp4",
        size: 999,
      });
      expect(Drive.getCalls.filter((c) => c.id === "target2")).toHaveLength(1);
    });

    it("fetches a Shortcut target's meta through UrlFetchApp when the target has its own resource key", () => {
      const Drive = createFakeDrive({
        metas: { root1: { name: "Holiday", mimeType: FOLDER_MIME } },
        pagesByParent: {
          root1: [
            {
              files: [
                shortcut("sc3", "Video link", {
                  targetId: "target3",
                  targetMimeType: "video/mp4",
                  targetResourceKey: "rk-target",
                }),
              ],
            },
          ],
        },
      });
      const UrlFetchApp = createFakeUrlFetch([
        {
          test: (url) => /\/files\/target3\?/.test(url),
          respond: () => ({
            code: 200,
            body: { name: "clip.mp4", mimeType: "video/mp4", size: "500" },
          }),
        },
      ]);
      const app = loadApp("drive_downloader", {
        Drive,
        UrlFetchApp,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/root1",
      );
      const step = app.treeReaderStep(start.continuation);

      expect(step.items[0].target).toEqual({
        id: "target3",
        resourceKey: "rk-target",
        name: "clip.mp4",
        mimeType: "video/mp4",
        size: 500,
      });
      expect(UrlFetchApp.calls).toHaveLength(1);
      expect(
        UrlFetchApp.calls[0].options.headers["X-Goog-Drive-Resource-Keys"],
      ).toBe("target3/rk-target");
    });

    it("carries the enclosing folder's inherited resource key on the target when the Shortcut reports none of its own", () => {
      const UrlFetchApp = createFakeUrlFetch([
        {
          test: (url) => /\/files\/rk1\?/.test(url),
          respond: () => ({
            code: 200,
            body: { name: "Shared", mimeType: FOLDER_MIME },
          }),
        },
        {
          test: (url) => /\/files\?/.test(url),
          respond: () => ({
            code: 200,
            body: {
              files: [
                shortcut("sc4", "Video link", {
                  targetId: "target4",
                  targetMimeType: "video/mp4",
                }),
              ],
            },
          }),
        },
        {
          test: (url) => /\/files\/target4\?/.test(url),
          respond: () => ({
            code: 200,
            body: { name: "clip.mp4", mimeType: "video/mp4", size: "500" },
          }),
        },
      ]);
      const app = loadApp("drive_downloader", {
        Drive: createFakeDrive(),
        UrlFetchApp,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/rk1?resourcekey=0-xyz",
      );
      const step = app.treeReaderStep(start.continuation);

      expect(step.items[0].target).toEqual({
        id: "target4",
        resourceKey: "0-xyz",
        name: "clip.mp4",
        mimeType: "video/mp4",
        size: 500,
      });
      const targetCall = UrlFetchApp.calls.find((c) =>
        /\/files\/target4\?/.test(c.url),
      );
      expect(targetCall.options.headers["X-Goog-Drive-Resource-Keys"]).toBe(
        "target4/0-xyz",
      );
    });

    it("flags a Shortcut back into its own ancestry as a loop, without walking it again", () => {
      const metas = { root1: { name: "Holiday", mimeType: FOLDER_MIME } };
      const pagesByParent = {
        root1: [
          { files: [file({ id: "subA", name: "Sub", mimeType: FOLDER_MIME })] },
        ],
        subA: [
          {
            files: [
              shortcut("loopSc", "Back to Holiday", {
                targetId: "root1",
                targetMimeType: FOLDER_MIME,
              }),
            ],
          },
        ],
      };
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/root1",
      );
      const step = app.treeReaderStep(start.continuation);

      const loopItem = step.items.find((i) => i.id === "loopSc");
      expect(loopItem.loop).toBe(true);
      expect(step.continuation).toBeNull();
      expect(
        Drive.listCalls.filter((c) => c.q.includes("'root1' in parents")),
      ).toHaveLength(1);
    });

    it("flags a Shortcut whose target 404s as unreachable, with no target on the Item", () => {
      const metas = { root1: { name: "Holiday", mimeType: FOLDER_MIME } };
      const pagesByParent = {
        root1: [
          {
            files: [
              shortcut("deadSc", "Broken link", {
                targetId: "gone",
                targetMimeType: FOLDER_MIME,
              }),
            ],
          },
        ],
      };
      const Drive = createFakeDrive({ metas, pagesByParent });
      const app = loadApp("drive_downloader", {
        Drive,
        ScriptApp: scriptAppStub,
      });

      const start = app.treeReaderStart(
        "https://drive.google.com/drive/folders/root1",
      );
      const step = app.treeReaderStep(start.continuation);

      const deadItem = step.items[0];
      expect(deadItem.unreachable).toBe(true);
      expect(deadItem.target).toBeNull();
    });
  });
});
