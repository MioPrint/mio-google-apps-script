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

/**
 * Renders the Disk Window document and returns it as a JSON string safe to
 * inline into the Launcher Page, for `document.write`-ing into the popup.
 * @return {string}
 */
function diskHtmlJson() {
  const html = HtmlService.createTemplateFromFile("frontend/disk")
    .evaluate()
    .getContent();
  return JSON.stringify(html).replace(/</g, "\\u003c");
}

/**
 * Hands the browser an OAuth token carrying the manifest scopes, for the
 * Disk Window to call the Drive API directly.
 * @return {string}
 */
function getToken() {
  return ScriptApp.getOAuthToken();
}
