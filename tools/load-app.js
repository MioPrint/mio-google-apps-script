import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createDefaultMocks } from "./default-mocks.js";
import { repoRoot } from "./repo-root.js";

function resolveAppDir(appNameOrPath) {
  return path.isAbsolute(appNameOrPath) ? appNameOrPath : path.join(repoRoot, appNameOrPath);
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

function orderFiles(files, srcDir, filePushOrder) {
  if (!filePushOrder || filePushOrder.length === 0) {
    return [...files].sort();
  }
  const withoutExt = (p) => p.replace(/\.[^./]+$/, "");
  const orderIndex = new Map(filePushOrder.map((entry, i) => [withoutExt(entry), i]));
  return [...files].sort((a, b) => {
    const relA = withoutExt(path.relative(srcDir, a));
    const relB = withoutExt(path.relative(srcDir, b));
    const indexA = orderIndex.has(relA) ? orderIndex.get(relA) : Infinity;
    const indexB = orderIndex.has(relB) ? orderIndex.get(relB) : Infinity;
    if (indexA !== indexB) return indexA - indexB;
    return relA.localeCompare(relB);
  });
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
 */
export function loadApp(appNameOrPath, mocks = {}) {
  const appDir = resolveAppDir(appNameOrPath);
  const clasp = readClaspConfig(appDir);
  const srcDir = path.join(appDir, clasp.rootDir || "src");

  if (!fs.existsSync(srcDir)) {
    throw new Error(`loadApp: source folder not found at ${srcDir}`);
  }

  const files = orderFiles(collectJsFiles(srcDir), srcDir, clasp.filePushOrder);
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
        return vm.runInContext(`typeof ${prop} === "undefined" ? undefined : ${prop}`, context);
      },
    },
  );
}
