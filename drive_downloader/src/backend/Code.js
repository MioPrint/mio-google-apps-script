// @ts-check

/**
 * Serves the app's index page.
 *
 * Requires every manifest scope up front (see ticket 15/README "Authorize
 * the App once"): a surface that supports granular consent (the Apps
 * Script editor's Run button) renders the authorization prompt here
 * instead of failing later on the first Read Drive. A deployed web app
 * running as its owner doesn't support that prompt, so this is a no-op
 * there once the one-time editor authorization has been done.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
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
