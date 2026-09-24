#!/usr/bin/env node

/**
 * ESLint flat config for the repo.
 *
 * Description
 *     Three scopes: App source (each App's src folder) runs as GAS scripts,
 *     with `no-undef` off (tsc covers it, as long as the file stays inside
 *     that App's tsconfig `include`) and `no-unused-vars` limited to local
 *     scope so GAS entry points and cross-file globals aren't flagged.
 *     Frontend HTML lints inline scripts as browser scripts via
 *     eslint-plugin-html, with default (non-local) `no-unused-vars`, since
 *     there's no tsc backstop for it. Everything else (tooling, tests, root
 *     config files) lints as Node ESM.
 *     eslint-config-prettier is listed last so it always wins over any
 *     stylistic rule a scope above adds later.
 */

import js from "@eslint/js";
import html from "eslint-plugin-html";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  {
    files: ["*/src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: "latest",
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
  {
    files: ["*/src/**/*.html"],
    plugins: { html },
    languageOptions: {
      sourceType: "script",
      ecmaVersion: "latest",
      globals: { ...globals.browser, google: "readonly" },
    },
  },
  {
    files: ["*.js", "tools/**/*.js", "*/test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: { ...globals.node },
    },
  },
  prettier,
];
