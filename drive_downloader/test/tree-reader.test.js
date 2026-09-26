import { describe, expect, it } from "vitest";
import { loadApp } from "../../tools/load-app.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";

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
});
