import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  createContextProxy,
  readClaspConfig,
  resolveAppDir,
} from "./load-app.js";

// Matches the partial's first <script> block only; a partial with more
// than one is expected to hold just the one, per AGENTS.md's frontend
// convention (client JS lives in its own *.js.html partial).
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/i;

function readPartial(srcDir, partial) {
  const full = path.join(srcDir, partial);
  if (!fs.existsSync(full)) {
    throw new Error(
      `loadClientCore: client partial "${partial}" not found under ${srcDir}`,
    );
  }
  return { full, html: fs.readFileSync(full, "utf8") };
}

function extractScript(partial, html) {
  const match = SCRIPT_BLOCK.exec(html);
  if (!match) {
    throw new Error(
      `loadClientCore: client partial "${partial}" holds no <script> block`,
    );
  }
  return match[1];
}

/**
 * Loads an App's client script partials the way the browser runs them:
 * every listed `*.js.html` partial's `<script>` body evaluated into one
 * shared vm context, so top-level functions, vars, consts, lets and
 * classes across partials resolve as globals.
 * @param {string} appNameOrPath App folder name (resolved against the repo
 *   root) or an absolute path to an App folder.
 * @param {string[]} partials Client partial paths, in load order, relative
 *   to the App's source folder (e.g. `"frontend/core.js.html"`).
 * @param {Record<string, unknown>} [globals] Fakes/globals to seed into the
 *   context (Drive/disk/server ports, browser globals); these win over the
 *   helper's own `console` default.
 * @returns {Record<string, any>} proxy resolving property reads to globals
 *   in the partials' vm context.
 * @throws {Error} if a listed partial is missing or holds no `<script>`
 *   block.
 */
export function loadClientCore(appNameOrPath, partials, globals = {}) {
  const appDir = resolveAppDir(appNameOrPath);
  const clasp = readClaspConfig(appDir);
  const srcDir = path.join(appDir, clasp.rootDir || "src");

  // AbortController is a Web/Node global, not an ECMAScript one, so the
  // sandboxed vm context needs it spelled out like console does; a
  // partial that used fetch/Response directly (rather than through a
  // port) would need the same treatment.
  const context = vm.createContext({ console, AbortController, ...globals });

  for (const partial of partials) {
    const { full, html } = readPartial(srcDir, partial);
    const script = extractScript(partial, html);
    vm.runInContext(script, context, { filename: full });
  }

  return createContextProxy(context);
}
