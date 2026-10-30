/**
 * absences.ts - the totals card on the absences page.
 *
 * The page shows three numbers (total, justified, unjustified) derived from the
 * raw `"H:MM"` duration strings Aurion sends. The split matters: the UI colours
 * justified green and unjustified amber, and `isAbsenceJustified` decides that
 * by looking for "non" in the type. A regression here mislabels hours, which is
 * the kind of thing a student would act on.
 */
import { describe, expect, it } from "vitest";
import {
    getAbsenceSemester,
    getAbsenceSemesters,
    getAbsences,
    getAbsencesDurations,
    isAbsenceJustified,
} from "@/lib/utils/absences";
import type { Absence } from "@/types/aurion";

const absence = (overrides: Partial<Absence>): Absence => ({
    date: "07/09/2026",
    type: "Absence justifiée",
    duration: "2:00",
    time: "08:00",
    class: "C1",
    teacher: "M. X",
    ...overrides,
});

describe("isAbsenceJustified", () => {
    it("treats a type without 'non' as justified", () => {
        expect(isAbsenceJustified(absence({ type: "Absence justifiée" }))).toBe(true);
        expect(isAbsenceJustified(absence({ type: "Absence" }))).toBe(true);
    });

    it("treats a type containing 'non' as unjustified, case-insensitively", () => {
        expect(isAbsenceJustified(absence({ type: "Non justifiée" }))).toBe(false);
        expect(isAbsenceJustified(absence({ type: "NON JUSTIFIEE" }))).toBe(false);
    });

    it("is a substring test, so any word containing 'non' counts", () => {
        // Documents the rule as written rather than the rule as intended: an
        // "Anonyme" type would be read as unjustified.
        expect(isAbsenceJustified(absence({ type: "Anonyme" }))).toBe(false);
    });
});

describe("getAbsencesDurations", () => {
    it("sums total, justified and unjustified separately", () => {
        const result = getAbsencesDurations([
            absence({ type: "Absence justifiée", duration: "2:30" }),
            absence({ type: "Non justifiée", duration: "1:15" }),
            absence({ type: "Absence", duration: "0:45" }),
        ]);
        expect(result).toEqual({ total: "4h30", justified: "3h15", unjustified: "1h15" });
    });

    it("pads the minutes to two digits", () => {
        expect(getAbsencesDurations([absence({ duration: "1:05" })]).total).toBe("1h05");
    });

    it("returns 0h00 for an empty list", () => {
        expect(getAbsencesDurations([])).toEqual({ total: "0h00", justified: "0h00", unjustified: "0h00" });
    });

    it("carries minutes over an hour boundary", () => {
        expect(getAbsencesDurations([absence({ duration: "0:90" })]).total).toBe("1h30");
    });

    it("does not render NaN for a duration it cannot parse", () => {
        // BUG: `Number("abc")` is NaN and the NaN propagates into the formatted
        // string, so the totals card shows "NaNhNaN" instead of the hours it
        // could still add up.
        const result = getAbsencesDurations([
            absence({ duration: "abc" }),
            absence({ duration: "2:00" }),
        ]);
        expect(result.total).toBe("2h00");
        expect(result.total).not.toContain("NaN");
    });
});

describe("getAbsenceSemester", () => {
    it("derives the semester from the French date", () => {
        expect(getAbsenceSemester(absence({ date: "07/09/2026" }))?.key).toBe("2026-S1");
        expect(getAbsenceSemester(absence({ date: "07/01/2027" }))?.key).toBe("2026-S2");
    });

    it("returns null for a date it cannot parse", () => {
        expect(getAbsenceSemester(absence({ date: "not a date" }))).toBeNull();
    });
});

describe("getAbsenceSemesters", () => {
    it("returns distinct semesters in key order", () => {
        const semesters = getAbsenceSemesters([
            absence({ date: "07/01/2027" }),
            absence({ date: "07/09/2026" }),
            absence({ date: "08/09/2026" }),
        ]);
        expect(semesters.map((s) => s.key)).toEqual(["2026-S1", "2026-S2"]);
    });

    it("skips absences with an unparseable date", () => {
        expect(getAbsenceSemesters([absence({ date: "bad" })])).toEqual([]);
    });
});

describe("getAbsences", () => {
    const list = [
        absence({ date: "07/09/2026", class: "A" }),
        absence({ date: "07/01/2027", class: "B" }),
        absence({ date: "bad", class: "C" }),
    ];

    it("filters by semester key", () => {
        expect(getAbsences({ semesterKey: "2026-S1", absences: list }).map((a) => a.class)).toEqual(["A"]);
        expect(getAbsences({ semesterKey: "2026-S2", absences: list }).map((a) => a.class)).toEqual(["B"]);
    });

    it("returns everything when no semester is requested", () => {
        expect(getAbsences({ absences: list })).toHaveLength(3);
    });

    it("tolerates a null list", () => {
        expect(getAbsences({ absences: null as unknown as Absence[] })).toEqual([]);
    });
});
