import { MotionConfig } from "framer-motion";
import type React from "react";

import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

/**
 * WCAG 2.2 SC 2.3.3 — Animation from Interactions.
 *
 * framer-motion's own `reducedMotion="user"` only suppresses *transform*
 * animations; opacity, colour and filter still tween. Measured on
 * framer-motion 14.7.1 with the preference emulated, a 1s `x` + `opacity`
 * transition produced 2 distinct transform values (suppressed) but 58 distinct
 * opacity values (not suppressed). That is still motion animation under
 * SC 2.3.3, so the preference alone is not enough.
 *
 * `skipAnimations` jumps every animation straight to its target value. It is
 * the library's supported switch for this and, importantly, it keeps the
 * callback contract: `onAnimationComplete`, `onUpdate` and
 * `AnimatePresence`'s `onExitComplete` all still fire, so the reveal
 * overlays' state machines (which advance on completion) do not hang.
 */
export function MotionPreferences({ children }: { children?: React.ReactNode }) {
    const reduced = usePrefersReducedMotion();

    return (
        <MotionConfig reducedMotion="user" skipAnimations={reduced}>
            {children}
        </MotionConfig>
    );
}
