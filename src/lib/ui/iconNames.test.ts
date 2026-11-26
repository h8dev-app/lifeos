import { describe, expect, it } from "vitest";
import { categoryIcon, isIconName } from "./iconNames";

describe("icons", () => {
  it("maps names, known emojis, and nothing else", () => {
    expect(categoryIcon("book-open")).toBe("book-open");
    expect(categoryIcon("🏃")).toBe("footprints");
    expect(categoryIcon("☕️")).toBe("coffee"); // with variation selector
    expect(categoryIcon("🦄")).toBeNull();
    expect(categoryIcon(null)).toBeNull();
    expect(isIconName("nope")).toBe(false);
  });
});
