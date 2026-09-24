import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./repo-root.js";

const TEMPLATE_DIR = path.join(repoRoot, "template");
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export class ScaffoldError extends Error {}

function toTitleCase(name) {
  return name
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function collectFiles(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else results.push(full);
    }
  };
  walk(dir);
  return results;
}

/**
 * Creates a new App folder from the template, substituting the App name.
 * @param {string} name snake_case App name.
 * @param {string} [destDir] parent directory to create the App folder in;
 *   defaults to the repo root.
 * @returns {string} absolute path to the created App folder.
 */
export function scaffoldApp(name, destDir = repoRoot) {
  if (!SNAKE_CASE_RE.test(name)) {
    throw new ScaffoldError(
      `App name must be snake_case (lowercase letters, digits, underscores, no leading/trailing/double underscore): "${name}"`,
    );
  }

  const target = path.join(destDir, name);
  if (fs.existsSync(target)) {
    throw new ScaffoldError(`Target already exists: ${target}`);
  }

  fs.cpSync(TEMPLATE_DIR, target, { recursive: true });

  const title = toTitleCase(name);
  for (const file of collectFiles(target)) {
    const content = fs.readFileSync(file, "utf8");
    const substituted = content
      .replaceAll("%%APP_NAME%%", name)
      .replaceAll("%%APP_TITLE%%", title);
    if (substituted !== content) fs.writeFileSync(file, substituted);
  }

  return target;
}

function printNextSteps(name, target) {
  console.log(`Created App '${name}' at ${target}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${path.relative(process.cwd(), target) || "."}`);
  console.log("  clasp create --type webapp --rootDir src");
  console.log(
    "  Then check that src/appsscript.json wasn't overwritten by the create step.",
  );
}

function parseArgs(argv) {
  const [name, ...rest] = argv;
  let dest;
  const unrecognized = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--dest") dest = rest[++i];
    else unrecognized.push(rest[i]);
  }
  return { name, dest, unrecognized };
}

const USAGE = "Usage: npm run new-app -- <name> [--dest <dir>]";

function main() {
  const { name, dest, unrecognized } = parseArgs(process.argv.slice(2));
  if (!name) {
    console.error(USAGE);
    process.exit(1);
  }
  if (unrecognized.length > 0) {
    console.error(
      `new-app: unrecognized argument(s): ${unrecognized.join(" ")}`,
    );
    console.error(
      "new-app: npm swallows flags without a '--' separator; did you mean:",
    );
    console.error(`new-app:   npm run new-app -- ${name} --dest <dir>`);
    process.exit(1);
  }

  try {
    const target = scaffoldApp(name, dest ? path.resolve(dest) : repoRoot);
    printNextSteps(name, target);
  } catch (err) {
    if (err instanceof ScaffoldError) {
      console.error(`new-app: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
