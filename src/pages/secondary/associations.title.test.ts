/**
 * W2-2 - association card titles overflow and are clipped mid-glyph.
 *
 * The bug: the card title was `<h3 className="flex min-h-[2.5rem] flex-1
 * items-center break-words ...">`. `flex-1` sets `flex: 1 1 0%`, but a flex
 * item's default `min-width` is `auto`, which resolves to min-content. A title
 * with no breakable space ("Dia'Erasmus/Dia'Rupture", "MADA
 * (Construisonspourmadagascar)") therefore refused to shrink, grew past its
 * container, and was cut off by the card's `overflow-hidden`.
 *
 * Measured in the production build at 390x844 on `/associations`, by comparing
 * each `<h3>`'s bounding box against its clipping ancestor:
 *   "Dia'Erasmus/Dia'Rupture"      h3 right=408  card right=374  (34px cut)
 *   "MADA (Construisonspourmadagascar)" h3 right=263 card right=189 (74px cut)
 *   "URCEAS (aide numérique intergénérationnelle)" right=384 card right=374
 * A 4x crop of the Dia'Erasmus card shows the glyph cut mid-character. The same
 * overflow reproduced at 320x568, and in the dark and oled themes.
 *
 * `break-words` alone cannot fix this: `overflow-wrap: break-word` does not
 * reduce an element's min-content contribution. The item must be allowed to
 * shrink (`min-w-0`) before wrapping can happen.
 *
 * NOTE: jsdom has no layout engine, so this test cannot measure the overflow
 * itself. It pins the class contract that makes the shrink possible; the visual
 * proof is the before/after browser screenshots recorded in w2-out/shots.
 */
import { describe, expect, it } from "vitest";
import {
    associationTitleBoxClass,
    associationTitleClass,
    associationTitleRowClass,
} from "@/pages/secondary/associations";

describe("W2-2 association title shrink contract", () => {
    it("does not make the heading a flex container", () => {
        // `display: flex` turns the text into an anonymous flex item, and
        // overflow-wrap does not apply to flex items — the title could never
        // wrap. Measured: 158px of text in a 115px box, 34px past the card.
        expect(associationTitleClass).not.toContain("flex");
        expect(associationTitleClass).toContain("block");
    });

    it("lets the heading shrink below its min-content width", () => {
        expect(associationTitleClass).toContain("min-w-0");
    });

    it("lets the wrapper box and row shrink too", () => {
        // Clearing only the heading left the ancestors' automatic minimum size
        // in place, so the overflow survived.
        expect(associationTitleBoxClass).toContain("min-w-0");
        expect(associationTitleRowClass).toContain("min-w-0");
    });

    it("keeps wrapping enabled so a long word breaks instead of clipping", () => {
        expect(associationTitleClass).toContain("break-words");
    });

    it("keeps the original typography and the vertical centring", () => {
        for (const cls of ["text-sm", "font-semibold", "leading-tight", "text-foreground"]) {
            expect(associationTitleClass, cls).toContain(cls);
        }
        // min-h + items-center moved to the wrapper so the heading can be block.
        expect(associationTitleBoxClass).toContain("min-h-[2.5rem]");
        expect(associationTitleBoxClass).toContain("items-center");
        expect(associationTitleBoxClass).toContain("flex-1");
    });

    it("keeps the row layout intact", () => {
        for (const cls of ["flex", "flex-1", "items-center", "gap-2", "text-left"]) {
            expect(associationTitleRowClass, cls).toContain(cls);
        }
    });

    it("does not rely on truncation, which would hide the title entirely", () => {
        expect(associationTitleClass).not.toContain("truncate");
        expect(associationTitleClass).not.toContain("line-clamp");
    });
});
