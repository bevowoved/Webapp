/**
 * Aurion lesson titles are newline-delimited blobs, not structured data:
 *
 *   line 0  location
 *   line 1  course
 *   line 2  type code
 *   line 3  "HH:mm - HH:mm"
 *   line 4  teacher
 *   line 5  optional "horaire tt : ..." note
 *
 * `parseFromTitle` is the only thing standing between that blob and every
 * surface that shows a lesson (calendar, drawer, widget, ICS export). When it
 * picks the wrong line the user sees a time where the teacher belongs, or a
 * teacher where the type belongs. These tests pin the line selection for each
 * shape Aurion actually emits, plus the compact 2-3 line shapes.
 */
import { describe, expect, it } from "vitest";
import {
    abbreviateSubjects,
    formatElapsed,
    formatLessonCourse,
    formatLessonLocation,
    formatLessonTeacher,
    parseFromTitle,
} from "@/lib/utils/home";
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

describe("parseFromTitle line selection", () => {
    it("reads the 4-line shape (location, course, type, teacher)", () => {
        const parsed = parseFromTitle(lesson("IC2 C401\nMathématiques\nCOURS_TD\nM. Dupont"));
        expect(parsed).toEqual({
            courseTitle: "Mathématiques",
            location: "IC2 C401",
            type: "COURS_TD",
            teacher: "M. Dupont",
        });
    });

    it("does not mistake the time line for the type in the 5-line shape", () => {
        const parsed = parseFromTitle(lesson("IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont"));
        expect(parsed.type).toBe("COURS_TD");
        expect(parsed.teacher).toBe("M. Dupont");
        expect(parsed.courseTitle).toBe("Mathématiques");
    });

    it("strips a trailing `horaire tt` note so the note is not read as the teacher", () => {
        const parsed = parseFromTitle(
            lesson("IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont\nhoraire tt : 8h00 - 10h00")
        );
        expect(parsed.teacher).toBe("M. Dupont");
        expect(parsed.type).toBe("COURS_TD");
    });

    it("strips a `horaire tt` note even when there is no time line", () => {
        const parsed = parseFromTitle(lesson("IC2 C401\nMathématiques\nCOURS_TD\nM. Dupont\nhoraire tt: 8h00-10h00"));
        expect(parsed.teacher).toBe("M. Dupont");
        expect(parsed.courseTitle).toBe("Mathématiques");
    });

    it("translates a type code that appears in the course slot", () => {
        // Some Aurion exports put the code on line 1 and the label on line 2.
        const parsed = parseFromTitle(lesson("IC2 C401\nCOURS_TD\nTD\n08:00 - 10:00\nM. Dupont"));
        expect(parsed.courseTitle).toBe("Cours");
        expect(parsed.type).toBe("TD");
    });

    it("falls back to the compact 2-line shape", () => {
        const parsed = parseFromTitle(lesson("Salle 12\nPhysique"));
        expect(parsed.location).toBe("Salle 12");
        expect(parsed.courseTitle).toBe("Physique");
        expect(parsed.type).toBe("COURS_TD");
    });

    it("uses the lesson className as the type when no type line exists", () => {
        const parsed = parseFromTitle(lesson("Salle 12\nPhysique\nTD", "CM"));
        expect(parsed.type).toBe("TD");
        expect(parseFromTitle(lesson("Salle 12\nPhysique", "CM")).type).toBe("CM");
    });

    it("never throws and never invents a teacher for a single-line title", () => {
        const parsed = parseFromTitle(lesson("just one line"));
        expect(parsed.courseTitle).toBe("just one line");
        expect(parsed.teacher).toBe("");
    });
});

describe("formatLessonLocation", () => {
    it("puts the campus before the room when the room is a `salle`", () => {
        expect(formatLessonLocation("Salle C401, IC2")).toBe("IC2 C401");
    });

    it("does not repeat a campus that is already part of the room name", () => {
        expect(formatLessonLocation("Salle IC2C401, IC2")).toBe("IC2C401");
    });

    it("drops the trailing building/year suffix and the underscores", () => {
        expect(formatLessonLocation("IC2_C401_2026A")).toBe("IC2 C401");
    });

    it("keeps only the first segment of a multi-part location", () => {
        expect(formatLessonLocation("Bâtiment A, Salle 12")).toBe("Bâtiment A");
    });
});

describe("formatLessonCourse", () => {
    it("strips the semester suffix", () => {
        expect(formatLessonCourse("Mathématiques - 1er semestre")).toBe("Mathématiques");
        expect(formatLessonCourse("Mathématiques - 2ème semestre")).toBe("Mathématiques");
    });

    it("leaves a course without a semester suffix untouched", () => {
        expect(formatLessonCourse("Mathématiques")).toBe("Mathématiques");
    });
});

describe("abbreviateSubjects", () => {
    it("abbreviates a subject that starts a word", () => {
        expect(abbreviateSubjects("Informatique")).toBe("Info");
        expect(abbreviateSubjects("Sciences Industrielles")).toBe("SII");
        expect(abbreviateSubjects("Mon informatique appliquée")).toBe("Mon Info appliquée");
    });

    it("does not abbreviate a subject embedded inside a longer word", () => {
        expect(abbreviateSubjects("Xinformatique")).toBe("Xinformatique");
    });

    it("does not abbreviate a subject that is only a prefix of the word", () => {
        // BUG: the pattern is anchored at the start of a word but not at the
        // end, so `anglais` matches the first seven letters of "Anglaise" and
        // leaves a stray "e": "Civilisation Angl.e".
        expect(abbreviateSubjects("Civilisation Anglaise")).toBe("Civilisation Anglaise");
        expect(abbreviateSubjects("Littérature anglaise")).toBe("Littérature anglaise");
        expect(abbreviateSubjects("Espagnole")).toBe("Espagnole");
        expect(abbreviateSubjects("Allemande")).toBe("Allemande");
    });

    it("still abbreviates the exact subject word", () => {
        expect(abbreviateSubjects("Anglais")).toBe("Angl.");
        expect(abbreviateSubjects("Espagnol")).toBe("Esp.");
        expect(abbreviateSubjects("Allemand")).toBe("All.");
    });
});

describe("formatLessonTeacher", () => {
    it("shortens Monsieur and Madame anywhere in the string", () => {
        expect(formatLessonTeacher("Monsieur Dupont et Madame Martin")).toBe("M. Dupont et Mme Martin");
        expect(formatLessonTeacher("monsieur X")).toBe("M. X");
    });
});

describe("formatElapsed", () => {
    const base = new Date(2026, 0, 5, 12, 0, 0).getTime();
    const ago = (minutes: number) => formatElapsed(new Date(base - minutes * 60_000).toISOString(), base);

    it("reports sub-minute, minute, hour and hour+minute spans", () => {
        expect(ago(0)).toBe("<1 min");
        expect(ago(1)).toBe("1 min");
        expect(ago(59)).toBe("59 min");
        expect(ago(60)).toBe("1 h");
        expect(ago(61)).toBe("1 h 1 min");
        expect(ago(90)).toBe("1 h 30 min");
    });

    it("never reports a negative span for a future timestamp", () => {
        expect(formatElapsed(new Date(base + 60 * 60_000).toISOString(), base)).toBe("<1 min");
    });
});
