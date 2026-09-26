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

const app = loadClientCore("drive_downloader", ["frontend/naming.js.html"]);

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
