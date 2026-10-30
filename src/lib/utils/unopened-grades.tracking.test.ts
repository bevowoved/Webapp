/**
 * unopened-grades.ts - which grades still deserve a reveal animation.
 *
 * The rule that is easy to get wrong: on the very FIRST run the app records
 * every grade as already known and marks none of them unopened. Otherwise a
 * fresh install would fire the reveal animation for a whole semester of grades
 * the user has already seen on Aurion.
 *
 * Everything here goes through localStorage, so each test starts from a clean
 * store. `clearUnopenedGrades` is the supported way to reset both keys.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
    clearUnopenedGrades,
    getGradeKey,
    KNOWN_GRADES_STORAGE_KEY,
    openGrade,
    openGrades,
    readUnopenedGrades,
    repackGrade,
    trackNewGrades,
    UNOPENED_GRADES_STORAGE_KEY,
} from "@/lib/utils/unopened-grades";
import { clearStorage } from "@/lib/utils/storage";
import { setGradeRevealMode } from "@/lib/utils/experimental";
import type { Grade } from "@/types/aurion";

const grade = (overrides: Partial<Grade>): Grade => ({
    date: "07/09/2026",
    code: "MATH1",
    name: "Maths",
    grade: "15",
    coefficient: "1",
    average: "12",
    min: "",
    max: "",
    median: "",
    standardDeviation: "",
    comment: "",
    ...overrides,
});

const a = grade({ date: "07/09/2026", code: "M1", grade: "15" });
const b = grade({ date: "08/09/2026", code: "M2", grade: "12" });
const c = grade({ date: "09/09/2026", code: "M3", grade: "9" });

beforeEach(() => {
    clearStorage();
    clearUnopenedGrades();
    // Tracking is a no-op unless a reveal mode is selected; that gate is
    // asserted separately below.
    setGradeRevealMode("cs2");
});

describe("tracking is gated on a reveal mode", () => {
    it("records nothing while the reveal mode is off", () => {
        setGradeRevealMode("off");
        trackNewGrades([a]);
        expect(localStorage.getItem(KNOWN_GRADES_STORAGE_KEY)).toBeNull();
    });

    it("records grades once a reveal mode is selected", () => {
        setGradeRevealMode("pokemon");
        trackNewGrades([a]);
        expect(localStorage.getItem(KNOWN_GRADES_STORAGE_KEY)).not.toBeNull();
    });
});

describe("getGradeKey", () => {
    it("combines date, code and name so two grades cannot collide", () => {
        expect(getGradeKey(a)).toBe("07/09/2026|M1|Maths");
    });

    it("distinguishes two grades that differ only by date", () => {
        expect(getGradeKey(a)).not.toBe(getGradeKey(b));
    });
});

describe("the first run marks nothing unopened", () => {
    it("records every grade as known but opens none of them", () => {
        trackNewGrades([a, b]);
        expect(readUnopenedGrades()).toEqual([]);
        expect(JSON.parse(localStorage.getItem(KNOWN_GRADES_STORAGE_KEY) as string)).toHaveLength(2);
    });

    it("marks a grade that appears after the first run", () => {
        trackNewGrades([a, b]);
        trackNewGrades([a, b, c]);
        expect(readUnopenedGrades()).toEqual([getGradeKey(c)]);
    });

    it("does not re-mark a grade that was already known", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        trackNewGrades([a, b]);
        expect(readUnopenedGrades()).toEqual([getGradeKey(b)]);
    });
});

describe("grades without a value are ignored", () => {
    it("skips a row whose grade field is empty", () => {
        trackNewGrades([a]);
        trackNewGrades([a, grade({ date: "10/09/2026", code: "M4", grade: "" })]);
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("skips a row whose grade field is only whitespace", () => {
        trackNewGrades([a]);
        trackNewGrades([a, grade({ date: "10/09/2026", code: "M4", grade: "   " })]);
        expect(readUnopenedGrades()).toEqual([]);
    });
});

describe("opening and repacking", () => {
    it("opening a grade removes it from the unopened set", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        expect(readUnopenedGrades()).toEqual([getGradeKey(b)]);

        openGrade(b);
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("opening several grades at once removes all of them", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b, c]);
        openGrades([b, c]);
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("repacking a grade puts it back", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        openGrade(b);
        expect(readUnopenedGrades()).toEqual([]);

        repackGrade(b);
        expect(readUnopenedGrades()).toEqual([getGradeKey(b)]);
    });

    it("opening an already-open grade is a no-op", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        openGrade(b);
        expect(() => openGrade(b)).not.toThrow();
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("opening an empty list is a no-op", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        openGrades([]);
        expect(readUnopenedGrades()).toEqual([getGradeKey(b)]);
    });
});

describe("clearUnopenedGrades", () => {
    it("drops both keys and the in-memory snapshot", () => {
        trackNewGrades([a]);
        trackNewGrades([a, b]);
        expect(readUnopenedGrades()).toHaveLength(1);

        clearUnopenedGrades();

        expect(readUnopenedGrades()).toEqual([]);
        expect(localStorage.getItem(KNOWN_GRADES_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(UNOPENED_GRADES_STORAGE_KEY)).toBeNull();
    });

    it("makes the next call a first run again", () => {
        trackNewGrades([a]);
        clearUnopenedGrades();
        trackNewGrades([a, b]);
        expect(readUnopenedGrades()).toEqual([]);
    });
});

describe("corrupt storage does not break the app", () => {
    it("treats a non-JSON value as an empty set", () => {
        localStorage.setItem(UNOPENED_GRADES_STORAGE_KEY, "{not json");
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("treats a JSON value that is not an array as an empty set", () => {
        localStorage.setItem(UNOPENED_GRADES_STORAGE_KEY, JSON.stringify({ a: 1 }));
        expect(readUnopenedGrades()).toEqual([]);
    });

    it("drops non-string members of an array", () => {
        localStorage.setItem(UNOPENED_GRADES_STORAGE_KEY, JSON.stringify(["keep", 1, null, { x: 1 }]));
        expect(readUnopenedGrades()).toEqual(["keep"]);
    });
});
