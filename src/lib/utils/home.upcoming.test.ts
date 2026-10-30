/**
 * home.ts - "now / today / tomorrow" on the home screen.
 *
 * These functions read the wall clock, so the clock is pinned with fake timers
 * and restored afterwards; nothing here depends on the machine's date.
 *
 * The behaviour that matters is the partition: a lesson that already ended must
 * not appear in "today", the lesson in progress must be "current", and a lesson
 * tomorrow must not leak into "today". Getting that wrong shows a student a
 * lesson they have already attended.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { buildWidgetLessons, findNextLessonOfCurrentCourse, getHomeUpcoming } from "@/lib/utils/home";
import type { Lesson } from "@/types/aurion";

const lesson = (id: string, course: string, start: Date, end: Date): Lesson =>
    ({
        id,
        title: `IC2 C401\n${course}\nCOURS_TD\nM. Dupont`,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        editable: false,
        className: "COURS_TD",
    }) as Lesson;

const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes, 0, 0);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at(7, 12, 0));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getHomeUpcoming", () => {
    it("reports the lesson in progress as current", () => {
        const current = lesson("c", "Physique", at(7, 11), at(7, 13));
        const result = getHomeUpcoming({ lessons: [current] });
        expect(result.current?.courseTitle).toBe("Physique");
    });

    it("does not report a finished lesson as current or as upcoming today", () => {
        const past = lesson("p", "Maths", at(7, 9), at(7, 11));
        const result = getHomeUpcoming({ lessons: [past] });
        expect(result.current).toBeNull();
        expect(result.today).toEqual([]);
    });

    it("lists only the lessons that start later today", () => {
        const later = lesson("l", "Info", at(7, 15), at(7, 16));
        const past = lesson("p", "Maths", at(7, 9), at(7, 11));
        const result = getHomeUpcoming({ lessons: [later, past] });
        expect(result.today.map((l) => l.courseTitle)).toEqual(["Info"]);
    });

    it("sorts today's lessons by start time", () => {
        const late = lesson("late", "Info", at(7, 17), at(7, 18));
        const early = lesson("early", "Anglais", at(7, 14), at(7, 15));
        const result = getHomeUpcoming({ lessons: [late, early] });
        expect(result.today.map((l) => l.courseTitle)).toEqual(["Anglais", "Info"]);
    });

    it("puts tomorrow's lessons in tomorrow, not today", () => {
        const tomorrow = lesson("t", "Maths", at(8, 8), at(8, 10));
        const result = getHomeUpcoming({ lessons: [tomorrow] });
        expect(result.today).toEqual([]);
        expect(result.tomorrow.map((l) => l.courseTitle)).toEqual(["Maths"]);
    });

    it("ignores lessons further out than tomorrow", () => {
        const far = lesson("f", "Maths", at(10, 8), at(10, 10));
        const result = getHomeUpcoming({ lessons: [far] });
        expect(result.today).toEqual([]);
        expect(result.tomorrow).toEqual([]);
    });

    it("includes the time range and location for display", () => {
        const current = lesson("c", "Physique", at(7, 11), at(7, 13));
        const result = getHomeUpcoming({ lessons: [current] });
        expect(result.current?.time).toBe("11:00 - 13:00");
        expect(result.current?.location).toBe("IC2 C401");
    });

    it("caches per input array", () => {
        const lessons = [lesson("c", "Physique", at(7, 11), at(7, 13))];
        expect(getHomeUpcoming({ lessons })).toBe(getHomeUpcoming({ lessons }));
    });
});

describe("findNextLessonOfCurrentCourse", () => {
    it("finds the next lesson of the course that is running now", () => {
        const now = lesson("n", "Maths", at(7, 11), at(7, 13));
        const next = lesson("x", "Maths", at(8, 8), at(8, 10));
        const other = lesson("o", "Info", at(8, 8), at(8, 10));

        const result = findNextLessonOfCurrentCourse([now, next, other], at(7, 12));
        expect(result?.course).toBe("Maths");
        expect(result?.start.getTime()).toBe(at(8, 8).getTime());
    });

    it("returns null when the current course has no further lesson", () => {
        const now = lesson("n", "Maths", at(7, 11), at(7, 13));
        expect(findNextLessonOfCurrentCourse([now], at(7, 12))).toBeNull();
    });

    it("matches the course case-insensitively", () => {
        const now = lesson("n", "Maths", at(7, 11), at(7, 13));
        const next = lesson("x", "MATHS", at(8, 8), at(8, 10));
        expect(findNextLessonOfCurrentCourse([now, next], at(7, 12))?.course).toBe("Maths");
    });

    it("still finds the course within the 10-minute grace window after it ends", () => {
        const ended = lesson("e", "Maths", at(7, 11), at(7, 12));
        const next = lesson("x", "Maths", at(8, 8), at(8, 10));
        expect(findNextLessonOfCurrentCourse([ended, next], at(7, 12, 5))?.course).toBe("Maths");
    });

    it("returns null once the grace window has passed", () => {
        const ended = lesson("e", "Maths", at(7, 11), at(7, 12));
        const next = lesson("x", "Maths", at(8, 8), at(8, 10));
        expect(findNextLessonOfCurrentCourse([ended, next], at(7, 12, 30))).toBeNull();
    });

    it("returns null with no lessons", () => {
        expect(findNextLessonOfCurrentCourse([], at(7, 12))).toBeNull();
    });
});

describe("buildWidgetLessons", () => {
    it("renders the abbreviated course, the time range and the location", () => {
        const widgets = buildWidgetLessons([lesson("a", "Informatique", at(7, 8), at(7, 10))]);
        expect(widgets[0]?.title).toBe("Info");
        expect(widgets[0]?.time).toBe("08:00 - 10:00");
        expect(widgets[0]?.location).toBe("IC2 C401");
    });

    it("sorts by start time", () => {
        const widgets = buildWidgetLessons([
            lesson("b", "Info", at(7, 15), at(7, 16)),
            lesson("a", "Maths", at(7, 8), at(7, 10)),
        ]);
        expect(widgets.map((w) => w.title)).toEqual(["Maths", "Info"]);
    });

    it("drops lessons that ended before the start of this week", () => {
        // The clock is Monday 7 September 2026, so the week starts on 7 September.
        const lastWeek = lesson("old", "Maths", at(1, 8), at(1, 10));
        expect(buildWidgetLessons([lastWeek])).toEqual([]);
    });

    it("keeps a lesson that is still running from before the week start", () => {
        const running = lesson("run", "Maths", at(6, 23), at(7, 1));
        expect(buildWidgetLessons([running])).toHaveLength(1);
    });

    it("exposes epoch milliseconds for the lesson bounds", () => {
        const widgets = buildWidgetLessons([lesson("a", "Maths", at(7, 8), at(7, 10))]);
        expect(widgets[0]?.startMs).toBe(at(7, 8).getTime());
        expect(widgets[0]?.endMs).toBe(at(7, 10).getTime());
    });
});
