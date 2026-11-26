import { describe, expect, it } from "vitest";
import { ACCENTS, paletteOf, resolveTheme, THEMES, themeTokens } from "./theme";

describe("themes", () => {
  it("auto follows the system, unknown values too", () => {
    expect(resolveTheme("auto", true)).toBe("graphite");
    expect(resolveTheme("auto", false)).toBe("clair");
    expect(resolveTheme("nope", false)).toBe("clair");
    expect(resolveTheme("sable", true)).toBe("sable");
  });

  it("accent: theme default, or the shade matching dark/light", () => {
    expect(paletteOf("nuit", "theme").accent).toBe(THEMES.nuit.accent);
    expect(paletteOf("nuit", "rose").accent).toBe(ACCENTS.rose.dark);
    expect(paletteOf("clair", "rose").accent).toBe(ACCENTS.rose.light);
    expect(paletteOf("clair", "bogus").accent).toBe(THEMES.clair.accent);
  });

  it("tokens give readable text on the accent color", () => {
    expect(themeTokens(paletteOf("graphite", "theme"))["--on-accent"]).toBe(THEMES.graphite.veil);
    expect(themeTokens(paletteOf("clair", "theme"))["--on-accent"]).toBe("#ffffff");
  });

  it("every theme defines every token", () => {
    const keys = Object.keys(themeTokens(paletteOf("graphite", "theme")));
    for (const id of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const t = themeTokens(paletteOf(id, "theme"));
      expect(Object.keys(t)).toEqual(keys);
      expect(Object.values(t).every((v) => v.length > 0)).toBe(true);
    }
  });
});
