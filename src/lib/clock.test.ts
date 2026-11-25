import { describe, expect, it } from "vitest";
import { formatDate, formatTime } from "./clock";

describe("clock", () => {
  it("pads hours and minutes", () => {
    expect(formatTime(new Date(2026, 10, 25, 7, 5))).toBe("07:05");
  });

  it("formats the date in French with a capital letter", () => {
    expect(formatDate(new Date(2026, 10, 25))).toBe("Mercredi 25 novembre");
  });
});
