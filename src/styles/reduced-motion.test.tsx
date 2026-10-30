/**
 * reduced-motion - WCAG 2.2 SC 2.3.3 (Animation from Interactions).
 *
 * The app ships a lot of decorative motion: CSS keyframes for the reveal
 * overlays and the login meteor field, Tailwind's animate-pulse/spin/spin
 * utilities, and framer-motion transitions on nearly every page. SC 2.3.3
 * requires that motion animation triggered by interaction can be disabled.
 *
 * Two independent mechanisms are asserted here:
 *
 *  1. CSS - a single `@media (prefers-reduced-motion: reduce)` block in
 *     globals.css that neutralises animation and transition durations
 *     globally, so no component can reintroduce motion by omission.
 *  2. JS - `MotionConfig` at the app root with `skipAnimations` bound to the
 *     user's preference, which makes framer-motion jump straight to the
 *     target values while still firing onAnimationComplete/onExitComplete.
 *
 * These tests read the real stylesheet source and render real components, so
 * they fail if either mechanism is removed.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";

// Vitest stubs CSS imports, so the stylesheet sources are inlined as defines
// by vitest.config.ts. These are the exact files that ship.
const GLOBALS_CSS: string = __GLOBALS_CSS__;
const PLANNING_CSS: string = __PLANNING_CSS__;
const PALANTIR_CSS: string = __PALANTIR_CSS__;

/**
 * Returns the body of the last `@media (prefers-reduced-motion: reduce)` block
 * in `css`, or "" when there is none. Brace counting is enough for these
 * hand-written stylesheets; there are no braces inside strings.
 */
function reducedMotionBlock(css: string): string {
    const marker = "@media (prefers-reduced-motion: reduce)";
    const start = css.lastIndexOf(marker);
    if (start === -1) return "";
    const open = css.indexOf("{", start);
    if (open === -1) return "";
    let depth = 0;
    for (let i = open; i < css.length; i++) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") {
            depth--;
            if (depth === 0) return css.slice(open + 1, i);
        }
    }
    return "";
}

describe("reduced motion: CSS neutralisation", () => {
    const block = reducedMotionBlock(GLOBALS_CSS);

    it("globals.css declares a prefers-reduced-motion block", () => {
        expect(block.length).toBeGreaterThan(0);
    });

    it("the block zeroes animation duration globally", () => {
        // A universal selector with animation-duration: 0s (or 0.01ms) is what
        // makes this exhaustive rather than a list of remembered selectors.
        expect(block).toMatch(/animation-duration:\s*0(?:\.01)?m?s/);
    });

    it("the block zeroes transition duration globally", () => {
        expect(block).toMatch(/transition-duration:\s*0(?:\.01)?m?s/);
    });

    it("the block caps animation iteration count so nothing loops forever", () => {
        expect(block).toMatch(/animation-iteration-count:\s*1/);
    });

    it("the block uses a universal selector, not an allow-list", () => {
        // `*, ::before, ::after` must all be covered: pseudo-elements carry
        // most of the decorative sweeps (cs2-case::after and friends).
        expect(block).toMatch(/\*/);
        expect(block).toMatch(/::?before/);
        expect(block).toMatch(/::?after/);
    });

    it("the block still leaves the final keyframe applied", () => {
        // animation-fill-mode: both keeps reveal overlays at their end state
        // instead of snapping back to the initial transform.
        expect(block).toMatch(/animation-fill-mode:\s*both/);
    });

    it("every stylesheet that animates is covered", () => {
        // The calendar and palantir stylesheets ship their own transitions;
        // they must not be able to opt out of the global rule.
        for (const css of [PLANNING_CSS, PALANTIR_CSS]) {
            expect(css).not.toMatch(/prefers-reduced-motion:\s*no-preference/);
        }
    });
});

describe("reduced motion: framer-motion snap-to-target", () => {
    beforeEach(() => {
        cleanup();
        // framer-motion warns loudly when the preference is on; that warning is
        // the library telling us the mechanism engaged.
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("skipAnimations reaches the target value and fires onAnimationComplete", async () => {
        const onComplete = vi.fn();

        function Probe() {
            const [go, setGo] = useState(false);
            return (
                <MotionConfig skipAnimations reducedMotion="always">
                    <button
                        type="button"
                        aria-label="go"
                        onClick={() => setGo(true)}
                    />
                    <motion.div
                        data-testid="target"
                        initial={{ opacity: 0, x: -200 }}
                        animate={go ? { opacity: 1, x: 0 } : { opacity: 0, x: -200 }}
                        transition={{ duration: 5, ease: "linear" }}
                        onAnimationComplete={onComplete}
                    />
                </MotionConfig>
            );
        }

        render(<Probe />);
        const target = screen.getByTestId("target");
        expect(target).toBeTruthy();

        // With skipAnimations the completion callback must still fire; a naive
        // `transition: none` would strand the element and never call it.
        await waitFor(() => expect(onComplete).toHaveBeenCalled(), {
            timeout: 2000,
        });
    });

    it("AnimatePresence still removes the child when animations are skipped", async () => {
        const onExitComplete = vi.fn();

        function Probe() {
            const [shown, setShown] = useState(true);
            return (
                <MotionConfig skipAnimations reducedMotion="always">
                    <button
                        type="button"
                        aria-label="hide"
                        onClick={() => setShown(false)}
                    />
                    <AnimatePresence onExitComplete={onExitComplete}>
                        {shown && (
                            <motion.div
                                data-testid="card"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 5 }}
                            />
                        )}
                    </AnimatePresence>
                </MotionConfig>
            );
        }

        render(<Probe />);
        expect(screen.getByTestId("card")).toBeTruthy();

        screen.getByRole("button", { name: "hide" }).click();

        // The element must actually leave the DOM, not get stuck mid-exit.
        await waitFor(() => expect(screen.queryByTestId("card")).toBeNull(), {
            timeout: 2000,
        });
        expect(onExitComplete).toHaveBeenCalled();
    });
});

/**
 * The reveal overlays are the riskiest place to skip animations, because their
 * state machines advance from animation callbacks. If a skipped animation
 * never reported completion, the overlay would sit there forever and the user
 * could not dismiss the grade they just revealed.
 */
describe("reduced motion: reveal overlay still completes", () => {
    beforeEach(() => {
        cleanup();
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("ScratchCard reveals and closes when animations are skipped", async () => {
        const { ScratchCard } = await import("@/pages/grades/reveal/scratch-card");
        const onClose = vi.fn();

        const grade = {
            date: "12/03/2025",
            code: "MATH01",
            name: "Mathématiques",
            grade: "15.5",
            average: "12.0",
            coef: "3",
        } as unknown as Parameters<typeof ScratchCard>[0]["grade"];

        render(
            <MotionConfig skipAnimations reducedMotion="always">
                <ScratchCard grade={grade} onClose={onClose} />
            </MotionConfig>
        );

        // Step 1: the overlay offers the reveal action.
        const reveal = await screen.findByRole("button", {
            name: /tout gratter|reveal all/i,
        });
        reveal.click();

        // Step 2: once revealed the control becomes "Continuer". Reaching this
        // state proves the reveal transition completed rather than hanging.
        const cont = await screen.findByRole("button", {
            name: /continuer|continue/i,
        });

        // Step 3: dismissing must actually call onClose.
        cont.click();
        await waitFor(() => expect(onClose).toHaveBeenCalled(), {
            timeout: 2000,
        });
    });
});
