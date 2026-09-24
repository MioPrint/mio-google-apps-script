import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { repoRoot } from "./repo-root.js";

const require = createRequire(import.meta.url);
const SKIP_DIRS = new Set(["node_modules", "tools", "docs"]);

function findAppSourceDir(appDir) {
  for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (fs.existsSync(path.join(appDir, entry.name, "appsscript.json"))) {
      return path.join(appDir, entry.name);
    }
  }
  return null;
}

function findApps(root) {
  const apps = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const appDir = path.join(root, entry.name);
    if (findAppSourceDir(appDir)) apps.push({ name: entry.name, appDir });
  }
  return apps;
}

const apps = findApps(repoRoot);
if (apps.length === 0) {
  console.error("typecheck: no Apps found (looked for a folder whose source folder holds appsscript.json)");
  process.exit(1);
}

const tscBin = require.resolve("typescript/bin/tsc");
let failed = false;

for (const app of apps) {
  const tsconfigPath = path.join(app.appDir, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    console.error(`typecheck: ${app.name} has no tsconfig.json`);
    failed = true;
    continue;
  }
  console.log(`\ntypecheck: ${app.name}`);
  try {
    execFileSync(process.execPath, [tscBin, "--noEmit", "-p", tsconfigPath], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } catch {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
