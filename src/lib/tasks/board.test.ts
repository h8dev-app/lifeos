import { describe, expect, it } from "vitest";
import { compareTasks, groupByStatus, nextPriority, parsePriorityWord, priorityOf, type TaskStatus } from "./board";

const t = (status: TaskStatus, priority: number, dueDate: string | null, extra: { id?: string; doneAt?: string } = {}) => ({
  id: "", status, priority, dueDate, doneAt: null as string | null, position: 0, createdAt: "2026-11-01T00:00:00Z", ...extra,
});

describe("board", () => {
  it("sorts open tasks by priority, then due date, then creation", () => {
    const list = [
      t("todo", 2, null, { id: "a" }), t("todo", 1, "2026-12-01", { id: "b" }), t("todo", 1, "2026-11-28", { id: "c" }),
      t("todo", 2, "2026-11-30", { id: "d" }), t("todo", 3, "2026-11-26", { id: "e" }),
    ];
    expect([...list].sort(compareTasks).map((x) => x.id)).toEqual(["c", "b", "d", "a", "e"]);
  });
  it("done tasks: most recent first", () => {
    const g = groupByStatus([
      t("done", 1, null, { doneAt: "2026-11-20T10:00:00Z", id: "old" }),
      t("done", 3, null, { doneAt: "2026-11-25T10:00:00Z", id: "new" }),
      t("doing", 2, null, { id: "x" }),
    ]);
    expect(g.done.map((x) => x.id)).toEqual(["new", "old"]);
    expect(g.doing).toHaveLength(1);
    expect(g.todo).toHaveLength(0);
  });
  it("priorities", () => {
    expect(nextPriority(1)).toBe(2);
    expect(nextPriority(3)).toBe(1);
    expect(priorityOf(1).label).toBe("Haute");
    expect(priorityOf(9).label).toBe("Moyenne");
    expect(parsePriorityWord("Élevée")).toBeNull();
    expect(parsePriorityWord("HAUTE")).toBe(1);
  });
});
