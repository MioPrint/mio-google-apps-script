import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// Matches only GAS's two printing scriptlets: `<?!= expr ?>` (unescaped)
// and `<?= expr ?>` (HTML-escaped). Code scriptlets (`<? ... ?>`, no `=`)
// aren't supported; no App in this repo uses them.
const PRINTING_SCRIPTLET = /<\?(!?)=([\s\S]*?)\?>/g;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Evaluates a template's printing scriptlets against the App's vm context,
// the way HtmlTemplate#evaluate runs them against the script's globals.
function evaluateTemplate(content, context, filename) {
  return content.replace(PRINTING_SCRIPTLET, (_match, bang, expr) => {
    const value = vm.runInContext(expr, context, { filename });
    return bang ? String(value) : escapeHtml(value);
  });
}

const CHAINABLE_OUTPUT_METHODS = [
  "setTitle",
  "setFaviconUrl",
  "setXFrameOptionsMode",
  "setSandboxMode",
  "setWidth",
  "setHeight",
  "addMetaTag",
  "append",
  "appendUntrusted",
];

function resolveHtmlFile(srcDir, filename) {
  const withExt = filename.endsWith(".html") ? filename : `${filename}.html`;
  return path.join(srcDir, withExt);
}

function readHtmlFile(srcDir, filename) {
  return fs.readFileSync(resolveHtmlFile(srcDir, filename), "utf8");
}

function createChainableOutput(content) {
  const output = { getContent: () => content };
  for (const method of CHAINABLE_OUTPUT_METHODS) {
    output[method] = (...args) => {
      output[`__${method}Args`] = args;
      return output;
    };
  }
  return output;
}

/**
 * Builds the default GAS service mocks used by loadApp: HtmlService
 * (template/output creation from file, with chainable setters) and Logger.
 * @param {string} srcDir absolute path to the App's source folder, used to
 *   resolve HtmlService file lookups the way GAS resolves them.
 * @param {import("node:vm").Context} context the App's vm context, so a
 *   template's printing scriptlets can call the App's own globals.
 */
export function createDefaultMocks(srcDir, context) {
  return {
    Logger: {
      log: (...args) => console.log(...args),
    },
    HtmlService: {
      createTemplateFromFile: (filename) => {
        const content = readHtmlFile(srcDir, filename);
        return {
          evaluate: () =>
            createChainableOutput(
              evaluateTemplate(
                content,
                context,
                resolveHtmlFile(srcDir, filename),
              ),
            ),
        };
      },
      createHtmlOutputFromFile: (filename) => {
        const content = readHtmlFile(srcDir, filename);
        return createChainableOutput(content);
      },
      XFrameOptionsMode: { ALLOWALL: "ALLOWALL", DEFAULT: "DEFAULT" },
      SandboxMode: { IFRAME: "IFRAME", EMULATED: "EMULATED", NATIVE: "NATIVE" },
    },
  };
}
