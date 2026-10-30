/**
 * Bottom-navigation path resolution.
 *
 * Lives outside `bottom-navigation.tsx` because the component file may only
 * export components and constants (react-refresh/only-export-components), and
 * this is a function. Keeping it separate also makes it testable without
 * mounting the router.
 */

const TAB_BY_PATH: Record<string, string> = {
    "/": "home",
    "/planning": "calendar",
    "/grades": "education",
    "/absences": "profile",
    "/agenda": "agenda",
};

/**
 * Which bottom-nav tab is active for a pathname.
 *
 * React Router treats `/planning/` and `/planning` as the same route, so the
 * comparison here must too. Matching the raw pathname with `===` meant a
 * trailing-slash URL rendered the Planning screen while the nav highlighted
 * Accueil — the fallthrough default. Trailing slashes (including repeats) are
 * collapsed first, and anything that is not one of the five tab paths stays on
 * Accueil, so nested or unknown routes do not light up a tab they do not own.
 */
export function resolveActiveTab(pathname: string): string {
    const normalized = pathname.replace(/\/+$/, "") || "/";
    return TAB_BY_PATH[normalized] ?? "home";
}
