#!/usr/bin/env node

/**
 * In-memory fake of the File System Access directory handle surface.
 *
 * Description
 *     Stands in for the Disk port the Disk Window core reaches the local
 *     disk through (see docs/adr/0001-client-side-core.md), so client-core
 *     tests run in Node without a browser.
 */

const FILE = Symbol("fakeFile");

/**
 * A file entry for `createFakeDirectory`.
 *
 * Inputs
 *     props: `{ size, modified }`, both optional (0 by default);
 *         `modified` is epoch milliseconds.
 *
 * Outputs
 *     A file spec to place in a `createFakeDirectory` entries object.
 */
export function fakeFile({ size = 0, modified = 0 } = {}) {
  return { [FILE]: true, size, modified };
}

/**
 * An Error carrying a DOMException-style `name`.
 *
 * Inputs
 *     name: the DOMException name, e.g. "NotFoundError".
 *     message: optional message, the name by default.
 *
 * Outputs
 *     The Error.
 */
export function domError(name, message = name) {
  return Object.assign(new Error(message), { name });
}

/**
 * Builds a fake directory handle from a nested spec.
 *
 * Description
 *     A plain object is a folder, a `fakeFile(...)` a file; entries are
 *     listed in spec order. The handle's `fake` object steers it:
 *     `permission` is what `queryPermission` answers ("granted" by
 *     default), `requestResult` what `requestPermission` answers and then
 *     sets, `failWith` an error `values()` throws (folder gone, permission
 *     lost), and `requestCount` counts `requestPermission` calls.
 *
 * Inputs
 *     name: the folder's name.
 *     entries: nested spec of the folder's contents.
 *
 * Outputs
 *     The fake directory handle.
 */
export function createFakeDirectory(name, entries = {}) {
  const fake = {
    permission: "granted",
    requestResult: "granted",
    failWith: null,
    requestCount: 0,
  };
  return {
    kind: "directory",
    name,
    fake,
    async *values() {
      if (fake.failWith) throw fake.failWith;
      for (const [childName, spec] of Object.entries(entries)) {
        yield spec[FILE]
          ? fakeFileHandle(childName, spec)
          : createFakeDirectory(childName, spec);
      }
    },
    async queryPermission() {
      return fake.permission;
    },
    async requestPermission() {
      fake.requestCount += 1;
      fake.permission = fake.requestResult;
      return fake.requestResult;
    },
  };
}

/**
 * A fake file handle.
 *
 * Inputs
 *     name: the file's name.
 *     spec: its `fakeFile(...)` spec.
 *
 * Outputs
 *     The fake file handle.
 */
function fakeFileHandle(name, spec) {
  return {
    kind: "file",
    name,
    async getFile() {
      return { name, size: spec.size, lastModified: spec.modified };
    },
  };
}
