/**
 * date-time arithmetic - local-calendar semantics under a DST-having zone.
 *
 * `TZ` is pinned to Europe/Paris by vitest.config.ts, so these assertions are
 * about behaviour, not about the machine. The distinction that matters:
 *
 *   addDays(d, 1)        -> same wall clock tomorrow (setDate-based)
 *   new Date(ms + 864e5) -> same instant 24h later (wrong on a 23h/25h day)
 *
 * Every day/week/month helper here is built on `setDate`, so the whole app's
 * notion of "tomorrow" survives the two 2026 transitions. That is exactly what
 * the planning calendar bug was about, one layer down.
 */
import { describe, expect, it } from "vitest";
import {
    addDays,
    addHours,
    addMinutes,
    addMonths,
    endOfDay,
    endOfMonth,
    endOfWeek,
    format,
    isValid,
    parseISO,
    startOfDay,
    startOfHour,
    startOfMonth,
    startOfWeek,
    subDays,
    toISODate,
    toISODateTime,
} from "@/lib/utils/date-time";

describe("the timezone pin holds", () => {
    it("Europe/Paris is UTC+2 in July and UTC+1 in January", () => {
        expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
        expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
    });

    it("the 2026 transitions really are 23h and 25h long", () => {
        const hours = (y: number, m: number, d: number) =>
            (new Date(y, m, d + 1).getTime() - new Date(y, m, d).getTime()) / 3_600_000;
        expect(hours(2026, 2, 29)).toBe(23);
        expect(hours(2026, 9, 25)).toBe(25);
    });
});

describe("addDays keeps the wall clock across a DST transition", () => {
    it("23:30 on the 25h day becomes 23:30 the next day, not 22:30", () => {
        const before = new Date(2026, 9, 24, 23, 30);
        const after = addDays(before, 1);
        expect(after.getDate()).toBe(25);
        expect(after.getHours()).toBe(23);
        expect(after.getMinutes()).toBe(30);
    });

    it("a fixed 24h offset would land on 22:30 (documents the bug)", () => {
        const before = new Date(2026, 9, 24, 23, 30);
        const naive = new Date(before.getTime() + 86_400_000);
        expect(naive.getHours()).toBe(22);
    });

    it("steps back across the 23h day without losing the time", () => {
        const after = subDays(new Date(2026, 2, 30, 0, 30), 1);
        expect(after.getDate()).toBe(29);
        expect(after.getHours()).toBe(0);
        expect(after.getMinutes()).toBe(30);
    });

    it("is reversible", () => {
        const start = new Date(2026, 9, 24, 8, 15);
        expect(addDays(addDays(start, 1), -1).getTime()).toBe(start.getTime());
    });
});

describe("day boundaries", () => {
    const noon = new Date(2026, 8, 7, 14, 35, 12, 500);

    it("startOfDay and endOfDay bracket the local day", () => {
        expect(startOfDay(noon).getHours()).toBe(0);
        expect(startOfDay(noon).getDate()).toBe(7);
        expect(endOfDay(noon).getHours()).toBe(23);
        expect(endOfDay(noon).getMinutes()).toBe(59);
        expect(endOfDay(noon).getMilliseconds()).toBe(999);
    });

    it("startOfHour truncates minutes and seconds", () => {
        const hour = startOfHour(noon);
        expect(hour.getHours()).toBe(14);
        expect(hour.getMinutes()).toBe(0);
        expect(hour.getSeconds()).toBe(0);
    });

    it("startOfDay of an end-of-day value is the same day", () => {
        expect(toISODate(startOfDay(endOfDay(noon)))).toBe("2026-09-07");
    });
});

describe("week boundaries", () => {
    it("defaults to a Sunday week start", () => {
        expect(startOfWeek(new Date(2026, 8, 9)).getDay()).toBe(0);
    });

    it("honours weekStartsOn: 1", () => {
        const monday = startOfWeek(new Date(2026, 8, 9), { weekStartsOn: 1 });
        expect(monday.getDay()).toBe(1);
        expect(monday.getDate()).toBe(7);
    });

    it("endOfWeek is six days after the start, at end of day", () => {
        const end = endOfWeek(new Date(2026, 8, 9));
        expect(end.getDay()).toBe(6);
        expect(end.getHours()).toBe(23);
    });
});

describe("month boundaries", () => {
    it("clamps a 31st onto a shorter month instead of overflowing", () => {
        // 31 January + 1 month must be 28 February, not 3 March.
        expect(addMonths(new Date(2026, 0, 31), 1).getDate()).toBe(28);
        expect(addMonths(new Date(2026, 0, 31), 1).getMonth()).toBe(1);
    });

    it("clamps backwards too", () => {
        expect(addMonths(new Date(2026, 2, 31), -1).getDate()).toBe(28);
    });

    it("startOfMonth and endOfMonth bracket the month", () => {
        expect(startOfMonth(new Date(2026, 1, 10)).getDate()).toBe(1);
        expect(endOfMonth(new Date(2026, 1, 10)).getDate()).toBe(28);
    });
});

describe("parseISO", () => {
    it("parses a bare date as local midnight", () => {
        expect(parseISO("2026-09-07").getHours()).toBe(0);
        expect(parseISO("2026-09-07").getDate()).toBe(7);
    });

    it("parses a local datetime without an offset", () => {
        const d = parseISO("2026-09-07T08:30");
        expect(d.getHours()).toBe(8);
        expect(d.getMinutes()).toBe(30);
    });

    it("accepts an offset with and without the colon", () => {
        expect(parseISO("2026-09-07T08:30:15+0200").getTime()).toBe(
            parseISO("2026-09-07T08:30:15+02:00").getTime()
        );
    });

    it("rejects an impossible calendar date instead of rolling it over", () => {
        expect(Number.isNaN(parseISO("2026-02-30").getTime())).toBe(true);
        expect(Number.isNaN(parseISO("2026-13-01").getTime())).toBe(true);
        expect(Number.isNaN(parseISO("2026-09-00").getTime())).toBe(true);
    });

    it("rejects a non-date string", () => {
        expect(Number.isNaN(parseISO("garbage").getTime())).toBe(true);
    });

    it("returns the same instant on a repeated call (iso cache)", () => {
        const first = parseISO("2026-09-07T08:30:15+02:00").getTime();
        const second = parseISO("2026-09-07T08:30:15+02:00").getTime();
        expect(second).toBe(first);
    });
});

describe("isValid", () => {
    it("rejects null, undefined, garbage and Invalid Date", () => {
        expect(isValid(null)).toBe(false);
        expect(isValid(undefined)).toBe(false);
        expect(isValid("garbage")).toBe(false);
        expect(isValid(new Date(Number.NaN))).toBe(false);
    });

    it("accepts a real date in every input form", () => {
        const d = new Date(2026, 8, 7, 8, 0);
        expect(isValid(d)).toBe(true);
        expect(isValid(d.getTime())).toBe(true);
        expect(isValid("2026-09-07")).toBe(true);
    });
});

describe("formatting", () => {
    it("renders the tokens the app uses", () => {
        const d = new Date(2026, 8, 7, 14, 5, 3);
        expect(format(d, "yyyy-MM-dd")).toBe("2026-09-07");
        expect(format(d, "HH:mm:ss")).toBe("14:05:03");
        expect(format(d, "d/M/yy")).toBe("7/M/yy");
    });

    it("treats a quoted run as a literal", () => {
        expect(format(new Date(2026, 8, 7, 14, 5), "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-09-07T14:05:00");
    });

    it("returns 'Invalid Date' rather than throwing", () => {
        expect(format("garbage", "yyyy")).toBe("Invalid Date");
    });

    it("toISODate uses local parts, not UTC", () => {
        // 23:30 local is the next day in UTC for a UTC+n machine; the calendar
        // must still show it on the local day.
        expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
        expect(toISODateTime(new Date(2026, 8, 7, 8, 5, 3))).toBe("2026-09-07T08:05:03");
    });
});

describe("addHours is absolute, addDays is calendar", () => {
    it("addHours crosses the spring-forward gap by instant", () => {
        // 01:30 + 1h on the 23h day is 03:30 local: 02:30 does not exist.
        const result = addHours(new Date(2026, 2, 29, 1, 30), 1);
        expect(result.getHours()).toBe(3);
    });

    it("addMinutes is exact", () => {
        expect(addMinutes(new Date(2026, 8, 7, 8, 0), 90).getHours()).toBe(9);
        expect(addMinutes(new Date(2026, 8, 7, 8, 0), 90).getMinutes()).toBe(30);
    });
});
