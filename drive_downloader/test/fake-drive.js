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
 * Builds a fake Drive.
 *
 * Description
 *     `drive.fetch(url, init)` answers media downloads for the files given,
 *     recording each request in `drive.requests` as `{ id, range,
 *     authorization, resourceKeys }`. Only tokens from `drive.issueToken()`
 *     are accepted, until `drive.expireTokens()` revokes them all (the
 *     next request with an old one gets a 401). `drive.failNext(id,
 *     outcome)` queues an outcome for that file's next request: an Error
 *     to throw (a network failure) or `{ status, reason, retryAfter }`
 *     for an error response (`retryAfter`, in seconds, sets a
 *     Retry-After header). `drive.onRequest` is called before each request is
 *     answered (e.g. to move a fake clock on). `drive.holdNext()` makes
 *     the next request wait until the function it returns is called, so
 *     a test can inspect a Run genuinely in flight.
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
      const match = MEDIA_URL.exec(url);
      const id = match && decodeURIComponent(match[1]);
      drive.requests.push({
        id,
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
      if (!match || !/(^|&)alt=media(&|$)/.test(match[2]))
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
