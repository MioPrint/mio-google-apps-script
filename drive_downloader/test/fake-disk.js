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
 *     props: `{ size, modified, data }`, all optional; `modified` is
 *         epoch milliseconds, `data` the file's bytes (a string or
 *         Uint8Array; its length wins over `size`).
 *
 * Outputs
 *     A file spec to place in a `createFakeDirectory` entries object. The
 *     spec is live: writes through a handle update its `data`, `size` and
 *     `modified`.
 */
export function fakeFile({ size = 0, modified = 0, data } = {}) {
  const bytes = typeof data === "string" ? Buffer.from(data) : data;
  return {
    [FILE]: true,
    size: bytes ? bytes.length : size,
    modified,
    data: bytes,
  };
}

/**
 * Whether an entries-object value is a file spec.
 *
 * Inputs
 *     spec: an entries-object value.
 *
 * Outputs
 *     True for a `fakeFile(...)` spec, false for a folder.
 */
export function isFakeFile(spec) {
  return !!(spec && spec[FILE]);
}

/**
 * A file's contents as a string.
 *
 * Inputs
 *     spec: a `fakeFile(...)` spec (live, from the entries object).
 *
 * Outputs
 *     Its bytes decoded as UTF-8; "" when it holds none.
 */
export function fileText(spec) {
  return spec.data ? Buffer.from(spec.data).toString() : "";
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
 *     listed in spec order, and the spec is live: created folders and
 *     files, and written bytes, land in it. The handle's `fake` object
 *     (shared by every handle below it) steers it: `permission` is what
 *     `queryPermission` answers ("granted" by default), `requestResult`
 *     what `requestPermission` answers and then sets, `failWith` an error
 *     `values()` throws (folder gone, permission lost), `requestCount`
 *     counts `requestPermission` calls, `now` stamps written files'
 *     `modified`, `onClose(name, bytes)` may return other bytes to
 *     commit when a writable closes (a disk that loses data), and
 *     `failWriteWith` an error every `write()` throws until cleared (a
 *     full disk, or permission lost mid-transfer).
 *
 *     Writables follow Chrome's swap-file semantics: bytes go to a swap
 *     buffer that replaces the file only on `close()`; `abort()` drops it.
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
    failWriteWith: null,
    requestCount: 0,
    now: () => 0,
    onClose: null,
  };
  return directoryHandle(name, entries, fake);
}

/**
 * A fake directory handle over a live entries object.
 *
 * Inputs
 *     name: the folder's name.
 *     entries: its live entries object.
 *     fake: the steering object shared by the whole fake disk.
 *
 * Outputs
 *     The fake directory handle.
 */
function directoryHandle(name, entries, fake) {
  const child = (childName, spec) =>
    isFakeFile(spec)
      ? fileHandle(childName, spec, fake)
      : directoryHandle(childName, spec, fake);
  return {
    kind: "directory",
    name,
    fake,
    async *values() {
      if (fake.failWith) throw fake.failWith;
      for (const [childName, spec] of Object.entries(entries)) {
        yield child(childName, spec);
      }
    },
    async getDirectoryHandle(childName, { create = false } = {}) {
      if (fake.failWith) throw fake.failWith;
      const spec = entries[childName];
      if (isFakeFile(spec)) throw domError("TypeMismatchError");
      if (!spec) {
        if (!create) throw domError("NotFoundError");
        entries[childName] = {};
      }
      return child(childName, entries[childName]);
    },
    async getFileHandle(childName, { create = false } = {}) {
      if (fake.failWith) throw fake.failWith;
      const spec = entries[childName];
      if (spec && !isFakeFile(spec)) throw domError("TypeMismatchError");
      if (!spec) {
        if (!create) throw domError("NotFoundError");
        entries[childName] = fakeFile();
      }
      return child(childName, entries[childName]);
    },
    async removeEntry(childName) {
      if (!(childName in entries)) throw domError("NotFoundError");
      delete entries[childName];
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
 * A fake file handle over a live file spec.
 *
 * Inputs
 *     name: the file's name.
 *     spec: its live `fakeFile(...)` spec.
 *     fake: the steering object shared by the whole fake disk.
 *
 * Outputs
 *     The fake file handle.
 */
function fileHandle(name, spec, fake) {
  return {
    kind: "file",
    name,
    async getFile() {
      return { name, size: spec.size, lastModified: spec.modified };
    },
    async createWritable() {
      return fakeWritable(name, spec, fake);
    },
  };
}

/**
 * A fake writable with swap-file semantics.
 *
 * Inputs
 *     name: the file's name.
 *     spec: its live `fakeFile(...)` spec, replaced on `close()`.
 *     fake: the steering object shared by the whole fake disk.
 *
 * Outputs
 *     The fake writable: `write`, `seek`, `truncate`, `close`, `abort`.
 */
function fakeWritable(name, spec, fake) {
  let swap = Buffer.alloc(0);
  let position = 0;
  let open = true;
  const ensureOpen = () => {
    if (!open) throw domError("TypeError", "writable is closed");
  };
  return {
    async write(chunk) {
      ensureOpen();
      if (fake.failWriteWith) throw fake.failWriteWith;
      const bytes = Buffer.from(chunk);
      const end = position + bytes.length;
      if (end > swap.length) {
        swap = Buffer.concat([swap, Buffer.alloc(end - swap.length)]);
      }
      bytes.copy(swap, position);
      position = end;
    },
    async seek(to) {
      ensureOpen();
      position = to;
    },
    async truncate(size) {
      ensureOpen();
      swap =
        size <= swap.length
          ? swap.subarray(0, size)
          : Buffer.concat([swap, Buffer.alloc(size - swap.length)]);
      position = Math.min(position, size);
    },
    async close() {
      ensureOpen();
      open = false;
      const bytes = fake.onClose ? fake.onClose(name, swap) : swap;
      spec.data = bytes;
      spec.size = bytes.length;
      spec.modified = fake.now();
    },
    async abort() {
      open = false;
    },
  };
}
