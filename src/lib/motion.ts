import type { Variants } from "framer-motion";

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const EASE_EXIT: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.35, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_EXIT } },
};

export const staggerGroup: Variants = {
    hidden: {},
    show: { transition: { delayChildren: 0.02, staggerChildren: 0.04 } },
};

export const fadeInIndexed: Variants = {
    hidden: { opacity: 0 },
    show: (i = 0) => ({ opacity: 1, transition: { duration: 0.3, ease: EASE, delay: 0.02 + i * 0.05 } }),
    exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_EXIT } },
};

export const pageFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.12, ease: EASE },
};
