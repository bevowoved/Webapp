/**
 * exportCalendar — behaviour when a lesson carries a date ICS cannot represent.
 *
 * The original implementation built the timestamp with `getUTC*()` calls, which
 * yield `NaN` for an Invalid Date and produce a corrupt-but-harmless DTSTART.
 * Replacing that with `toISOString()` introduced a throw: `toISOString` raises
 * RangeError on an Invalid Date. The only caller invokes the export with `void`,
 * so the rejection is unhandled — no file, no toast, no feedback, and one bad
 * lesson silently kills the whole export.
 */
import { describe, expect, it } from "vitest";
import { buildIcsContent } from "@/lib/utils/exportCalendar";
import type { Lesson } from "@/types/aurion";

const lesson = (overrides: Partial<Lesson>): Lesson =>
    ({
        id: "l1",
        title: "IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont",
        start: "2026-10-05T08:00:00+0200",
        end: "2026-10-05T10:00:00+0200",
        allDay: false,
        editable: false,
        className: "COURS_TD",
        ...overrides,
    }) as Lesson;

describe("buildIcsContent with unrepresentable dates", () => {
    it("does not throw when a lesson start cannot be parsed", () => {
        expect(() => buildIcsContent([lesson({ id: "bad", start: "not-a-date" })])).not.toThrow();
    });

    it("skips a lesson whose start is Invalid Date instead of aborting the whole export", () => {
        const ics = buildIcsContent([
            lesson({ id: "good-1" }),
            lesson({ id: "bad", start: "not-a-date" }),
            lesson({ id: "good-2" }),
        ]);
        expect(ics).toContain("UID:good-1@mauria");
        expect(ics).toContain("UID:good-2@mauria");
        expect(ics).not.toContain("UID:bad@mauria");
        expect(ics).not.toContain("NaN");
        expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
        expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    });

    it("still emits a correct DTSTART/DTEND for a valid lesson", () => {
        const ics = buildIcsContent([lesson({ id: "ok" })]);
        // 08:00 CEST (UTC+2) is 06:00Z.
        expect(ics).toContain("DTSTART:20261005T060000Z");
        expect(ics).toContain("DTEND:20261005T080000Z");
    });
});
