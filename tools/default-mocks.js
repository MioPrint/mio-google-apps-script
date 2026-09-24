import fs from "node:fs";
import path from "node:path";

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
 */
export function createDefaultMocks(srcDir) {
  return {
    Logger: {
      log: (...args) => console.log(...args),
    },
    HtmlService: {
      createTemplateFromFile: (filename) => {
        const content = readHtmlFile(srcDir, filename);
        return {
          evaluate: () => createChainableOutput(content),
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
