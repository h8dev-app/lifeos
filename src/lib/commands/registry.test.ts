import { describe, expect, it } from "vitest";
import type { Category } from "../types";
import {
  allCommands, applyToken, BUILTIN_COMMANDS, categoryCommand, findCommand, inputContext, matchCommands, tokenSuggestions,
} from "./registry";

const sport: Category = {
  id: "s", slug: "sport", name: "Sport", icon: "🏃", color: null, isSystem: false,
  schema: { fields: [
    { key: "activity", label: "Activité", type: "text", take: "rest" },
    { key: "distance_km", label: "Distance", type: "distance" },
    { key: "duration_min", label: "Durée", type: "duration" },
  ] },
};
const lecture: Category = {
  id: "l", slug: "lecture", name: "Lecture", icon: "📖", color: null, isSystem: false,
  schema: { fields: [{ key: "pages", label: "Pages", type: "number", unit: "pages" }] },
};
const code: Category = { ...sport, id: "c", slug: "code", isSystem: true };
const cmds = allCommands([sport, lecture, code]);

describe("registry", () => {
  it("category commands from fields, system categories hidden", () => {
    expect(categoryCommand(sport).syntax).toBe("/sport [activité] [distance] [durée] [note]");
    expect(categoryCommand(sport).examples).toEqual(["/sport course 5km 28min"]);
    expect(categoryCommand(lecture).examples).toEqual(["/lecture 3pages"]);
    expect(cmds.some((c) => c.name === "code")).toBe(false);
    expect(cmds.length).toBe(BUILTIN_COMMANDS.length + 2);
  });
  it("matching: prefix first, accents ignored, aliases", () => {
    expect(matchCommands("t", cmds)[0].name).toBe("tache");
    expect(matchCommands("tâ", cmds)[0].name).toBe("tache");
    expect(matchCommands("aide", cmds)[0].name).toBe("help");
    expect(matchCommands("r", cmds).map((c) => c.name)).toEqual(["rdv", "sport", "lecture"]);
    expect(matchCommands("agenda", cmds).map((c) => c.name)).toEqual(["rdv"]);
    expect(matchCommands("", cmds)).toHaveLength(cmds.length);
    expect(findCommand("Tâche", cmds)?.name).toBe("tache");
    expect(findCommand("aide", cmds)?.name).toBe("help");
  });
  it("input context", () => {
    expect(inputContext("bonjour")).toEqual({ kind: "none" });
    expect(inputContext("/ta")).toEqual({ kind: "command", query: "ta" });
    expect(inputContext("/")).toEqual({ kind: "command", query: "" });
    expect(inputContext("/tache réviser #Co")).toEqual({ kind: "params", command: "tache", token: "#Co", tokenStart: 15 });
    expect(inputContext("/tache ")).toEqual({ kind: "params", command: "tache", token: "", tokenStart: 7 });
  });
  it("applyToken replaces the current word", () => {
    expect(applyToken("/tache réviser #Co", 15, "#Cours")).toBe("/tache réviser #Cours ");
  });
  it("token suggestions", () => {
    const data = { taskCategories: ["Cours", "Projet BTS"], noteFolders: ["Bilans", "Cours"] };
    const tache = findCommand("tache", cmds);
    expect(tokenSuggestions(tache, "#p", data).map((s) => s.insert)).toEqual(["#Projet_BTS"]);
    expect(tokenSuggestions(tache, "!h", data).map((s) => s.insert)).toEqual(["!haute"]);
    expect(tokenSuggestions(tache, "@ve", data).map((s) => s.insert)).toEqual(["@vendredi"]);
    expect(tokenSuggestions(findCommand("note", cmds), "#b", data).map((s) => s.insert)).toEqual(["#Bilans"]);
    expect(tokenSuggestions(findCommand("memo", cmds), "!h", data)).toEqual([]); // no priority for memos
    expect(tokenSuggestions(tache, "réviser", data)).toEqual([]);
  });
});
