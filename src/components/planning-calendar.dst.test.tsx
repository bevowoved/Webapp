/**
 * C1 - DST day boundary in the planning calendar.
 *
 * The bug: the day window was `new Date(day.getTime() + 86_400_000)`. On a DST
 * transition day the local day is 23h or 25h long, so a fixed 24h offset puts
 * the window edge at the wrong wall-clock time.
 *
 * Measured on Europe/Paris, 2026 (asserted below):
 *   2026-03-29 (Sun, spring forward, 23h day): 00:00 + 24h = 01:00 next day
 *     -> the NEXT day's 00:30 lesson leaks into the 29th's column
 *   2026-10-25 (Sun, fall back, 25h day): 00:00 + 24h = 23:00 same day
 *     -> the 25th's 23:30 lesson is dropped
 *
 * Both 2026 transitions fall on a Sunday and the week view renders Mon-Fri
 * only, so the bug is reachable only in the single-day view.
 *
 * The clock is pinned with fake timers so the calendar's anchor is exact. Both
 * target dates are Sundays, and the component anchors a Sunday to the following
 * Monday, so each test steps back exactly one day.
 *
 * The fix uses `addDays(day, 1)`, which is `setDate`-based and therefore lands
 * on the next local midnight regardless of DST.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { PlanningCalendar } from "@/components/planning-calendar";
import type { Lesson } from "@/types/aurion";

// TZ is pinned to Europe/Paris by vitest.config.ts (`test.env`), so no
// process.env access is needed here and the app tsconfig stays node-free.

beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

const lesson = (id: string, start: Date, end: Date): Lesson =>
    ({
        id,
        title: `Lesson ${id}`,
        start: start.toISOString(),
        end: end.toISOString(),
        className: "est-cours",
    }) as unknown as Lesson;

const renderCalendar = (lessons: Lesson[]) =>
    render(
        <I18nextProvider i18n={i18n}>
            <PlanningCalendar lessons={lessons} />
        </I18nextProvider>
    );

const dayTitle = () => document.querySelector(".pcal-title")?.textContent?.trim() ?? "";

const switchToDayView = () => {
    fireEvent.click(screen.getByRole("button", { name: "Jour" }));
};

const stepBack = (n: number) => {
    for (let i = 0; i < n; i++) fireEvent.click(screen.getByLabelText("previous"));
};

const eventTitles = (): string[] =>
    [...document.querySelectorAll("[data-event]")].map((el) => el.textContent ?? "");

describe("C1 DST day boundary", () => {
    it("timezone is Europe/Paris (every other assertion depends on this)", () => {
        expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    });

    it("confirms the day-length asymmetry the bug depends on", () => {
        const len = (y: number, m: number, d: number) =>
            (new Date(y, m, d + 1).getTime() - new Date(y, m, d).getTime()) / 3_600_000;
        // Spring forward: 23h. Fall back: 25h. If these ever become 24h this
        // file stops being a DST test and should be revisited.
        expect(len(2026, 2, 29)).toBe(23);
        expect(len(2026, 9, 25)).toBe(25);
    });

    it("2026-10-25 (25h day): a 23:30 lesson IS shown in that day's column", () => {
        // Pin midnight so the anchor's time-of-day is 00:00 and the day window
        // is midnight-to-midnight. The component keeps the anchor's clock time,
        // so a noon anchor would move the window edge and change which lessons
        // sit in the 1-hour band where this bug lives.
        vi.setSystemTime(new Date(2026, 9, 25, 0, 0, 0));
        const late = lesson("late", new Date(2026, 9, 25, 23, 30), new Date(2026, 9, 25, 23, 55));
        renderCalendar([late]);
        switchToDayView();
        // Sunday anchors to Monday, so step back once to land on the 25th.
        stepBack(1);
        expect(dayTitle()).toBe("dimanche 25 oct.");

        // Fixed window ends at 2026-10-26 00:00 -> included.
        // Buggy window ends at 2026-10-25 23:00 -> dropped.
        expect(eventTitles().some((t) => t.includes("Lesson late"))).toBe(true);
    });

    it("2026-03-29 (23h day): the next day's 00:30 lesson is NOT shown", () => {
        vi.setSystemTime(new Date(2026, 2, 29, 0, 0, 0));
        const nextDayEarly = lesson(
            "nextday",
            new Date(2026, 2, 30, 0, 30),
            new Date(2026, 2, 30, 1, 30)
        );
        renderCalendar([nextDayEarly]);
        switchToDayView();
        stepBack(1);
        expect(dayTitle()).toBe("dimanche 29 mars");

        // Fixed window ends at 2026-03-30 00:00 -> excluded.
        // Buggy window ends at 2026-03-30 01:00 -> wrongly included.
        expect(eventTitles().some((t) => t.includes("Lesson nextday"))).toBe(false);
    });
});
