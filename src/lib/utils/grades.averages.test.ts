/**
 * Grade averages - the weighting rules behind the number on the home screen.
 *
 * Three rules decide that number and none of them is obvious from the UI:
 *
 * 1. A partial exam (`*_PART*` in the code) counts coefficient x1, a normal
 *    grade counts x2. Without this a single partial would dominate a subject.
 * 2. CIR students are averaged per module using the module weight table
 *    (`MATH1:40, MATH2:40, MATH_TP:20`), not as a flat coefficient mass.
 * 3. LV2 is excluded when including it would lower the overall average.
 *
 * Each test below is written so that breaking the rule it covers changes the
 * expected number, not just a shape.
 */
import { describe, expect, it } from "vitest";
import {
    computeAverageEvolution,
    computeAverages,
    detectStudentClass,
    getCirModuleWeights,
    getGradeSemester,
    getGradeSemesters,
    getGrades,
    getSubjectCoefficients,
} from "@/lib/utils/grades";
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

const subject = (averages: ReturnType<typeof computeAverages>, labelKey: string) =>
    averages.bySubject.find((s) => s.labelKey === labelKey);

describe("partial exams weigh half a normal grade", () => {
    it("a partial and a normal grade average 16.67, not 15", () => {
        // PART -> coef 1, normal -> coef 2. (10*1 + 20*2) / 3.
        const averages = computeAverages([
            grade({ code: "MATH1_PART1", grade: "10", average: "10" }),
            grade({ code: "MATH1", grade: "20", average: "20" }),
        ]);
        expect(subject(averages, "gradesPage.subjects.maths")?.student).toBeCloseTo(16.6667, 3);
    });

    it("applies the same halving to the class average", () => {
        const averages = computeAverages([
            grade({ code: "MATH1_PART1", grade: "10", average: "10" }),
            grade({ code: "MATH1", grade: "20", average: "20" }),
        ]);
        expect(subject(averages, "gradesPage.subjects.maths")?.class).toBeCloseTo(16.6667, 3);
    });

    it("two normal grades with the same coefficient average flat", () => {
        const averages = computeAverages([
            grade({ code: "MATH1", grade: "10", average: "10" }),
            grade({ code: "MATH2", grade: "20", average: "20" }),
        ]);
        expect(subject(averages, "gradesPage.subjects.maths")?.student).toBe(15);
    });
});

describe("CIR module weighting", () => {
    const cirGrades = [
        grade({ code: "CIR1_MATH1", grade: "10", average: "10" }),
        grade({ code: "CIR1_MATH2", grade: "20", average: "20" }),
        grade({ code: "CIR1_MATH_TP", grade: "20", average: "20" }),
    ];

    it("weights modules 40/40/20 instead of averaging flat", () => {
        // Weighted: (40*10 + 40*20 + 20*20) / 100 = 16. Flat would be 16.67.
        const averages = computeAverages(cirGrades);
        expect(subject(averages, "gradesPage.subjects.maths")?.student).toBe(16);
    });

    it("does not apply the partial doubling for CIR students", () => {
        // For CIR the raw coefficient is used as-is; a PART grade is not halved.
        const withPartial = computeAverages([
            grade({ code: "CIR1_MATH1_PART", grade: "10", average: "10" }),
            grade({ code: "CIR1_MATH2", grade: "20", average: "20" }),
        ]);
        expect(subject(withPartial, "gradesPage.subjects.maths")?.student).toBe(15);
    });

    it("falls back to the flat average when a module is unrecognised", () => {
        // An unknown module means the weight table cannot describe the subject,
        // so the code must not silently drop the grade.
        const averages = computeAverages([
            grade({ code: "CIR1_MATH1", grade: "10", average: "10" }),
            grade({ code: "CIR1_ZZZ_UNKNOWN", grade: "20", average: "20" }),
        ]);
        expect(subject(averages, "gradesPage.subjects.maths")?.student).toBe(10);
        expect(subject(averages, "CIR1_ZZZ_UNKNOWN")?.student).toBe(20);
    });

    it("exposes the module table only for CIR classes", () => {
        expect(getCirModuleWeights([grade({ code: "CIR1_MATH1" })])).not.toBeNull();
        expect(getCirModuleWeights([grade({ code: "CPG1_MP2I_MATH1" })])).toBeNull();
    });
});

describe("subject coefficients scale the overall average", () => {
    it("weights maths 8 and physics 6 for a CPG1 MP2I student", () => {
        const averages = computeAverages([
            grade({ code: "CPG1_MP2I_MATH", grade: "10", average: "10" }),
            grade({ code: "CPG1_MP2I_PHYS", grade: "20", average: "20" }),
        ]);
        // (10*8 + 20*6) / 14
        expect(averages.overall.student).toBeCloseTo(14.2857, 3);
        expect(subject(averages, "gradesPage.subjects.maths")?.subjectCoef).toBe(8);
        expect(subject(averages, "gradesPage.subjects.physics")?.subjectCoef).toBe(6);
    });

    it("returns the CPG1 MP2I coefficient table when no class is detectable", () => {
        const coefficients = getSubjectCoefficients([grade({ code: "MATH1" })]);
        expect(coefficients["gradesPage.subjects.maths"]).toBe(8);
        expect(coefficients["gradesPage.subjects.tipe"]).toBe(1);
    });

    it("returns the CIR1 semester-1 table for a CIR1 student", () => {
        const coefficients = getSubjectCoefficients([grade({ code: "CIR1_MATH1", date: "07/09/2026" })]);
        expect(coefficients["gradesPage.subjects.maths"]).toBe(9);
        expect(coefficients["gradesPage.subjects.sii"]).toBeUndefined();
    });
});

describe("LV2 is excluded only when it would lower the average", () => {
    it("excludes a below-average LV2 and reports the higher overall", () => {
        const averages = computeAverages([
            grade({ code: "MATH1", grade: "14", average: "12" }),
            grade({ code: "LV2_ESP", grade: "8", average: "12" }),
        ]);
        expect(averages.overall.student).toBe(14);
        expect(subject(averages, "gradesPage.subjects.lv2")?.excluded).toBe(true);
    });

    it("keeps an above-average LV2 in the overall", () => {
        const averages = computeAverages([
            grade({ code: "MATH1", grade: "14", average: "12" }),
            grade({ code: "LV2_ESP", grade: "18", average: "12" }),
        ]);
        // (14*8 + 18*2) / 10
        expect(averages.overall.student).toBeCloseTo(14.8, 3);
        expect(subject(averages, "gradesPage.subjects.lv2")?.excluded).toBe(false);
    });

    it("never reports an overall lower than the one without LV2", () => {
        // The rule is `withLv2 <= without` -> exclude, so a tie is excluded too.
        // That is harmless: the reported number is identical either way, which
        // is the only thing the user can observe.
        const averages = computeAverages([
            grade({ code: "MATH1", grade: "14", average: "12" }),
            grade({ code: "LV2_ESP", grade: "14", average: "12" }),
        ]);
        expect(averages.overall.student).toBe(14);
        expect(subject(averages, "gradesPage.subjects.lv2")?.student).toBe(14);
    });
});

describe("computeAverages edge cases", () => {
    it("returns nulls rather than NaN for an empty list", () => {
        const averages = computeAverages([]);
        expect(averages.overall).toEqual({ student: null, class: null });
        expect(averages.bySubject).toEqual([]);
    });

    it("keeps a subject whose student grade is missing but class average exists", () => {
        const averages = computeAverages([grade({ code: "MATH1", grade: "", average: "12" })]);
        const maths = subject(averages, "gradesPage.subjects.maths");
        expect(maths?.student).toBeNull();
        expect(maths?.class).toBe(12);
    });

    it("returns the same object for the same array reference (weak-map cache)", () => {
        const grades = [grade({ code: "MATH1" })];
        expect(computeAverages(grades)).toBe(computeAverages(grades));
    });
});

describe("detectStudentClass", () => {
    it("picks the most recent class when a student changed class", () => {
        const grades = [
            grade({ code: "CPG1_MP2I_X", date: "07/09/2026" }),
            grade({ code: "CPG2_MPI_X", date: "07/01/2027" }),
        ];
        expect(detectStudentClass(grades)).toBe("CPG2_MPI");
    });

    it("is order-independent", () => {
        const grades = [
            grade({ code: "CPG2_MPI_X", date: "07/01/2027" }),
            grade({ code: "CPG1_MP2I_X", date: "07/09/2026" }),
        ];
        expect(detectStudentClass(grades)).toBe("CPG2_MPI");
    });

    it("detects CIR from the ISEN marker", () => {
        expect(detectStudentClass([grade({ code: "X_ISEN_A1_MATH" })])).toBe("CIR1");
        expect(detectStudentClass([grade({ code: "X_ISEN_A2_MATH" })])).toBe("CIR2");
    });

    it("returns null when no grade carries a class code", () => {
        expect(detectStudentClass([grade({ code: "MATH1" })])).toBeNull();
    });
});

describe("semester derivation", () => {
    it("treats 29 August as the start of the academic year", () => {
        expect(getGradeSemester(grade({ date: "28/08/2026" }))?.key).toBe("2025-S2");
        expect(getGradeSemester(grade({ date: "29/08/2026" }))?.key).toBe("2026-S1");
    });

    it("lets the code override the date", () => {
        // A January date would otherwise be semester 2.
        expect(getGradeSemester(grade({ date: "07/01/2027", code: "MATH1_PART1" }))?.key).toBe("2026-S1");
        expect(getGradeSemester(grade({ date: "07/09/2026", code: "MATH1_PART2" }))?.key).toBe("2026-S2");
    });

    it("returns null for an unparseable date", () => {
        expect(getGradeSemester(grade({ date: "not a date" }))).toBeNull();
    });
});

describe("getGrades and getGradeSemesters", () => {
    const artifact = grade({
        date: "",
        code: "",
        name: "",
        grade: "",
        coefficient: "",
        average: "",
        min: "",
        max: "",
        median: "",
        standardDeviation: "",
        comment: "",
    });
    const real = grade({ code: "M1", date: "07/09/2026" });

    it("drops the all-empty artifact row Aurion emits", () => {
        expect(getGrades({ grades: [artifact, real] })).toHaveLength(1);
        expect(getGradeSemesters([artifact, real])).toHaveLength(1);
    });

    it("filters by semester key", () => {
        const grades = [
            grade({ code: "M1", date: "07/09/2026" }),
            grade({ code: "M2", date: "07/01/2027" }),
        ];
        expect(getGrades({ semesterKey: "2026-S1", grades }).map((g) => g.code)).toEqual(["M1"]);
        expect(getGrades({ semesterKey: "2026-S2", grades }).map((g) => g.code)).toEqual(["M2"]);
    });

    it("returns every non-artifact grade when no semester is requested", () => {
        const grades = [grade({ code: "M1", date: "07/09/2026" }), grade({ code: "M2", date: "07/01/2027" })];
        expect(getGrades({ grades })).toHaveLength(2);
    });
});

describe("computeAverageEvolution", () => {
    it("orders points by date regardless of input order", () => {
        const grades = [
            grade({ date: "07/01/2027", code: "M1", grade: "16", average: "12" }),
            grade({ date: "07/09/2026", code: "M1", grade: "10", average: "11" }),
        ];
        const points = computeAverageEvolution(grades);
        expect(points.map((p) => p.date)).toEqual(["07/09/2026", "07/01/2027"]);
        expect(points[0]?.student).toBe(10);
    });

    it("collapses two grades on the same date into one point", () => {
        const grades = [
            grade({ date: "07/09/2026", code: "M1", grade: "10", average: "10" }),
            grade({ date: "07/09/2026", code: "M2", grade: "20", average: "20" }),
        ];
        const points = computeAverageEvolution(grades);
        expect(points).toHaveLength(1);
        expect(points[0]?.student).toBe(15);
    });

    it("returns an empty array when there is nothing dated", () => {
        expect(computeAverageEvolution([])).toEqual([]);
    });
});
