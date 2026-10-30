/**
 * Local task and user-event persistence.
 *
 * Both modules store JSON in localStorage and both must survive a corrupted
 * entry: the agenda is the one screen where a JSON.parse throw would take the
 * whole page down, because it runs on mount. They also both normalise dates on
 * the way in and out, so a value written as a French date or a bare datetime
 * still round-trips as a valid Date.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { getTasksFromLocalStorage, removeTaskFromLocalStorage, saveTaskToLocalStorage } from "@/lib/utils/agenda";
import { getUserEventsFromLocalStorage, removeUserEventFromLocalStorage, saveUserEventToLocalStorage } from "@/lib/utils/planning";
import { clearStorage } from "@/lib/utils/storage";
import type { TaskData, UserEvent } from "@/types/data";

const task = (id: string, date: Date): TaskData => ({ id, task: `Task ${id}`, date }) as TaskData;

const userEvent = (id: string, start: string, end: string): UserEvent =>
    ({ id, title: `Event ${id}`, start, end }) as unknown as UserEvent;

beforeEach(() => {
    clearStorage();
});

describe("tasks", () => {
    it("starts empty", () => {
        expect(getTasksFromLocalStorage()).toEqual([]);
    });

    it("round-trips a task with a real Date", () => {
        const date = new Date(2026, 8, 7, 10, 30);
        saveTaskToLocalStorage({ task: task("t1", date) });

        const [stored] = getTasksFromLocalStorage();
        expect(stored?.id).toBe("t1");
        expect(stored?.date).toBeInstanceOf(Date);
        expect(stored?.date.getTime()).toBe(date.getTime());
    });

    it("returns tasks sorted by date regardless of insertion order", () => {
        saveTaskToLocalStorage({ task: task("late", new Date(2026, 8, 9)) });
        saveTaskToLocalStorage({ task: task("early", new Date(2026, 8, 6)) });

        expect(getTasksFromLocalStorage().map((t) => t.id)).toEqual(["early", "late"]);
    });

    it("updates an existing task in place instead of duplicating it", () => {
        saveTaskToLocalStorage({ task: task("t1", new Date(2026, 8, 7)) });
        saveTaskToLocalStorage({ task: { ...task("t1", new Date(2026, 8, 7)), task: "Renamed" } });

        const tasks = getTasksFromLocalStorage();
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.task).toBe("Renamed");
    });

    it("removes a task by id and leaves the rest", () => {
        saveTaskToLocalStorage({ task: task("t1", new Date(2026, 8, 7)) });
        saveTaskToLocalStorage({ task: task("t2", new Date(2026, 8, 8)) });

        removeTaskFromLocalStorage({ taskId: "t1" });

        expect(getTasksFromLocalStorage().map((t) => t.id)).toEqual(["t2"]);
    });

    it("ignores a removal for an unknown id", () => {
        saveTaskToLocalStorage({ task: task("t1", new Date(2026, 8, 7)) });
        removeTaskFromLocalStorage({ taskId: "nope" });
        expect(getTasksFromLocalStorage()).toHaveLength(1);
    });

    it("returns an empty list instead of throwing on corrupt JSON", () => {
        localStorage.setItem("tasks", "{not json");
        expect(() => getTasksFromLocalStorage()).not.toThrow();
        expect(getTasksFromLocalStorage()).toEqual([]);
    });

    it("returns an empty list when the stored value is not an array", () => {
        localStorage.setItem("tasks", JSON.stringify({ id: "t1" }));
        expect(getTasksFromLocalStorage()).toEqual([]);
    });

    it("treats an unparseable date as the epoch rather than Invalid Date", () => {
        localStorage.setItem("tasks", JSON.stringify([{ id: "t1", task: "x", date: "garbage" }]));
        const [stored] = getTasksFromLocalStorage();
        expect(stored?.date.getTime()).toBe(0);
    });
});

describe("user events", () => {
    it("starts empty", () => {
        expect(getUserEventsFromLocalStorage()).toEqual([]);
    });

    it("normalises a bare datetime into an ISO string", () => {
        saveUserEventToLocalStorage({ userEvent: userEvent("u1", "2026-09-07T08:00:00", "2026-09-07T09:00:00") });

        const [stored] = getUserEventsFromLocalStorage();
        expect(stored?.id).toBe("u1");
        expect(stored?.start).toBe(new Date("2026-09-07T08:00:00").toISOString());
    });

    it("accepts an offset without a colon", () => {
        saveUserEventToLocalStorage({ userEvent: userEvent("u1", "2026-09-07T08:00:00+0200", "2026-09-07T09:00:00+0200") });

        const [stored] = getUserEventsFromLocalStorage();
        expect(stored?.start).toBe(new Date("2026-09-07T08:00:00+02:00").toISOString());
    });

    it("leaves an unparseable date as the raw string instead of throwing", () => {
        saveUserEventToLocalStorage({ userEvent: userEvent("u1", "not a date", "also not") });

        const [stored] = getUserEventsFromLocalStorage();
        expect(stored?.start).toBe("not a date");
    });

    it("updates an existing event in place", () => {
        saveUserEventToLocalStorage({ userEvent: userEvent("u1", "2026-09-07T08:00:00", "2026-09-07T09:00:00") });
        saveUserEventToLocalStorage({ userEvent: { ...userEvent("u1", "2026-09-07T10:00:00", "2026-09-07T11:00:00"), title: "Moved" } as UserEvent });

        const events = getUserEventsFromLocalStorage();
        expect(events).toHaveLength(1);
        expect(events[0]?.title).toBe("Moved");
    });

    it("removes an event by id", () => {
        saveUserEventToLocalStorage({ userEvent: userEvent("u1", "2026-09-07T08:00:00", "2026-09-07T09:00:00") });
        saveUserEventToLocalStorage({ userEvent: userEvent("u2", "2026-09-08T08:00:00", "2026-09-08T09:00:00") });

        removeUserEventFromLocalStorage({ userEventId: "u1" });

        expect(getUserEventsFromLocalStorage().map((e) => e.id)).toEqual(["u2"]);
    });

    it("returns an empty list instead of throwing on corrupt JSON", () => {
        localStorage.setItem("userEvents", "{not json");
        expect(() => getUserEventsFromLocalStorage()).not.toThrow();
        expect(getUserEventsFromLocalStorage()).toEqual([]);
    });

    it("returns an empty list when the stored value is not an array", () => {
        localStorage.setItem("userEvents", JSON.stringify("nope"));
        expect(getUserEventsFromLocalStorage()).toEqual([]);
    });
});
