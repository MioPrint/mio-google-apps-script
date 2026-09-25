import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createDefaultMocks } from "./default-mocks.js";
import { repoRoot } from "./repo-root.js";

function resolveAppDir(appNameOrPath) {
  return path.isAbsolute(appNameOrPath)
    ? appNameOrPath
    : path.join(repoRoot, appNameOrPath);
}

function readClaspConfig(appDir) {
  const claspPath = path.join(appDir, ".clasp.json");
  if (!fs.existsSync(claspPath)) return {};
  return JSON.parse(fs.readFileSync(claspPath, "utf8"));
}

function collectJsFiles(srcDir) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".js")) results.push(full);
    }
  };
  walk(srcDir);
  return results;
}

// Listed files first, in list order; the rest after, in path order. Each
// entry (extension ignored) may be relative to srcDir or to appDir.
function orderFiles(files, srcDir, appDir, filePushOrder) {
  const withoutExt = (p) => p.replace(/\.[^./]+$/, "");
  const pushOrderPath = (from, file) =>
    withoutExt(path.relative(from, file).split(path.sep).join("/"));
  const listed = [];
  for (const entry of filePushOrder ?? []) {
    const wanted = withoutExt(entry);
    const match = files.find(
      (file) =>
        pushOrderPath(srcDir, file) === wanted ||
        pushOrderPath(appDir, file) === wanted,
    );
    if (!match) {
      throw new Error(
        `loadApp: filePushOrder entry "${entry}" matches no .js file under ${srcDir}`,
      );
    }
    if (!listed.includes(match)) listed.push(match);
  }
  const rest = files.filter((file) => !listed.includes(file)).sort();
  return [...listed, ...rest];
}

/**
 * Loads an App's source the way GAS runs it: every source file evaluated
 * into one shared vm context, so top-level functions, vars, consts, lets
 * and classes across files resolve as globals.
 * @param {string} appNameOrPath App folder name (resolved against the repo
 *   root) or an absolute path to an App folder.
 * @param {Record<string, unknown>} [mocks] Extra/override GAS service mocks;
 *   these win over the defaults.
 * @returns {Record<string, any>} proxy resolving property reads to globals
 *   in the App's vm context.
 * @throws {Error} if the source folder is missing or a `.clasp.json`
 *   `filePushOrder` entry matches no source `.js` file.
 */
export function loadApp(appNameOrPath, mocks = {}) {
  const appDir = resolveAppDir(appNameOrPath);
  const clasp = readClaspConfig(appDir);
  const srcDir = path.join(appDir, clasp.rootDir || "src");

  if (!fs.existsSync(srcDir)) {
    throw new Error(`loadApp: source folder not found at ${srcDir}`);
  }

  const files = orderFiles(
    collectJsFiles(srcDir),
    srcDir,
    appDir,
    clasp.filePushOrder,
  );
  const context = vm.createContext({
    console,
    ...createDefaultMocks(srcDir),
    ...mocks,
  });

  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        return vm.runInContext(
          `typeof ${prop} === "undefined" ? undefined : ${prop}`,
          context,
        );
      },
    },
  );
}
