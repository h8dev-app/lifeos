import { describe, expect, it } from "vitest";
import { activePeriods, activeSpans, timelineBlocks, totalSeconds, totalsByApp, type AwEvent, type WindowData } from "./aggregate";
import { pushEventsToEntries, isValidGithubUser } from "./github";
import { buildTimeline, formatSeconds } from "./timeline";

const T0 = Date.parse("2026-11-25T08:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const win = (min: number, durMin: number, app: string, title = ""): AwEvent<WindowData> =>
  ({ timestamp: at(min), duration: durMin * 60, data: { app, title } });
const afk = (min: number, durMin: number, status: "afk" | "not-afk") =>
  ({ timestamp: at(min), duration: durMin * 60, data: { status } });
const DAY = [T0 - 3_600_000, T0 + 24 * 3_600_000] as const;

describe("activePeriods", () => {
  it("merges overlapping not-afk periods, ignores afk", () => {
    const p = activePeriods([afk(0, 10, "not-afk"), afk(5, 10, "not-afk"), afk(15, 30, "afk"), afk(45, 5, "not-afk")]);
    expect(p).toEqual([
      { start: T0, end: T0 + 15 * 60_000 },
      { start: T0 + 45 * 60_000, end: T0 + 50 * 60_000 },
    ]);
  });
});

describe("activeSpans", () => {
  it("clips window time to active periods", () => {
    const spans = activeSpans([win(0, 60, "Firefox")], [afk(0, 20, "not-afk"), afk(20, 30, "afk"), afk(50, 10, "not-afk")], ...DAY);
    expect(totalSeconds(spans)).toBe(30 * 60);
  });
  it("without afk data, all window time counts", () => {
    expect(totalSeconds(activeSpans([win(0, 10, "Code")], null, ...DAY))).toBe(600);
  });
  it("clips to the requested day", () => {
    const spans = activeSpans([win(-120, 180, "Code")], null, T0, T0 + 3_600_000);
    expect(totalSeconds(spans)).toBe(3600);
  });
  it("unnamed app → Inconnu", () => {
    expect(activeSpans([{ timestamp: at(0), duration: 60, data: {} }], null, ...DAY)[0].app).toBe("Inconnu");
  });
});

describe("totalsByApp", () => {
  it("sums per app and per title, longest first", () => {
    const spans = activeSpans([
      win(0, 10, "Firefox", "GitHub"), win(10, 25, "Code", "lib.rs"), win(35, 5, "Firefox", "YouTube"), win(40, 5, "Firefox", "GitHub"),
    ], null, ...DAY);
    expect(totalsByApp(spans)).toEqual([
      { app: "Code", seconds: 1500, titles: [{ title: "lib.rs", seconds: 1500 }] },
      { app: "Firefox", seconds: 1200, titles: [{ title: "GitHub", seconds: 900 }, { title: "YouTube", seconds: 300 }] },
    ]);
  });
});

describe("timelineBlocks", () => {
  it("merges same app across small gaps and drops short switches", () => {
    const spans = activeSpans([
      win(0, 30, "Code"), win(30, 0.5, "Firefox"), win(31, 20, "Code"), win(60, 10, "Firefox"),
    ], null, ...DAY);
    expect(timelineBlocks(spans).map((b) => [b.app, b.seconds])).toEqual([["Code", 3000], ["Firefox", 600]]);
  });
});

describe("github", () => {
  it("keeps PushEvents with commit count, repo and branch", () => {
    const entries = pushEventsToEntries([
      { id: "1", type: "PushEvent", created_at: "2026-11-25T10:00:00Z", repo: { name: "henri/lifeos" }, payload: { size: 3, ref: "refs/heads/main" } },
      { id: "2", type: "WatchEvent", created_at: "2026-11-25T11:00:00Z" },
      { id: "3", type: "PushEvent", created_at: "2026-11-25T12:00:00Z", repo: { name: "henri/bts" }, payload: { ref: "refs/heads/dev" } },
    ]);
    expect(entries).toEqual([
      { externalId: "github:1", occurredAt: "2026-11-25T10:00:00.000Z", data: { repo: "henri/lifeos", commits: 3, note: "main" } },
      { externalId: "github:3", occurredAt: "2026-11-25T12:00:00.000Z", data: { repo: "henri/bts", note: "dev" } },
    ]);
  });
  it("2025+ events without commits: compare info kept", () => {
    const [e] = pushEventsToEntries([{
      id: "9", type: "PushEvent", created_at: "2026-11-22T22:18:46Z", repo: { name: "torvalds/linux" },
      payload: { ref: "refs/heads/master", before: "2".repeat(40), head: "6".repeat(40) },
    }]);
    expect(e.data).toEqual({ repo: "torvalds/linux", note: "master" });
    expect(e.compare).toEqual({ repo: "torvalds/linux", before: "2".repeat(40), head: "6".repeat(40) });
  });
  it("validates usernames", () => {
    expect(isValidGithubUser("henri-p")).toBe(true);
    expect(isValidGithubUser("../orgs")).toBe(false);
    expect(isValidGithubUser("-x")).toBe(false);
    expect(isValidGithubUser("a".repeat(40))).toBe(false);
  });
});

describe("timeline", () => {
  it("mixes entries and blocks by time", () => {
    const items = buildTimeline(
      [{ id: "e1", categoryId: "c", occurredAt: at(45), source: "manual" }],
      [{ start: T0, end: T0 + 30 * 60_000, app: "Code", seconds: 1800 }],
    );
    expect(items.map((i) => i.kind)).toEqual(["activity", "entry"]);
  });
  it("formatSeconds", () => {
    expect(formatSeconds(20)).toBe("< 1 min");
    expect(formatSeconds(340)).toBe("6 min");
    expect(formatSeconds(3725)).toBe("1 h 02");
  });
});
