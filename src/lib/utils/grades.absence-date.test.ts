/**
 * B1 - absence date split crash.
 *
 * The bug: the card split the raw date string on "/" and indexed the parts
 * without checking the shape, so a malformed or non-slash date threw during
 * render and took the whole list down.
 *
 * The fix routes through `parseFrDate`, which returns null for anything it
 * cannot parse, and the card falls back to rendering the raw string.
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
