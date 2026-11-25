import { describe, expect, it } from "vitest";
import { formatDate, formatTime, formatWhen } from "./clock";

describe("clock", () => {
  it("pads hours and minutes", () => {
    expect(formatTime(new Date(2026, 10, 25, 7, 5))).toBe("07:05");
  });

  it("formats the date in French with a capital letter", () => {
    expect(formatDate(new Date(2026, 10, 25))).toBe("Mercredi 25 novembre");
  });

  it("formats entry times relative to today", () => {
    const now = new Date(2026, 10, 25, 18, 0);
    expect(formatWhen(new Date(2026, 10, 25, 14, 5).toISOString(), now)).toBe("14:05");
    expect(formatWhen(new Date(2026, 10, 24, 9, 30).toISOString(), now)).toBe("hier 09:30");
    expect(formatWhen(new Date(2026, 10, 2, 7, 0).toISOString(), now)).toBe("02/11 07:00");
  });
});
