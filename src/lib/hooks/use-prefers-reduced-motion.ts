import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
    // jsdom (the test environment) has no matchMedia at all.
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mql = window.matchMedia(QUERY);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
}

/** `false` in environments without matchMedia, and during SSR. */
function getServerSnapshot(): boolean {
    return false;
}

/**
 * Tracks the user's `prefers-reduced-motion` preference and re-renders when it
 * changes, so toggling the OS setting takes effect without a reload.
 *
 * This lives in its own module because the react-refresh lint rule forbids a
 * file from exporting both a component and a plain function.
 */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
