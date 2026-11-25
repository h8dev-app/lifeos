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
