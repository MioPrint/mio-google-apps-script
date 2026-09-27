#!/usr/bin/env node

/**
 * In-memory fake of the Drive API the Disk Window fetches bytes from.
 *
 * Description
 *     Stands in for the Drive port (see docs/adr/0001-client-side-core.md):
 *     a `fetch` that serves `files/<id>?alt=media` with `Range` support and
 *     bearer-token checks, plus the token the server port hands out, so
 *     client-core tests run a whole Run in Node. Honours an aborted
 *     `init.signal`, so a test can simulate Pause/Stop interrupting an
 *     in-flight request from `onRequest`.
 */

const MEDIA_URL = /\/drive\/v3\/files\/([^/?]+)\?(.*)$/;
const EXPORT_URL = /\/drive\/v3\/files\/([^/?]+)\/export\?(.*)$/;
const LRO_START_URL = /\/drive\/v3\/files\/([^/?]+)\/download\?(.*)$/;
const OPERATION_URL = /\/drive\/v3\/operations\/([^/?]+)$/;
const DOWNLOAD_URI_HOST = "https://drive-download.example/";
const RANGE = /^bytes=(\d+)-(\d*)$/;

/**
 * A Drive-style JSON error response.
 *
 * Inputs
 *     status: the HTTP status.
 *     reason: the Drive error reason, e.g. "notFound".
 *     message: the error message, the reason by default.
 *     retryAfter: seconds for a Retry-After header, omitted when unset.
 *
 * Outputs
 *     The Response.
 */
function jsonResponse(status, reason, message = reason, retryAfter) {
  const headers = { "Content-Type": "application/json" };
  if (retryAfter != null) headers["Retry-After"] = String(retryAfter);
  return new Response(
    JSON.stringify({ error: { code: status, message, errors: [{ reason }] } }),
    { status, headers },
  );
}

/**
 * A plain JSON 200 response.
 *
 * Inputs
 *     body: the value to serialize.
 *
 * Outputs
 *     The Response.
 */
function okJson(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Builds a fake Drive.
 *
 * Description
 *     `drive.fetch(url, init)` answers media downloads for the files given,
 *     and (for a file registered with `drive.addNative`) a Native File's
 *     export/files.download-LRO/downloadUri byte path (ticket 12).
 *     Every request is recorded in `drive.requests` as `{ id, range,
 *     authorization, resourceKeys, kind }`, kind one of "media", "export",
 *     "lroStart", "lroPoll" or "lroFetch". Only tokens from
 *     `drive.issueToken()` are accepted, until `drive.expireTokens()`
 *     revokes them all (the next request with an old one gets a 401).
 *     `drive.failNext(id, outcome)` queues an outcome for that id's next
 *     request, of any kind: an Error to throw (a network failure) or
 *     `{ status, reason, retryAfter }` for an error response
 *     (`retryAfter`, in seconds, sets a Retry-After header). `drive.onRequest`
 *     is called before each request is answered (e.g. to move a fake clock
 *     on). `drive.holdNext()` makes the next request wait until the
 *     function it returns is called, so a test can inspect a Run genuinely
 *     in flight.
 *
 * Inputs
 *     files: `{ [id]: string | Uint8Array }`, each file's bytes.
 *
 * Outputs
 *     The fake Drive.
 */
export function createFakeDrive(files = {}) {
  const contents = new Map(
    Object.entries(files).map(([id, data]) => [id, Buffer.from(data)]),
  );
  const natives = new Map();
  const failures = new Map();
  const validTokens = new Set();
  let tokenCount = 0;
  let hold = null;
  const drive = {
    requests: [],
    onRequest: null,
    issueToken() {
      tokenCount += 1;
      const token = `token-${tokenCount}`;
      validTokens.add(token);
      return token;
    },
    expireTokens() {
      validTokens.clear();
    },
    failNext(id, outcome) {
      if (!failures.has(id)) failures.set(id, []);
      failures.get(id).push(outcome);
    },
    // Registers a Native File (ticket 12): files.export answers its bytes
    // straight away when underCap, else a 403 exportSizeLimitExceeded;
    // either way files.download's LRO answers them too, its operation
    // reporting done:false for pollsUntilDone polls (files.download's own
    // start call counts as the first) before done:true with a
    // downloadUri.
    addNative(id, { bytes, underCap = true, pollsUntilDone = 0 } = {}) {
      natives.set(id, {
        bytes: Buffer.from(bytes),
        underCap,
        pollsRemaining: pollsUntilDone,
      });
    },
    // Makes the next request wait until the returned function is called,
    // so a test can inspect a Run genuinely in flight (not yet paused,
    // failed or finished) before letting it carry on.
    holdNext() {
      let release;
      hold = new Promise((resolve) => {
        release = resolve;
      });
      return release;
    },
    async fetch(url, init = {}) {
      const headers = init.headers || {};
      const mediaMatch = MEDIA_URL.exec(url);
      const exportMatch = EXPORT_URL.exec(url);
      const lroStartMatch = LRO_START_URL.exec(url);
      const operationMatch = OPERATION_URL.exec(url);
      const isDownloadUri = url.startsWith(DOWNLOAD_URI_HOST);
      const kind = mediaMatch
        ? "media"
        : exportMatch
          ? "export"
          : lroStartMatch
            ? "lroStart"
            : operationMatch
              ? "lroPoll"
              : isDownloadUri
                ? "lroFetch"
                : null;
      const id =
        (mediaMatch && decodeURIComponent(mediaMatch[1])) ||
        (exportMatch && decodeURIComponent(exportMatch[1])) ||
        (lroStartMatch && decodeURIComponent(lroStartMatch[1])) ||
        (operationMatch && decodeURIComponent(operationMatch[1])) ||
        (isDownloadUri && url.slice(DOWNLOAD_URI_HOST.length)) ||
        null;
      drive.requests.push({
        id,
        kind,
        range: headers.Range || null,
        authorization: headers.Authorization || null,
        resourceKeys: headers["X-Goog-Drive-Resource-Keys"] || null,
      });
      if (drive.onRequest) drive.onRequest(id);
      if (hold) {
        const waiting = hold;
        hold = null;
        await waiting;
      }
      if (init.signal && init.signal.aborted) {
        throw Object.assign(new Error("The operation was aborted."), {
          name: "AbortError",
        });
      }
      const queued = failures.get(id);
      if (queued && queued.length) {
        const outcome = queued.shift();
        if (outcome instanceof Error) throw outcome;
        return jsonResponse(
          outcome.status,
          outcome.reason,
          outcome.reason,
          outcome.retryAfter,
        );
      }
      const token = (headers.Authorization || "").replace(/^Bearer /, "");
      if (!validTokens.has(token)) return jsonResponse(401, "authError");

      if (kind === "export") {
        const native = natives.get(id);
        if (!native) return jsonResponse(404, "notFound");
        if (native.underCap) return new Response(native.bytes, { status: 200 });
        return jsonResponse(403, "exportSizeLimitExceeded");
      }
      if (kind === "lroStart" || kind === "lroPoll") {
        const native = natives.get(id);
        if (!native) return jsonResponse(404, "notFound");
        if (native.pollsRemaining > 0) {
          native.pollsRemaining -= 1;
          return okJson({ name: id, done: false });
        }
        return okJson({
          name: id,
          done: true,
          response: { downloadUri: `${DOWNLOAD_URI_HOST}${id}` },
        });
      }
      if (kind === "lroFetch") {
        const native = natives.get(id);
        if (!native) return jsonResponse(404, "notFound");
        return new Response(native.bytes, { status: 200 });
      }

      if (!mediaMatch || !/(^|&)alt=media(&|$)/.test(mediaMatch[2]))
        return jsonResponse(400, "badRequest");
      const bytes = contents.get(id);
      if (!bytes) return jsonResponse(404, "notFound");
      if (!headers.Range) return new Response(bytes, { status: 200 });
      const range = RANGE.exec(headers.Range);
      const start = Number(range[1]);
      const end = range[2] === "" ? bytes.length - 1 : Number(range[2]);
      if (start >= bytes.length)
        return jsonResponse(416, "rangeNotSatisfiable");
      const last = Math.min(end, bytes.length - 1);
      return new Response(bytes.subarray(start, last + 1), {
        status: 206,
        headers: { "Content-Range": `bytes ${start}-${last}/${bytes.length}` },
      });
    },
  };
  return drive;
}
