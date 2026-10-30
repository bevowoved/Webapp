/**
 * W2-3 - the important-message pagination controls are 12px tall tap targets.
 *
 * The bug: each page indicator was `<button className="group flex h-3 flex-1
 * cursor-pointer items-center">`. `h-3` is 12 CSS px, and the visible bar inside
 * it is 4px. WCAG 2.5.8 (Target Size Minimum, AA) requires 24x24 CSS px, and
 * this is a mobile-first app where the control is reached with a thumb.
 *
 * Measured in the production build at 390x844 and 1440x900 on `/` (five
 * important messages, so five indicators):
 *   button 64x12 at 390px wide, 274x12 at 1440px wide, inner bar 4px tall.
 * The same 12px height reproduced on `/preparing`, which shares the component.
 *
 * The fix keeps the bar visually 4px but gives the button a 24px hit area
 * (`h-6`), and pulls the surrounding margins in by the same amount so the
 * rendered layout is unchanged.
 *
 * NOTE: jsdom does not compute layout, so this test pins the class contract;
 * the measured before/after sizes come from the browser run recorded in
 * w2-out/ROUTE-MATRIX.md.
 */
import { describe, expect, it } from "vitest";
import { messageDotClass, messageDotRowClass } from "@/pages/home/sections";

describe("W2-3 message pagination target size", () => {
    it("gives the indicator a 24px-tall hit area", () => {
        expect(messageDotClass).toContain("h-6");
        expect(messageDotClass).not.toContain("h-3 ");
    });

    it("keeps the indicator full-width-flexible and clickable", () => {
        for (const cls of ["flex", "flex-1", "cursor-pointer", "items-center"]) {
            expect(messageDotClass, cls).toContain(cls);
        }
    });

    it("compensates the extra height so the row does not grow", () => {
        // h-6 is 12px taller than the old h-3; the row absorbs it with -my-1.5.
        expect(messageDotRowClass).toContain("-my-1.5");
    });

    it("keeps the row layout intact", () => {
        for (const cls of ["flex", "items-center", "gap-1.5"]) {
            expect(messageDotRowClass, cls).toContain(cls);
        }
    });
});
