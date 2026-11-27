import { describe, expect, it } from "vitest";
import {
  findProject, nextMilestone, overdueCount, parseKeywords, parseRepo, progressOf, projectTime, sortMilestones,
  spanMatches, uniqueSlug, type Milestone,
} from "./projects";

const ms = (id: string, dueDate: string | null, doneAt: string | null = null, position = 0): Milestone =>
  ({ id, projectId: "p", title: id, dueDate, doneAt, position });

describe("projects", () => {
  it("progress from task statuses", () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(progressOf([{ status: "done" }, { status: "todo" }, { status: "doing" }])).toEqual({ done: 1, total: 3, pct: 33 });
  });

  it("overdue = open with a past due date", () => {
    const t = (status: "todo" | "done", dueDate: string | null) => ({ projectId: "p", milestoneId: null, status, dueDate });
    expect(overdueCount([t("todo", "2026-11-20"), t("done", "2026-11-20"), t("todo", "2026-11-27"), t("todo", null)], "2026-11-27")).toBe(1);
  });

  it("next milestone: earliest dated open one, else first by position", () => {
    expect(nextMilestone([ms("a", "2026-12-10"), ms("b", "2026-12-01"), ms("c", "2026-11-01", "x")])?.id).toBe("b");
    expect(nextMilestone([ms("a", null, null, 2), ms("b", null, null, 1)])?.id).toBe("b");
    expect(nextMilestone([ms("a", null, "x")])).toBeNull();
  });

  it("milestones: open by date then position, done last", () => {
    expect(sortMilestones([ms("done", "2026-01-01", "x"), ms("late", "2026-12-20"), ms("nodate", null), ms("soon", "2026-12-01")])
      .map((m) => m.id)).toEqual(["soon", "late", "nodate", "done"]);
  });

  it("keywords", () => {
    expect(parseKeywords(" LifeOS, lifeos app,,x, lifeos ")).toEqual(["lifeos", "lifeos app"]);
    expect(parseKeywords(null)).toEqual([]);
    expect(spanMatches({ app: "Code", title: "App.svelte — LifeOS" }, ["lifeos"])).toBe(true);
    expect(spanMatches({ app: "Firefox", title: "YouTube" }, ["lifeos"])).toBe(false);
    expect(spanMatches({ app: "Firefox", title: "YouTube" }, [])).toBe(false);
  });

  it("time spent, per day", () => {
    const day = (ms: number) => (ms < 100_000 ? "d1" : "d2");
    const spans = [
      { start: 0, end: 60_000, app: "Code", title: "lifeos" },
      { start: 60_000, end: 90_000, app: "Firefox", title: "YouTube" },
      { start: 200_000, end: 230_000, app: "Terminal", title: "~/projets/lifeos" },
    ];
    expect(projectTime(spans, ["lifeos"], day)).toEqual({ total: 90, byDay: { d1: 60, d2: 30 } });
  });

  it("GitHub repo names", () => {
    expect(parseRepo("h8dev-app/lifeos")).toBe("h8dev-app/lifeos");
    expect(parseRepo("https://github.com/h8dev-app/lifeos.git")).toBe("h8dev-app/lifeos");
    expect(parseRepo("git@github.com:h8dev-app/lifeos.git")).toBe("h8dev-app/lifeos");
    expect(parseRepo("https://gitlab.com/a/b")).toBeNull();
    expect(parseRepo("pas un depot")).toBeNull();
    expect(parseRepo("")).toBeNull();
  });

  it("+projet lookup and unique slugs", () => {
    const projects = [{ slug: "lifeos" }, { slug: "bts" }];
    expect(findProject("LifeOS", projects)?.slug).toBe("lifeos");
    expect(findProject("xyz", projects)).toBeUndefined();
    expect(findProject("btss", projects)?.slug).toBe("bts");
    expect(uniqueSlug("Life OS", ["life-os"])).toBe("life-os-2");
    expect(uniqueSlug("Rénovation", [])).toBe("renovation");
    expect(uniqueSlug("!!!", [])).toBe("projet");
  });
});
