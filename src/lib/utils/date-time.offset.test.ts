/**
 * B5 / C3 - offset normalisation and `toDate` input handling.
 *
 * The bug: Safari (and some ICS feeds) emit `+0100` without a colon. `new Date()`
 * returns Invalid Date for that form, so every date built from such a string
 * silently became NaN. The fix normalises `+HHMM` to `+HH:MM` centrally inside
 * `toDate`/`toMs`, so every caller is covered instead of just one.
 */
import { describe, expect, it } from "vitest";
import { normalizeOffset, toDate, toMs } from "@/lib/utils/date-time";

describe("C3 normalizeOffset", () => {
    it("inserts the colon in a bare numeric offset", () => {
        expect(normalizeOffset("2026-01-05T10:00:00+0100")).toBe("2026-01-05T10:00:00+01:00");
        expect(normalizeOffset("2026-01-05T10:00:00-0500")).toBe("2026-01-05T10:00:00-05:00");
        expect(normalizeOffset("2026-07-01T23:45:00+0200")).toBe("2026-07-01T23:45:00+02:00");
    });

    it("leaves an already-correct offset alone", () => {
        expect(normalizeOffset("2026-01-05T10:00:00+01:00")).toBe("2026-01-05T10:00:00+01:00");
    });

    it("leaves Z and offset-free strings alone", () => {
        expect(normalizeOffset("2026-01-05T10:00:00Z")).toBe("2026-01-05T10:00:00Z");
        expect(normalizeOffset("2026-01-05T10:00:00")).toBe("2026-01-05T10:00:00");
        expect(normalizeOffset("2026-01-05")).toBe("2026-01-05");
    });

    it("both offset spellings resolve to the same instant", () => {
        const pairs = [
            ["2026-01-05T10:00:00+0100", "2026-01-05T10:00:00+01:00"],
            ["2026-01-05T10:00:00-0500", "2026-01-05T10:00:00-05:00"],
            ["2026-07-01T23:45:00+0200", "2026-07-01T23:45:00+02:00"],
        ] as const;
        for (const [bare, colon] of pairs) {
            expect(toDate(bare).getTime(), bare).toBe(toDate(colon).getTime());
            expect(Number.isNaN(toDate(bare).getTime()), `bare ${bare} must not be Invalid`).toBe(false);
        }
    });
});

describe("B5 toDate accepts Date, number and string identically", () => {
    const instant = new Date(2026, 0, 5, 10, 0, 0, 0);

    it("a Date, its epoch ms, and its ISO string all give the same instant", () => {
        const fromDate = toDate(instant);
        const fromNumber = toDate(instant.getTime());
        const fromIso = toDate(instant.toISOString());
        expect(fromNumber.getTime()).toBe(fromDate.getTime());
        expect(fromIso.getTime()).toBe(fromDate.getTime());
    });

    it("toMs agrees with toDate for all three input kinds", () => {
        expect(toMs(instant)).toBe(instant.getTime());
        expect(toMs(instant.getTime())).toBe(instant.getTime());
        expect(toMs(instant.toISOString())).toBe(instant.getTime());
    });

    it("does not mutate the input Date", () => {
        const original = new Date(2026, 0, 5, 10, 0, 0, 0);
        const copy = toDate(original);
        copy.setFullYear(1999);
        expect(original.getFullYear()).toBe(2026);
    });

    it("reports Invalid Date rather than throwing on garbage", () => {
        expect(() => toDate("not a date")).not.toThrow();
        expect(Number.isNaN(toDate("not a date").getTime())).toBe(true);
        expect(Number.isNaN(toMs("not a date"))).toBe(true);
    });
});
