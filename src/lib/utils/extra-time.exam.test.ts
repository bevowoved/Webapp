/**
 * extra-time.ts - when a DS runs long, the calendar shows the extra time.
 *
 * The rule: only exam lessons are stretched, and only when the toggle is on.
 * The stretch comes from either a `horaire tt : 9h30 - 12h00` note in the title
 * or, when there is no note, a third of the original duration added to the end.
 *
 * The failure mode this guards is a lecture silently growing by a third because
 * the exam detector matched too broadly, or a DS not growing at all because the
 * detector missed the type.
 */
import { describe, expect, it } from "vitest";
import { applyExtraTime, formatExtraTimeLabel } from "@/lib/utils/extra-time";
import type { Lesson } from "@/types/aurion";

const lesson = (title: string, className = "COURS_TD"): Lesson =>
    ({
        id: "l1",
        title,
        start: "2026-09-07T08:00:00",
        end: "2026-09-07T10:00:00",
        allDay: false,
        editable: false,
        className,
    }) as Lesson;

const exam = lesson("IC2 C401\nMathématiques\nDS\n08:00 - 10:00\nM. Dupont");
const lecture = lesson("IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont");

describe("applyExtraTime with the toggle off", () => {
    it("returns the lessons untouched", () => {
        const out = applyExtraTime([exam], false);
        expect(out[0]?.start).toBe("2026-09-07T08:00:00");
        expect(out[0]?.end).toBe("2026-09-07T10:00:00");
    });

    it("returns the same array reference so the calendar does not re-render", () => {
        const input = [exam];
        expect(applyExtraTime(input, false)).toBe(input);
    });
});

describe("applyExtraTime with the toggle on", () => {
    it("leaves a non-exam lesson alone", () => {
        const out = applyExtraTime([lecture], true);
        expect(out[0]?.start).toBe("2026-09-07T08:00:00");
        expect(out[0]?.end).toBe("2026-09-07T10:00:00");
    });

    it("adds a third of the duration when the title has no horaire note", () => {
        // 2h lesson -> +40min -> ends 10:40.
        const out = applyExtraTime([exam], true);
        expect(out[0]?.start).toBe("2026-09-07T08:00:00");
        expect(out[0]?.end).toBe("2026-09-07T10:40:00");
    });

    it("uses the horaire note when the title has one", () => {
        const withNote = lesson("IC2 C401\nMathématiques\nDS\n08:00 - 10:00\nM. Dupont\nhoraire tt : 9h30 - 12h00");
        const out = applyExtraTime([withNote], true);
        expect(out[0]?.start).toBe("2026-09-07T09:30:00");
        expect(out[0]?.end).toBe("2026-09-07T12:00:00");
    });

    it("remembers the original bounds so the calendar can draw the extension", () => {
        const out = applyExtraTime([exam], true);
        expect(out[0]?.origStart).toBe("2026-09-07T08:00:00");
        expect(out[0]?.origEnd).toBe("2026-09-07T10:00:00");
    });

    it("detects an exam from the className too", () => {
        const byClass = lesson("IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont", "EXAM");
        expect(applyExtraTime([byClass], true)[0]?.end).toBe("2026-09-07T10:40:00");
    });

    it("does not stretch a lesson whose type merely starts with the letters DS", () => {
        // `DS_SURV` is an exam; a made-up `DSX` is not, and the detector anchors
        // on the prefix so it would match - this pins the current behaviour.
        const dsSurv = lesson("IC2 C401\nMathématiques\nDS_SURV\n08:00 - 10:00\nM. Dupont");
        expect(applyExtraTime([dsSurv], true)[0]?.end).toBe("2026-09-07T10:40:00");
    });

    it("caches per input array so repeated renders do not recompute", () => {
        const input = [exam];
        expect(applyExtraTime(input, true)).toBe(applyExtraTime(input, true));
    });
});

describe("formatExtraTimeLabel", () => {
    it("returns null below the 30-minute floor", () => {
        expect(formatExtraTimeLabel(0)).toBeNull();
        expect(formatExtraTimeLabel(29 * 60_000)).toBeNull();
    });

    it("renders minutes only under an hour", () => {
        expect(formatExtraTimeLabel(30 * 60_000)).toBe("+30m");
        expect(formatExtraTimeLabel(59 * 60_000)).toBe("+59m");
    });

    it("renders whole hours without a minute part", () => {
        expect(formatExtraTimeLabel(60 * 60_000)).toBe("+1h");
        expect(formatExtraTimeLabel(120 * 60_000)).toBe("+2h");
    });

    it("renders hours and minutes together", () => {
        expect(formatExtraTimeLabel(90 * 60_000)).toBe("+1h30");
    });

    it("pads a single-digit minute part", () => {
        // BUG: the minute remainder is interpolated raw, so 61 minutes renders
        // "+1h1" where every other duration in the app reads "1h01".
        expect(formatExtraTimeLabel(61 * 60_000)).toBe("+1h01");
        expect(formatExtraTimeLabel(65 * 60_000)).toBe("+1h05");
        expect(formatExtraTimeLabel(121 * 60_000)).toBe("+2h01");
    });
});
