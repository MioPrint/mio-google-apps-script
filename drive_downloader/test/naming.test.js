#!/usr/bin/env node

/**
 * Tests for Naming: Drive name -> Local Name.
 *
 * Description
 *     Runs the naming client partial through loadClientCore against
 *     hand-built Tree nodes, asserting illegal-character and space
 *     substitution and the numbering of duplicate Local Names among
 *     siblings.
 */

import { describe, expect, it } from "vitest";
import { loadClientCore } from "../../tools/load-client-core.js";

const app = loadClientCore("drive_downloader", [
  "frontend/tree.js.html",
  "frontend/tips.js.html",
  "frontend/naming.js.html",
]);

/**
 * A Drive file node, as computeLocalNames expects it.
 *
 * Inputs
 *     id: its id.
 *     name: its Drive name.
 *
 * Outputs
 *     The node.
 */
function file(id, name) {
  return { id, name };
}

/**
 * A Drive folder node.
 *
 * Inputs
 *     id: its id.
 *     name: its Drive name.
 *     children: its child nodes, in sibling order.
 *
 * Outputs
 *     The node.
 */
function folder(id, name, children) {
  return { id, name, children };
}

/**
 * A Shortcut-to-file node, as buildTree's nodeFromItem would produce it.
 *
 * Inputs
 *     id: its id.
 *     ownName: the Shortcut's own name.
 *     targetName: the target file's name.
 *
 * Outputs
 *     The node.
 */
function shortcutFile(id, ownName, targetName) {
  return { id, name: targetName, ownName, isShortcut: true };
}

/**
 * A Shortcut-to-folder node.
 *
 * Inputs
 *     id: its id.
 *     ownName: the Shortcut's own name.
 *     targetName: the target folder's name.
 *     children: its child nodes, in sibling order.
 *
 * Outputs
 *     The node.
 */
function shortcutFolder(id, ownName, targetName, children) {
  return { id, name: targetName, ownName, isShortcut: true, children };
}

describe("drive_downloader Naming", () => {
  it("replaces illegal characters with +", () => {
    const tree = folder("root", "Root", [file("a", 'a:b"c?d<e>f|g*h.txt')]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a")).toBe("a+b+c+d+e+f+g+h.txt");
  });

  it("replaces spaces with _ only when the option is on", () => {
    const tree = folder("root", "Root", [file("a", "my file name.txt")]);

    expect(app.computeLocalNames(tree, false).get("a")).toBe(
      "my file name.txt",
    );
    expect(app.computeLocalNames(tree, true).get("a")).toBe("my_file_name.txt");
  });

  it("gives the root its own Local Name; it has no siblings to number against", () => {
    const tree = folder("root", "Trip: 2026", []);

    expect(app.computeLocalNames(tree, false).get("root")).toBe("Trip+ 2026");
  });

  it("a name used once stays plain", () => {
    const tree = folder("root", "Root", [file("a", "solo.txt")]);

    expect(app.computeLocalNames(tree, false).get("a")).toBe("solo.txt");
  });

  it("numbers duplicates from (1) in sibling order, before the last extension", () => {
    const tree = folder("root", "Root", [
      file("a", "report.pdf"),
      file("b", "report.pdf"),
      file("c", "report.pdf"),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a")).toBe("report.pdf");
    expect(names.get("b")).toBe("report (1).pdf");
    expect(names.get("c")).toBe("report (2).pdf");
  });

  it("groups case-only duplicates together, each keeping its own case", () => {
    const tree = folder("root", "Root", [
      file("a", "Report.PDF"),
      file("b", "report.pdf"),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a")).toBe("Report.PDF");
    expect(names.get("b")).toBe("report (1).pdf");
  });

  it("numbers duplicates among files and folders together", () => {
    const tree = folder("root", "Root", [
      folder("a", "Notes", []),
      file("b", "Notes"),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a")).toBe("Notes");
    expect(names.get("b")).toBe("Notes (1)");
  });

  it("puts the number at the end for a folder, before the last extension for a file", () => {
    const tree = folder("root", "Root", [
      file("a", "archive.tar.gz"),
      file("b", "archive.tar.gz"),
      folder("c", "Docs", []),
      folder("d", "Docs", []),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("b")).toBe("archive.tar (1).gz");
    expect(names.get("d")).toBe("Docs (1)");
  });

  it("treats a dotfile, and a name with no extension, as having no extension to split", () => {
    const tree = folder("root", "Root", [
      file("a", ".bashrc"),
      file("b", ".bashrc"),
      file("c", "README"),
      file("d", "README"),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("b")).toBe(".bashrc (1)");
    expect(names.get("d")).toBe("README (1)");
  });

  it("skips a number a real sibling already has", () => {
    const tree = folder("root", "Root", [
      file("a", "report.pdf"),
      file("b", "report.pdf"),
      file("c", "report.pdf"),
      file("d", "Report (1).pdf"),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a")).toBe("report.pdf");
    expect(names.get("d")).toBe("Report (1).pdf");
    expect(names.get("b")).toBe("report (2).pdf");
    expect(names.get("c")).toBe("report (3).pdf");
  });

  describe("trimming", () => {
    it("drops leading and trailing spaces, option on or off", () => {
      const tree = folder("root", "Root", [
        file("a", "  My file "),
        file("b", "  My file.txt "),
      ]);

      const off = app.computeLocalNames(tree, false);
      expect(off.get("a")).toBe("My file");
      expect(off.get("b")).toBe("My file.txt");

      const on = app.computeLocalNames(tree, true);
      expect(on.get("a")).toBe("My_file");
      expect(on.get("b")).toBe("My_file.txt");
    });

    it("keeps inner spaces, and spaces before an extension, following the option", () => {
      const tree = folder("root", "Root", [file("a", "my file .txt")]);

      expect(app.computeLocalNames(tree, false).get("a")).toBe("my file .txt");
      expect(app.computeLocalNames(tree, true).get("a")).toBe("my_file_.txt");
    });

    it("trims the root too", () => {
      const tree = folder("root", " Trip 2026 ", []);

      expect(app.computeLocalNames(tree, false).get("root")).toBe("Trip 2026");
      expect(app.computeLocalNames(tree, true).get("root")).toBe("Trip_2026");
    });

    it("turns a spaces-only name into +", () => {
      const tree = folder("root", "   ", [file("a", "   ")]);

      for (const replaceSpaces of [false, true]) {
        const names = app.computeLocalNames(tree, replaceSpaces);
        expect(names.get("a")).toBe("+");
        expect(names.get("root")).toBe("+");
      }
    });

    it("trims before the Office extension is appended", () => {
      const tree = folder("root", "Root", [
        {
          id: "a",
          name: " Budget ",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
      ]);

      expect(app.computeLocalNames(tree, false).get("a")).toBe("Budget.xlsx");
    });

    it("numbers names that differ only by leading or trailing spaces", () => {
      const tree = folder("root", "Root", [
        file("a", "notes.txt"),
        file("b", "notes.txt "),
        file("c", " notes.txt"),
      ]);

      const names = app.computeLocalNames(tree, false);

      expect(names.get("a")).toBe("notes.txt");
      expect(names.get("b")).toBe("notes (1).txt");
      expect(names.get("c")).toBe("notes (2).txt");
    });
  });

  describe("Shortcuts", () => {
    it("uses the Shortcut's own name by default, the target's when the option is on", () => {
      const tree = folder("root", "Root", [
        shortcutFile("s", "My Link.txt", "target.txt"),
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "My Link.txt",
      );
      expect(app.computeLocalNames(tree, false, true).get("s")).toBe(
        "target.txt",
      );
    });

    it("appends the target's extension when the chosen name lacks it", () => {
      const tree = folder("root", "Root", [
        shortcutFile("s", "Holiday video", "clip.mp4"),
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "Holiday video.mp4",
      );
      expect(app.computeLocalNames(tree, false, true).get("s")).toBe(
        "clip.mp4",
      );
    });

    it("doesn't duplicate the extension when the chosen name already ends with it, case-insensitively", () => {
      const tree = folder("root", "Root", [
        shortcutFile("s", "clip.MP4", "clip.mp4"),
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "clip.MP4",
      );
    });

    it("appends no extension for a Shortcut to a folder", () => {
      const tree = folder("root", "Root", [
        shortcutFolder("s", "My Link", "Real Folder", []),
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "My Link",
      );
      expect(app.computeLocalNames(tree, false, true).get("s")).toBe(
        "Real Folder",
      );
    });

    it("treats a loop Shortcut as a folder: no bogus extension from a dot in the target name, numbered at the end", () => {
      const tree = folder("root", "Root", [
        folder("f", "Backup v1.2", []),
        { ...shortcutFile("s", "Loop link", "Backup v1.2"), loop: true },
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "Loop link",
      );
      expect(app.computeLocalNames(tree, false, true).get("s")).toBe(
        "Backup v1.2 (1)",
      );
    });

    it("numbers a Shortcut against its siblings by whichever name is currently chosen", () => {
      const tree = folder("root", "Root", [
        file("a", "clip.mp4"),
        shortcutFile("s", "Some Link.mp4", "clip.mp4"),
      ]);

      expect(app.computeLocalNames(tree, false, false).get("s")).toBe(
        "Some Link.mp4",
      );
      expect(app.computeLocalNames(tree, false, true).get("s")).toBe(
        "clip (1).mp4",
      );
    });
  });

  describe("Native Files", () => {
    it("appends the Office extension for a Doc, Sheet or Slide", () => {
      const tree = folder("root", "Root", [
        {
          ...file("d", "Report"),
          mimeType: "application/vnd.google-apps.document",
        },
        {
          ...file("s", "Budget"),
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
        {
          ...file("p", "Deck"),
          mimeType: "application/vnd.google-apps.presentation",
        },
      ]);

      const names = app.computeLocalNames(tree, false);

      expect(names.get("d")).toBe("Report.docx");
      expect(names.get("s")).toBe("Budget.xlsx");
      expect(names.get("p")).toBe("Deck.pptx");
    });

    it("doesn't duplicate the extension when the name already ends with it, case-insensitively", () => {
      const tree = folder("root", "Root", [
        {
          ...file("s", "Budget.XLSX"),
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
      ]);

      expect(app.computeLocalNames(tree, false).get("s")).toBe("Budget.XLSX");
    });

    it("numbers duplicate Native Files after the extension is appended", () => {
      const tree = folder("root", "Root", [
        {
          ...file("a", "Report"),
          mimeType: "application/vnd.google-apps.document",
        },
        {
          ...file("b", "Report"),
          mimeType: "application/vnd.google-apps.document",
        },
      ]);

      const names = app.computeLocalNames(tree, false);

      expect(names.get("a")).toBe("Report.docx");
      expect(names.get("b")).toBe("Report (1).docx");
    });

    it("leaves a non-Native File's name untouched", () => {
      const tree = folder("root", "Root", [file("a", "notes.txt")]);

      expect(app.computeLocalNames(tree, false).get("a")).toBe("notes.txt");
    });
  });

  it("numbers each folder's children only among themselves", () => {
    const tree = folder("root", "Root", [
      folder("x", "Alpha", [file("a1", "same.txt"), file("a2", "same.txt")]),
      folder("y", "Beta", [file("b1", "same.txt"), file("b2", "same.txt")]),
    ]);

    const names = app.computeLocalNames(tree, false);

    expect(names.get("a1")).toBe("same.txt");
    expect(names.get("a2")).toBe("same (1).txt");
    expect(names.get("b1")).toBe("same.txt");
    expect(names.get("b2")).toBe("same (1).txt");
  });
});
