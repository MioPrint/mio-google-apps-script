// @ts-check

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";
const GOOGLE_APPS_MIME_PREFIX = "application/vnd.google-apps.";
// The only Google Apps types Drive can export (Docs, Sheets, Slides -
// see ticket 12's Native File); every other Google Apps type (Forms,
// Sites, My Maps, Vids, Drawings...) is unsupported.
const NATIVE_FILE_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
]);
const SOURCE_META_FIELDS = "name,mimeType";
const SHORTCUT_TARGET_FIELDS = "name,mimeType,size";
const DRIVE_FILE_FIELDS =
  "id,name,mimeType,size,createdTime,capabilities/canDownload,resourceKey," +
  "shortcutDetails/targetId,shortcutDetails/targetMimeType,shortcutDetails/targetResourceKey";
const DRIVE_ORDER_BY = "folder,name_natural,createdTime";
const DRIVE_PAGE_SIZE = 1000;
const TREE_STEP_BUDGET_MS = 4.5 * 60 * 1000;

const FOLDER_URL_PATTERN = /\/folders\/([\w-]+)/;
const FILE_URL_PATTERN = /\/file\/d\/([\w-]+)/;
const OPEN_ID_PATTERN = /[?&]id=([\w-]+)/;
const RESOURCE_KEY_PATTERN = /[?&]resourcekey=([^&]+)/i;

/**
 * @typedef {Object} RawDriveFile
 * @property {string} id
 * @property {string} name
 * @property {string} mimeType
 * @property {string} [size]
 * @property {string} [createdTime]
 * @property {{canDownload?: boolean}} [capabilities]
 * @property {string} [resourceKey]
 * @property {{targetId?: string, targetMimeType?: string, targetResourceKey?: string}} [shortcutDetails]
 */

/**
 * @typedef {Object} ShortcutTarget
 * @property {string} id
 * @property {string|null} resourceKey
 * @property {string} name
 * @property {string} mimeType
 * @property {number|null} size
 */

/**
 * @typedef {Object} TreeItem
 * @property {string} id
 * @property {string|null} resourceKey
 * @property {string} parentId
 * @property {string} name
 * @property {string} mimeType
 * @property {number|null} size
 * @property {string} createdTime
 * @property {boolean} canDownload
 * @property {ShortcutTarget|null} [target] present only on a Shortcut Item.
 * @property {boolean} [loop] a Shortcut whose target is in its own ancestry.
 * @property {boolean} [unreachable] a Shortcut whose target 404s (or has none).
 * @property {boolean} [unsupported] a Google Apps type Drive can't export.
 */

/**
 * @typedef {Object} QueueEntry
 * @property {string} driveId the real Drive id to list children of.
 * @property {string} treeId the id children's parentId is built from -
 *   the Shortcut's own id when this folder is reached through one, else
 *   the same as driveId.
 * @property {string|null} resourceKey
 * @property {string[]} ancestry real Drive folder ids from the Source
 *   Folder down to and including driveId, for Shortcut loop detection.
 */

/**
 * @typedef {Object} PageCursor
 * @property {string} driveId
 * @property {string} treeId
 * @property {string|null} resourceKey
 * @property {string[]} ancestry
 * @property {string|null} pageToken
 */

/**
 * @typedef {Object} WalkState
 * @property {QueueEntry[]} queue
 * @property {PageCursor|null} current
 */

/**
 * @typedef {Object} Continuation
 * @property {QueueEntry[]} queue
 * @property {PageCursor|null} current
 * @property {TreeItem[]} pending
 */

/**
 * @typedef {"malformed"|"notFound"|"notAFolder"|"empty"} TreeReaderErrorKind
 */

/**
 * Casts the ambient Advanced Drive service global to non-optional: the
 * manifest enables it, so it is always present at runtime even though its
 * type is `Drive | undefined` (the service may not be enabled at all).
 * @returns {GoogleAppsScript.Drive}
 */
function driveService() {
  return /** @type {GoogleAppsScript.Drive} */ (Drive);
}

/**
 * Parses a Drive folder or file URL into an id and an optional resource
 * key. Folder vs. file is not decided here; a later `files.get` on the
 * mime type decides that.
 * @param {string} url
 * @returns {{id: string, resourceKey: string|null}|null} null when none of
 *   the accepted URL shapes match.
 */
function parseSourceUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  const idMatch =
    FOLDER_URL_PATTERN.exec(trimmed) ||
    FILE_URL_PATTERN.exec(trimmed) ||
    OPEN_ID_PATTERN.exec(trimmed);
  if (!idMatch) return null;
  const keyMatch = RESOURCE_KEY_PATTERN.exec(trimmed);
  return {
    id: idMatch[1],
    resourceKey: keyMatch ? decodeURIComponent(keyMatch[1]) : null,
  };
}

/**
 * @param {Record<string, string|number|boolean>} params
 * @returns {string}
 */
function toQueryString(params) {
  return Object.keys(params)
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`,
    )
    .join("&");
}

/**
 * Calls the Drive REST API directly, for requests that need the
 * `X-Goog-Drive-Resource-Keys` header (the Advanced Drive service takes no
 * custom headers).
 * @param {string} pathAndQuery e.g. `"files/<id>?fields=..."`.
 * @param {string} resourceKeyHeader e.g. `"<id>/<resourceKey>"`.
 * @returns {GoogleAppsScript.URL_Fetch.HTTPResponse}
 */
function driveRestFetch(pathAndQuery, resourceKeyHeader) {
  return UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/${pathAndQuery}`,
    {
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        "X-Goog-Drive-Resource-Keys": resourceKeyHeader,
      },
      muteHttpExceptions: true,
    },
  );
}

/**
 * Recognizes a 404 thrown by the Advanced Drive service, which has no
 * structured status code, only a message.
 * @param {unknown} error
 * @returns {boolean}
 */
function isNotFoundError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /not found/i.test(message) || /\b404\b/.test(message);
}

/**
 * Fetches an Item's metadata, via the Advanced Drive service or (when a
 * resource key is needed) the REST API directly.
 * @param {string} id
 * @param {string|null} resourceKey
 * @param {string} fields the Drive `fields` param, e.g. SOURCE_META_FIELDS.
 * @returns {Record<string, unknown>|null} null when Drive returns 404 (no
 *   access and a missing/wrong resource key look the same to callers).
 */
function getFileMeta(id, resourceKey, fields) {
  const params = { fields, supportsAllDrives: true };

  if (resourceKey) {
    const response = driveRestFetch(
      `files/${id}?${toQueryString(params)}`,
      `${id}/${resourceKey}`,
    );
    const code = response.getResponseCode();
    if (code === 404) return null;
    if (code !== 200) {
      throw new Error(
        `Drive files.get failed: ${code} ${response.getContentText()}`,
      );
    }
    return JSON.parse(response.getContentText());
  }
  try {
    return /** @type {Record<string, unknown>} */ (
      /** @type {unknown} */ (driveService().Files.get(id, params))
    );
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

/**
 * @typedef {Object} DrivePage
 * @property {RawDriveFile[]} files
 * @property {string|null} nextPageToken
 */

/**
 * Lists one page of a folder's direct children, folders first, then
 * natural name order, oldest first among equal names.
 * @param {string} folderId
 * @param {string|null} resourceKey
 * @param {string|null} pageToken
 * @returns {DrivePage}
 */
function listChildrenPage(folderId, resourceKey, pageToken) {
  /** @type {Record<string, string|number|boolean>} */
  const params = {
    q: `'${folderId}' in parents and trashed = false`,
    orderBy: DRIVE_ORDER_BY,
    pageSize: DRIVE_PAGE_SIZE,
    fields: `nextPageToken,files(${DRIVE_FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
  if (pageToken) params.pageToken = pageToken;

  if (resourceKey) {
    const response = driveRestFetch(
      `files?${toQueryString(params)}`,
      `${folderId}/${resourceKey}`,
    );
    if (response.getResponseCode() !== 200) {
      throw new Error(
        `Drive files.list failed: ${response.getResponseCode()} ${response.getContentText()}`,
      );
    }
    const body =
      /** @type {{files?: RawDriveFile[], nextPageToken?: string}} */ (
        JSON.parse(response.getContentText())
      );
    return {
      files: body.files || [],
      nextPageToken: body.nextPageToken || null,
    };
  }

  const page = driveService().Files.list(params);
  return {
    files: /** @type {RawDriveFile[]} */ (page.files || []),
    nextPageToken: page.nextPageToken || null,
  };
}

/**
 * A Google Apps type Drive can't export: Forms, Sites, My Maps, Vids,
 * Drawings and so on - anything with the Google Apps mime prefix other
 * than a folder, a Shortcut (both share the prefix but aren't Native
 * Files) or one of the three exportable types.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isUnsupportedGoogleType(mimeType) {
  return (
    mimeType.startsWith(GOOGLE_APPS_MIME_PREFIX) &&
    mimeType !== FOLDER_MIME_TYPE &&
    mimeType !== SHORTCUT_MIME_TYPE &&
    !NATIVE_FILE_MIME_TYPES.has(mimeType)
  );
}

/**
 * @param {RawDriveFile} file
 * @param {string} parentId
 * @returns {TreeItem}
 */
function buildItem(file, parentId) {
  /** @type {TreeItem} */
  const item = {
    id: file.id,
    resourceKey: file.resourceKey || null,
    parentId,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size != null ? Number(file.size) : null,
    createdTime: file.createdTime || "",
    canDownload: !file.capabilities || file.capabilities.canDownload !== false,
  };
  if (isUnsupportedGoogleType(file.mimeType)) item.unsupported = true;
  return item;
}

/**
 * Builds a Shortcut's Item: its own id/name/parentId, plus what it points
 * at, fetched with one files.get. A target Drive can't reach (404, or no
 * target at all) is flagged unreachable; a folder target already in this
 * walk's own ancestry is flagged loop instead - neither is queued to be
 * walked.
 * @param {RawDriveFile} file the Shortcut's own Drive file.
 * @param {string} treeParentId
 * @param {string|null} inheritedResourceKey the enclosing folder's resource
 *   key, for a target with none of its own.
 * @param {string[]} ancestry real Drive folder ids from the Source Folder
 *   down to this Shortcut's own parent folder.
 * @param {QueueEntry[]} queue mutated in place: a Shortcut to a reachable,
 *   non-looping folder is queued to be walked.
 * @returns {TreeItem}
 */
function buildShortcutItem(
  file,
  treeParentId,
  inheritedResourceKey,
  ancestry,
  queue,
) {
  /** @type {TreeItem} */
  const item = {
    id: file.id,
    resourceKey: file.resourceKey || null,
    parentId: treeParentId,
    name: file.name,
    mimeType: SHORTCUT_MIME_TYPE,
    size: null,
    createdTime: file.createdTime || "",
    canDownload: true,
    target: null,
  };
  const targetId = file.shortcutDetails && file.shortcutDetails.targetId;
  if (!targetId) {
    item.unreachable = true;
    return item;
  }
  const targetResourceKey =
    (file.shortcutDetails && file.shortcutDetails.targetResourceKey) || null;
  const resourceKeyForTarget = targetResourceKey || inheritedResourceKey;
  const meta = getFileMeta(
    targetId,
    resourceKeyForTarget,
    SHORTCUT_TARGET_FIELDS,
  );
  if (!meta) {
    item.unreachable = true;
    return item;
  }
  /** @type {ShortcutTarget} */
  const target = {
    id: targetId,
    resourceKey: resourceKeyForTarget,
    name: /** @type {string} */ (meta.name) || "",
    mimeType: /** @type {string} */ (meta.mimeType) || "",
    size: meta.size != null ? Number(meta.size) : null,
  };
  item.target = target;
  if (target.mimeType === FOLDER_MIME_TYPE) {
    if (ancestry.includes(targetId)) {
      item.loop = true;
    } else {
      queue.push({
        driveId: targetId,
        treeId: file.id,
        resourceKey: resourceKeyForTarget,
        ancestry: [...ancestry, targetId],
      });
    }
  }
  return item;
}

/**
 * Reads one page of the current (or next queued) folder, queuing any real
 * sub-folders it turns up and resolving any Shortcuts inline (see
 * buildShortcutItem). A sub-folder without its own resource key inherits
 * the one its parent was listed with.
 * @param {WalkState} state mutated in place.
 * @returns {TreeItem[]}
 */
function stepOnce(state) {
  if (!state.current) {
    const next = state.queue.shift();
    if (!next) return [];
    state.current = {
      driveId: next.driveId,
      treeId: next.treeId,
      resourceKey: next.resourceKey,
      ancestry: next.ancestry,
      pageToken: null,
    };
  }
  const {
    driveId,
    treeId,
    resourceKey: parentResourceKey,
    ancestry,
  } = state.current;
  const page = listChildrenPage(
    driveId,
    parentResourceKey,
    state.current.pageToken,
  );
  const items = [];
  for (const file of page.files) {
    if (file.mimeType === SHORTCUT_MIME_TYPE) {
      items.push(
        buildShortcutItem(
          file,
          treeId,
          parentResourceKey,
          ancestry,
          state.queue,
        ),
      );
      continue;
    }
    const item = buildItem(file, treeId);
    items.push(item);
    if (item.mimeType === FOLDER_MIME_TYPE) {
      state.queue.push({
        driveId: item.id,
        treeId: item.id,
        resourceKey: item.resourceKey || parentResourceKey,
        ancestry: [...ancestry, item.id],
      });
    }
  }
  state.current.pageToken = page.nextPageToken;
  if (!state.current.pageToken) state.current = null;
  return items;
}

/**
 * Reads pages until the tree is fully walked or the time budget runs out.
 * Always reads at least one page, so a budget of 0 still makes progress.
 * @param {WalkState} state mutated in place.
 * @param {number} deadline a `Date.now()` value to stop at.
 * @returns {TreeItem[]}
 */
function readBatch(state, deadline) {
  const items = [];
  do {
    items.push(...stepOnce(state));
  } while ((state.current || state.queue.length > 0) && Date.now() < deadline);
  return items;
}

/**
 * Starts reading a Source Folder's Tree: validates the URL and the folder,
 * then reads its first page of children so a wholly empty folder can be
 * reported without a second round trip.
 * @param {string} url
 * @returns {{error: TreeReaderErrorKind}|{folder: {id: string, name: string, resourceKey: string|null}, continuation: Continuation}}
 */
function treeReaderStart(url) {
  const parsed = parseSourceUrl(url);
  if (!parsed) return { error: "malformed" };

  const meta = getFileMeta(parsed.id, parsed.resourceKey, SOURCE_META_FIELDS);
  if (!meta) return { error: "notFound" };
  if (meta.mimeType !== FOLDER_MIME_TYPE) return { error: "notAFolder" };

  /** @type {WalkState} */
  const state = {
    queue: [
      {
        driveId: parsed.id,
        treeId: parsed.id,
        resourceKey: parsed.resourceKey,
        ancestry: [parsed.id],
      },
    ],
    current: null,
  };
  const pending = stepOnce(state);
  if (pending.length === 0 && !state.current && state.queue.length === 0) {
    return { error: "empty" };
  }

  return {
    folder: {
      id: parsed.id,
      name: /** @type {string} */ (meta.name) || "",
      resourceKey: parsed.resourceKey,
    },
    continuation: { queue: state.queue, current: state.current, pending },
  };
}

/**
 * Reads the next chunk of a Tree started by `treeReaderStart`, walking
 * folders breadth-first until the whole tree is read or the time budget
 * runs out. The Disk Window calls this again with the returned
 * continuation until it comes back null.
 * @param {Continuation} continuation
 * @param {number} [budgetMs] time budget for this call; defaults to about
 *   4.5 minutes so a call never nears GAS's 6-minute execution limit.
 *   Tests pass a small value to force an early cutoff.
 * @returns {{items: TreeItem[], continuation: Continuation|null}}
 */
function treeReaderStep(continuation, budgetMs) {
  /** @type {WalkState} */
  const state = { queue: continuation.queue, current: continuation.current };
  const deadline =
    Date.now() + (budgetMs == null ? TREE_STEP_BUDGET_MS : budgetMs);
  const items = continuation.pending.concat(readBatch(state, deadline));
  const done = !state.current && state.queue.length === 0;
  return {
    items,
    continuation: done
      ? null
      : { queue: state.queue, current: state.current, pending: [] },
  };
}
