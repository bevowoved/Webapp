/**
 * W2-1 - the planning "last updated" label renders the epoch on a cold cache.
 *
 * The bug: the label formatted `new Date(dataUpdatedAt)` unconditionally.
 * TanStack Query reports `dataUpdatedAt === 0` until the query has resolved
 * successfully, and 0 is a *valid* epoch, so `format()` happily produced
 * "jeudi 1 janv. 01h00" (Europe/Paris, epoch + 1h). Measured in the production
 * build at 390x844 and 1440x900 on `/planning` with a cold cache: the label read
 * "Dernière mise à jour : jeudi 1 janv. 01h00" while the calendar was still
 * loading. Once the fixture resolved, the label was correct, which is what
 * pins the cause to the sentinel `0` rather than to the formatter.
 *
 * The fix routes the label through `formatLastUpdated()`, which treats a
 * non-positive timestamp as "unknown" and returns null so the caller can omit
 * the line instead of printing a fabricated 1970 date.
 */
import { describe, expect, it } from "vitest";
import { formatLastUpdated } from "@/lib/utils/date-time";

describe("W2-1 formatLastUpdated", () => {
    it("returns null for the TanStack 'never updated' sentinel 0", () => {
        expect(formatLastUpdated(0)).toBeNull();
    });

    it("returns null for negative and non-finite timestamps", () => {
        expect(formatLastUpdated(-1)).toBeNull();
        expect(formatLastUpdated(Number.NaN)).toBeNull();
        expect(formatLastUpdated(Number.POSITIVE_INFINITY)).toBeNull();
    });

    it("returns null for undefined/null so callers can omit the label", () => {
        expect(formatLastUpdated(undefined)).toBeNull();
        expect(formatLastUpdated(null)).toBeNull();
    });

    it("formats a real timestamp in French, matching the shipped pattern", () => {
        // 2026-10-27T14:05 local (Europe/Paris, pinned by vitest.config.ts).
        const at = new Date(2026, 9, 27, 14, 5, 0, 0).getTime();
        expect(formatLastUpdated(at, "fr")).toBe("mardi 27 oct. 14h05");
    });

    it("never emits the epoch for the sentinel", () => {
        const out = formatLastUpdated(0, "fr");
        expect(out).toBeNull();
        expect(String(out)).not.toContain("janv");
        expect(String(out)).not.toContain("1970");
    });
});
