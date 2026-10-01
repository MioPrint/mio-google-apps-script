import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
// Prettier wraps the markup freely; compare with whitespace collapsed.
const html = fs
  .readFileSync(path.join(dir, "../src/frontend/disk.html"), "utf8")
  .replace(/\s+/g, " ")
  .replace(/\s+>/g, ">")
  .replace(/> </g, "><");

describe("Disk Window markup: control tooltips", () => {
  it("wraps every setup, Run and Expand/Collapse button in a 2 s tooltip target", () => {
    const ids = [
      "read-drive",
      "choose-location",
      "refresh-target",
      "download",
      "pause",
      "resume",
      "stop",
      "expand-all",
      "collapse-all",
    ];
    for (const id of ids) {
      const wrapped = new RegExp(
        `<span class="tip-target" data-tip="[^"]+" data-tip-delay="2000"><button id="${id}"`,
      );
      expect(html, id).toMatch(wrapped);
    }
  });

  it("wraps every option checkbox and its text in a 2 s tooltip target, no <label>", () => {
    expect(html).not.toMatch(/<label/);
    const ids = [
      "skip-existing",
      "replace-spaces",
      "use-shortcut-target-names",
      "keep-awake",
    ];
    for (const id of ids) {
      const wrapped = new RegExp(
        `<span class="tip-target" data-tip="[^"]+" data-tip-delay="2000"><input type="checkbox" id="${id}"[^>]*/> [^<]+</span>`,
      );
      expect(html, id).toMatch(wrapped);
    }
  });
});
