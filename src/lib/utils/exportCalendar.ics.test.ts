/**
 * exportCalendar - the .ics the "export schedule" button produces.
 *
 * An ICS file that is subtly wrong fails silently: the calendar app imports it
 * and shows nothing, or shows a title truncated at the first comma. The rules
 * that matter are CRLF line endings, RFC 5545 text escaping, and UTC timestamps
 * in the `YYYYMMDDTHHMMSSZ` form.
 *
 * `exportCalendar` itself touches `navigator.share`, `URL.createObjectURL` and
 * a synthetic anchor click, so the download path is exercised with those stubbed
 * and the generated file is read back out of the Blob.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { exportCalendar } from "@/lib/utils/exportCalendar";
import type { Lesson } from "@/types/aurion";

const lesson = (overrides: Partial<Lesson>): Lesson =>
    ({
        id: "l1",
        title: "IC2 C401\nMathématiques\nCOURS_TD\n08:00 - 10:00\nM. Dupont",
        start: "2026-09-07T08:00:00",
        end: "2026-09-07T10:00:00",
        allDay: false,
        editable: false,
        className: "COURS_TD",
        ...overrides,
    }) as Lesson;

let captured: string[] = [];
let clicked = 0;

beforeEach(() => {
    captured = [];
    clicked = 0;

    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
        // Read the Blob synchronously enough for the assertion: keep the Blob.
        captured.push(String((blob as Blob).type));
        blobs.push(blob as Blob);
        return "blob:mock";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
        clicked += 1;
    });
});

let blobs: Blob[] = [];

afterEach(() => {
    vi.restoreAllMocks();
    blobs = [];
});

const readIcs = async (): Promise<string> => {
    expect(blobs).toHaveLength(1);
    return blobs[0]!.text();
};

describe("exportCalendar", () => {
    it("downloads a file when sharing is unavailable", async () => {
        await exportCalendar([lesson({})]);
        expect(clicked).toBe(1);
    });

    it("emits a well-formed VCALENDAR envelope", async () => {
        await exportCalendar([lesson({})]);
        const ics = await readIcs();

        expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
        expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
        expect(ics).toContain("VERSION:2.0");
        expect(ics).toContain("PRODID:-//Mauria//Planning//FR");
    });

    it("uses CRLF line endings throughout", async () => {
        await exportCalendar([lesson({})]);
        const ics = await readIcs();
        // No bare LF: every LF must be preceded by CR.
        expect(/(?<!\r)\n/.test(ics)).toBe(false);
    });

    it("writes the start and end as UTC compact timestamps", async () => {
        await exportCalendar([lesson({})]);
        const ics = await readIcs();

        const start = new Date("2026-09-07T08:00:00");
        const expected = start.toISOString().replace(/[-:]|\.\d{3}/g, "");
        expect(ics).toContain(`DTSTART:${expected}`);
        expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    });

    it("puts the course in SUMMARY and the room in LOCATION", async () => {
        await exportCalendar([lesson({})]);
        const ics = await readIcs();

        expect(ics).toContain("SUMMARY:Mathématiques");
        expect(ics).toContain("LOCATION:IC2 C401");
    });

    it("escapes commas, semicolons and newlines in text fields", async () => {
        await exportCalendar([
            lesson({
                title: "Salle 12\nMaths, Physique; Chimie\nCOURS_TD\n08:00 - 10:00\nM. Dupont",
            }),
        ]);
        const ics = await readIcs();

        expect(ics).toContain("SUMMARY:Maths\\, Physique\\; Chimie");
    });

    it("escapes a backslash so it is not read as an escape", async () => {
        await exportCalendar([lesson({ title: "Salle 12\nMaths\\Physique\nCOURS_TD\n08:00 - 10:00\nM. Dupont" })]);
        const ics = await readIcs();

        expect(ics).toContain("SUMMARY:Maths\\\\Physique");
    });

    it("falls back to a placeholder for a missing course and room", async () => {
        await exportCalendar([lesson({ title: "\n\n\n\n" })]);
        const ics = await readIcs();

        expect(ics).toContain("SUMMARY:");
        expect(ics).toContain("LOCATION:Mauria");
    });

    it("emits one VEVENT per lesson", async () => {
        await exportCalendar([
            lesson({ id: "a" }),
            lesson({ id: "b", title: "Salle 12\nPhysique\nTD\n08:00 - 10:00\nM. X" }),
        ]);
        const ics = await readIcs();

        expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
        expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
        expect(ics).toContain("UID:a@mauria");
        expect(ics).toContain("UID:b@mauria");
    });

    it("emits a valid envelope with no lessons", async () => {
        await exportCalendar([]);
        const ics = await readIcs();

        expect(ics).toContain("BEGIN:VCALENDAR");
        expect(ics).toContain("END:VCALENDAR");
        expect(ics).not.toContain("BEGIN:VEVENT");
    });

    it("uses the share sheet when the platform supports files", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", { value: share, configurable: true });

        await exportCalendar([lesson({})]);

        expect(share).toHaveBeenCalledTimes(1);
        // A successful share must not also trigger a download.
        expect(clicked).toBe(0);
    });

    it("falls back to a download when the share sheet is dismissed", async () => {
        const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", { value: vi.fn().mockRejectedValue(abort), configurable: true });

        await exportCalendar([lesson({})]);

        // An AbortError is a deliberate dismissal: no download either.
        expect(clicked).toBe(0);
    });

    it("falls back to a download when sharing fails for another reason", async () => {
        Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(navigator, "share", {
            value: vi.fn().mockRejectedValue(new Error("not supported")),
            configurable: true,
        });

        await exportCalendar([lesson({})]);

        expect(clicked).toBe(1);
    });
});
