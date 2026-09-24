// @ts-check

/**
 * Serves the app's index page.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  return HtmlService.createTemplateFromFile("frontend/index").evaluate();
}

/**
 * Returns the rendered content of an HTML file, for use from templates.
 * @param {string} filename
 * @return {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
