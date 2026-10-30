/**
 * B1 - absence date survives rendering.
 *
 * The original card destructured the raw date and then read `year.length`:
 *
 *     const [day, month, year] = absence.date.split("/");
 *     const fullYear = year.length === 2 ? ... : parseInt(year);
 *
 * A date with no slash leaves `year` undefined, so `year.length` threw
 * `TypeError: Cannot read properties of undefined (reading 'length')` during
 * render and took the whole absences list down with it.
 *
 * The companion file `grades.absence-date.test.ts` only exercises `parseFrDate`,
 * which already existed before the fix, so it passes on the broken code and
 * guards nothing. This file renders the card itself, which is where the bug was.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AbsenceCard, AbsenceCardAnimate } from "@/pages/absences/absences-card";
import type { Absence } from "@/types/aurion";

const absence = (overrides: Partial<Absence>): Absence => ({
    date: "05/01/2026",
    type: "Justifiée",
    duration: "2:00",
    time: "08:00 - 10:00",
    class: "IC2 C401",
    teacher: "M. Dupont",
    ...overrides,
});

const MALFORMED = [
    "",
    "not a date",
    "2026-01-05", // ISO, not French
    "05/01", // too few parts -> year undefined in the old code
    "05/01/2026/extra", // too many parts
    "//",
    "aa/bb/cccc",
];

describe("AbsenceCard renders malformed dates without throwing", () => {
    it.each(MALFORMED)("renders date %j", (raw) => {
        expect(() => render(<AbsenceCard absence={absence({ date: raw })} />)).not.toThrow();
    });

    it.each(MALFORMED)("renders the animated variant with date %j", (raw) => {
        expect(() =>
            render(<AbsenceCardAnimate absence={absence({ date: raw })} />)
        ).not.toThrow();
    });

    it("falls back to the raw string when the date cannot be parsed", () => {
        const { container } = render(<AbsenceCard absence={absence({ date: "05/01" })} />);
        // The date and time share one line, separated by ", ".
        expect(container.textContent).toContain("05/01");
        expect(container.textContent).not.toContain("NaN");
    });

    it("formats a valid French date rather than showing it raw", () => {
        const { container } = render(<AbsenceCard absence={absence({ date: "05/01/2026" })} />);
        expect(container.textContent).not.toContain("05/01/2026");
        // "lundi 5 janv." in fr-FR.
        expect(container.textContent).toMatch(/5\s+janv\./);
    });

    it("still renders the rest of the card for a broken date", () => {
        const { container } = render(<AbsenceCard absence={absence({ date: "nope" })} />);
        // A card whose date failed must not lose its type/class/time.
        expect(container.textContent).toContain("IC2 C401");
        expect(container.textContent).toContain("Justifiée");
        expect(container.textContent).toContain("08:00 - 10:00");
        expect(container.textContent).toContain("nope");
    });
});
