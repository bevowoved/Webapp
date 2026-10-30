/**
 * B4 - grade `Infinity` painted a full green bar.
 *
 * The bug: the old `parseNum` used bare `parseFloat`, so the string "Infinity"
 * became `Infinity`. The bar width is `Math.min(100, Math.max(0, (val/scale)*100))`,
 * which clamps `Infinity` to 100% - a perfect score rendered for garbage input.
 * `NaN` was handled, `Infinity` was not.
 *
 * The fix routes through `parseGradeValue`, which rejects anything that is not
 * finite and returns null; `parseGradeNumber` then yields NaN, which the
 * percentage helper must not turn into 100%.
 */
import { describe, expect, it } from "vitest";
import { parseGradeNumber, parseGradeValue, detectGradeScale } from "@/lib/utils/grades";

describe("B4 non-finite grade input", () => {
    it("parseGradeValue rejects Infinity and -Infinity", () => {
        expect(parseGradeValue("Infinity")).toBeNull();
        expect(parseGradeValue("-Infinity")).toBeNull();
        expect(parseGradeValue("+Infinity")).toBeNull();
    });

    it("parseGradeNumber yields NaN (not Infinity) for non-finite input", () => {
        for (const raw of ["Infinity", "-Infinity", "infinity", "1e999"]) {
            const n = parseGradeNumber(raw);
            expect(Number.isNaN(n), `input ${JSON.stringify(raw)} -> ${n}`).toBe(true);
        }
    });

    it("a NaN grade never produces a 100% bar", () => {
        // Mirrors grades-stats.tsx: the bar width is clamped into [0, 100].
        const pct = (val: number, scale: number) => Math.min(100, Math.max(0, (val / scale) * 100));
        const myGrade = parseGradeNumber("Infinity");
        const width = pct(myGrade, 20);
        expect(Number.isNaN(width)).toBe(true);
        expect(width).not.toBe(100);
    });

    it("the old bare parseFloat really would have produced 100% (documents the bug)", () => {
        const pct = (val: number, scale: number) => Math.min(100, Math.max(0, (val / scale) * 100));
        // The pre-fix implementation, verbatim.
        const oldParseNum = (val?: string | null): number => {
            if (!val) return NaN;
            return parseFloat(val.replace(",", "."));
        };
        expect(pct(oldParseNum("Infinity"), 20)).toBe(100);
    });

    it("still parses real grades, including the French decimal comma", () => {
        expect(parseGradeNumber("15")).toBe(15);
        expect(parseGradeNumber("15,5")).toBe(15.5);
        expect(parseGradeNumber("15.5")).toBe(15.5);
        expect(parseGradeNumber("")).toBeNaN();
        expect(parseGradeNumber(null)).toBeNaN();
    });

    it("detectGradeScale ignores non-finite values", () => {
        const grade = { grade: "Infinity", average: "12", median: "12", min: "8", max: "16" };
        expect(detectGradeScale(grade)).toBe(20);
    });
});
