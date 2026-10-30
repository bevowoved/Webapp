/**
 * DS placeholders and colles generation.
 *
 * Aurion emits a placeholder lesson ("DS selon planning") for exam days because
 * it does not know the subject. `resolveDsLessons` swaps those placeholders for
 * the real exams from the local table, and must leave every other lesson - and
 * every placeholder on a day with no known exam - untouched.
 *
 * `buildCollesLessons` turns the static khôlle grid into lessons. It is the
 * source of a whole extra calendar, so an off-by-one in the weekday or the week
 * index puts every khôlle on the wrong day.
 */
import { describe, expect, it } from "vitest";
import { resolveDsLessons } from "@/lib/utils/ds";
import { buildCollesLessons, getClassCollesLessons, getRoomCollesLessons, getTeacherCollesLessons } from "@/lib/utils/colles";
import type { Lesson } from "@/types/aurion";

const lesson = (id: string, title: string, start: string, end: string, className = "COURS_TD"): Lesson =>
    ({ id, title, start, end, allDay: false, editable: false, className }) as Lesson;

const placeholder = (start: string, end: string) => lesson("ph", "IC2 C854\nDS selon planning\nDS_SURV\n", start, end);

describe("resolveDsLessons", () => {
    it("replaces a placeholder on a known exam day with the real exam", () => {
        const out = resolveDsLessons([placeholder("2026-09-25T08:00:00", "2026-09-25T10:00:00")], "MPI");
        const exam = out.find((l) => l.id.startsWith("ds-"));
        expect(exam).toBeDefined();
        expect(exam?.title.split("\n")[1]).toBe("Maths 1");
        expect(exam?.start).toBe("2026-09-25T13:30:00");
        expect(exam?.className).toBe("DS_SURV");
    });

    it("drops the placeholder it replaced", () => {
        const out = resolveDsLessons([placeholder("2026-09-25T08:00:00", "2026-09-25T10:00:00")], "MPI");
        expect(out.some((l) => l.id === "ph")).toBe(false);
    });

    it("keeps a placeholder on a day with no known exam", () => {
        const out = resolveDsLessons([placeholder("2026-09-24T08:00:00", "2026-09-24T10:00:00")], "MPI");
        expect(out.map((l) => l.id)).toEqual(["ph"]);
    });

    it("keeps a non-placeholder lesson on a known exam day", () => {
        const normal = lesson("n1", "IC2 C401\nMaths\nCOURS_TD\n08:00 - 10:00\nM. X", "2026-09-25T08:00:00", "2026-09-25T10:00:00");
        const out = resolveDsLessons([normal], "MPI");
        expect(out.map((l) => l.id)).toEqual(["n1"]);
    });

    it("returns the input untouched for an unknown class", () => {
        const input = [placeholder("2026-09-25T08:00:00", "2026-09-25T10:00:00")];
        expect(resolveDsLessons(input, "NOPE")).toBe(input);
        expect(resolveDsLessons(input, null)).toBe(input);
    });

    it("emits both exams when a day has two", () => {
        // 2026-10-16 has a morning and an afternoon exam for MPI.
        const out = resolveDsLessons([placeholder("2026-10-16T08:00:00", "2026-10-16T10:00:00")], "MPI");
        const exams = out.filter((l) => l.id.startsWith("ds-"));
        expect(exams).toHaveLength(2);
        expect(exams.map((e) => e.start)).toEqual(["2026-10-16T08:00:00", "2026-10-16T13:30:00"]);
    });

    it("caches per input array and class", () => {
        const input = [placeholder("2026-09-25T08:00:00", "2026-09-25T10:00:00")];
        expect(resolveDsLessons(input, "MPI")).toBe(resolveDsLessons(input, "MPI"));
    });
});

describe("buildCollesLessons", () => {
    it("returns nothing without a class or a group", () => {
        expect(buildCollesLessons(null, "1C01")).toEqual([]);
        expect(buildCollesLessons("MP2I", null)).toEqual([]);
        expect(buildCollesLessons("NOPE", "1C01")).toEqual([]);
    });

    it("builds an hour-long lesson per slot", () => {
        const lessons = buildCollesLessons("MP2I", "1C01");
        expect(lessons.length).toBeGreaterThan(0);
        const first = lessons[0]!;
        const start = new Date(first.start);
        const end = new Date(first.end);
        expect(end.getTime() - start.getTime()).toBe(60 * 60_000);
    });

    it("marks the lesson as a colle so the calendar can style it", () => {
        expect(buildCollesLessons("MP2I", "1C01")[0]?.className).toBe("est-colle");
    });

    it("puts the room on the first title line, where parseFromTitle looks", () => {
        const first = buildCollesLessons("MP2I", "1C01")[0]!;
        expect(first.title.split("\n")[0]).toMatch(/^IC2 /);
    });

    it("ids are unique across the whole group", () => {
        const ids = buildCollesLessons("MP2I", "1C01").map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("gives different groups different lessons", () => {
        const a = buildCollesLessons("MP2I", "1C01").map((l) => l.id).join();
        const b = buildCollesLessons("MP2I", "1C02").map((l) => l.id).join();
        expect(a).not.toBe(b);
    });
});

describe("colles lookup by class, room and teacher", () => {
    it("finds a class by its label", () => {
        expect(getClassCollesLessons("MP2I").length).toBeGreaterThan(0);
    });

    it("finds a class named inside a longer label", () => {
        expect(getClassCollesLessons("CPG1 MP2I")).toHaveLength(getClassCollesLessons("MP2I").length);
    });

    it("returns nothing for a label that names no class", () => {
        expect(getClassCollesLessons("CPG1")).toEqual([]);
        expect(getClassCollesLessons("")).toEqual([]);
    });

    it("finds colles by room, ignoring case and accents", () => {
        expect(getRoomCollesLessons("IC2 C403").length).toBeGreaterThan(0);
        expect(getRoomCollesLessons("ic2 c403").length).toBe(getRoomCollesLessons("IC2 C403").length);
    });

    it("returns nothing for an empty or unknown room", () => {
        expect(getRoomCollesLessons("")).toEqual([]);
        expect(getRoomCollesLessons("nowhere")).toEqual([]);
    });

    it("finds colles by teacher surname, with or without the title", () => {
        const bySurname = getTeacherCollesLessons("Mullier");
        expect(bySurname.length).toBeGreaterThan(0);
        expect(getTeacherCollesLessons("M. Mullier")).toHaveLength(bySurname.length);
    });

    it("does not duplicate a lesson matched by two tokens", () => {
        const lessons = getTeacherCollesLessons("M. Mullier");
        expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    });

    it("returns nothing for an empty teacher", () => {
        expect(getTeacherCollesLessons("")).toEqual([]);
    });
});
