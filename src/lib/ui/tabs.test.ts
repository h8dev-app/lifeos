import { describe, expect, it } from "vitest";
import { DEFAULT_TABS, moveTab, parseTabs, toggleTab } from "./tabs";

describe("tabs", () => {
  it("parses, keeps home and settings", () => {
    expect(parseTabs(undefined)).toEqual(DEFAULT_TABS.split(","));
    expect(parseTabs("notes,ghost,notes,tasks")).toEqual(["dashboard", "notes", "tasks", "settings"]);
    expect(parseTabs("")).toEqual(["dashboard", "settings"]);
  });
  it("hides and shows a tab at its usual place", () => {
    const t = parseTabs("dashboard,tasks,notes,settings");
    expect(toggleTab(t, "tasks")).toEqual(["dashboard", "notes", "settings"]);
    expect(toggleTab(t, "agenda")).toEqual(["dashboard", "tasks", "agenda", "notes", "settings"]);
    expect(toggleTab(t, "settings")).toBe(t); // locked
  });
  it("moves a tab", () => {
    const t = parseTabs("dashboard,tasks,notes,settings");
    expect(moveTab(t, "notes", -1)).toEqual(["dashboard", "notes", "tasks", "settings"]);
    expect(moveTab(t, "dashboard", -1)).toBe(t);
  });
});
