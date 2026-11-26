import { describe, expect, it } from "vitest";
import { buildFtsQuery, contentHash, fileNameFor, titleFromContent } from "./markdown";

describe("titleFromContent", () => {
  it("uses the first heading", () => expect(titleFromContent("intro\n# Réunion BTS\ntexte")).toBe("Réunion BTS"));
  it("falls back to the first line", () => expect(titleFromContent("\n  idée de projet \nsuite")).toBe("idée de projet"));
  it("empty note", () => expect(titleFromContent("  \n")).toBe("Sans titre"));
});

describe("fileNameFor", () => {
  it("slug + unique suffix", () => {
    expect(fileNameFor("Réunion BTS", new Set())).toBe("reunion-bts.md");
    expect(fileNameFor("Réunion BTS", new Set(["reunion-bts.md", "reunion-bts-2.md"]))).toBe("reunion-bts-3.md");
    expect(fileNameFor("!!!", new Set())).toBe("note.md");
  });
});

describe("buildFtsQuery", () => {
  it("quoted prefixes", () => expect(buildFtsQuery(' rev  "bts" ')).toBe('"rev"* "bts"*'));
  it("neutralises FTS operators", () => expect(buildFtsQuery("a OR b*")).toBe('"a"* "OR"* "b*"*'));
  it("empty", () => expect(buildFtsQuery("  ")).toBe(""));
});

describe("contentHash", () => {
  it("is stable and sensitive", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
    expect(contentHash("")).toHaveLength(8);
  });
});

import { excerptFromContent, isReviewFile, notePath, parseNoteArgs, sanitizeFolderName, splitNotePath } from "./markdown";

describe("note categories", () => {
  it("sanitizeFolderName keeps accents, removes forbidden chars", () => {
    expect(sanitizeFolderName("  Économie  ")).toBe("Économie");
    expect(sanitizeFolderName("a/b:c*d")).toBe("a b c d");
    expect(sanitizeFolderName(".trash")).toBe("trash");
    expect(sanitizeFolderName("...")).toBe("");
    expect(sanitizeFolderName("x".repeat(60))).toHaveLength(40);
  });
  it("paths", () => {
    expect(splitNotePath("notes/Cours/maths.md")).toEqual({ folder: "Cours", file: "maths.md" });
    expect(splitNotePath("notes/idee.md")).toEqual({ folder: "", file: "idee.md" });
    expect(notePath("Cours", "a.md")).toBe("notes/Cours/a.md");
    expect(notePath("", "a.md")).toBe("notes/a.md");
  });
  it("review files", () => {
    expect(isReviewFile("bilan-2026-s48.md")).toBe(true);
    expect(isReviewFile("bilan-perso.md")).toBe(false);
  });
  it("parseNoteArgs", () => {
    expect(parseNoteArgs("Réunion BTS #Cours")).toEqual({ title: "Réunion BTS", folder: "Cours" });
    expect(parseNoteArgs("#Projets_perso Idée app")).toEqual({ title: "Idée app", folder: "Projets perso" });
    expect(parseNoteArgs("Simple")).toEqual({ title: "Simple", folder: "" });
  });
  it("excerpt", () => {
    const md = "# Titre\n\nPremier **point** et [lien](https://x.y).\n\n- [ ] tâche\n- élément\n> citation";
    expect(excerptFromContent(md)).toBe("Premier point et lien. tâche élément citation");
    expect(excerptFromContent("# Seul titre\n")).toBe("");
    expect(excerptFromContent("a ".repeat(200), 20)).toHaveLength(20);
  });
});
