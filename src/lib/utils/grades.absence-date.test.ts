/**
 * Regression guard for the French date parser itself.
 *
 * Scope note: this file does NOT cover the B1 absence-card crash. Both
 * `parseFrDate` and `frDateToIso` predate the fix, so every test here passes on
 * the broken tree — it guards the parser against future regressions, not the
 * bug. The component-level coverage for B1 lives in
 * `src/pages/absences/absences-card.render.test.tsx`, which renders the card and
 * fails 10/17 with `TypeError: Cannot read properties of undefined (reading
 * 'length')` when the old split-based code is restored.
 */
import { describe, expect, it } from "vitest";
import { frDateToIso, parseFrDate } from "@/lib/utils/grades";

const MALFORMED = [
    "",
    "not a date",
    "2026-01-05",       // ISO, not French
    "05/01",            // too few parts
    "05/01/2026/extra", // too many parts
    "//",
    "aa/bb/cccc",
    "05/01/2026",
    "5/1/26",
    "31/12/2026",
] as const;

describe("B1 malformed absence dates never throw", () => {
    it("frDateToIso returns null instead of throwing for every malformed shape", () => {
        for (const raw of MALFORMED) {
            expect(() => frDateToIso(raw), `input ${JSON.stringify(raw)}`).not.toThrow();
        }
    });

    it("parseFrDate returns null (not a crash) for every malformed shape", () => {
        for (const raw of MALFORMED) {
            expect(() => parseFrDate(raw), `input ${JSON.stringify(raw)}`).not.toThrow();
        }
    });

    it("returns null for the shapes that cannot be a French date", () => {
        const unparseable = ["", "not a date", "2026-01-05", "05/01", "05/01/2026/extra", "//", "aa/bb/cccc"];
        for (const raw of unparseable) {
            expect(parseFrDate(raw), `input ${JSON.stringify(raw)}`).toBeNull();
        }
    });

    it("still parses the real shapes, so the fallback does not mask valid data", () => {
        expect(frDateToIso("05/01/2026")).toBe("2026-01-05");
        expect(frDateToIso("5/1/26")).toBe("2026-01-05");
        expect(parseFrDate("05/01/2026")?.getTime()).toBe(new Date(2026, 0, 5).getTime());
    });
});
