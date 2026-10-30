/**
 * W2-4 - the bottom nav loses the active tab on a trailing-slash URL.
 *
 * The bug: `getActive()` compared `location.pathname` with `===` against the
 * five tab paths. `/planning/` is the same route to React Router, so the
 * planning page rendered correctly, but the comparison missed and the function
 * fell through to its `return "home"` default. The user saw the Planning screen
 * while the nav highlighted "Accueil".
 *
 * Measured in the production build at 390x844: `/planning/`, `/grades/`,
 * `/absences/` and `/agenda/` all rendered their real page and all reported
 * `aria-current="page"` on Accueil. `/planning//` (double slash) behaved the
 * same way. Non-tab routes such as `/settings` correctly keep Accueil active,
 * which is why the fix must normalise the path rather than match by prefix.
 *
 * The fix normalises trailing slashes (and collapses repeats) before matching,
 * so a tab is active exactly when its own path is the current one.
 */
import { describe, expect, it } from "vitest";
import { resolveActiveTab } from "@/lib/utils/nav";

describe("W2-4 resolveActiveTab", () => {
    it("matches each tab at its canonical path", () => {
        expect(resolveActiveTab("/")).toBe("home");
        expect(resolveActiveTab("/planning")).toBe("calendar");
        expect(resolveActiveTab("/grades")).toBe("education");
        expect(resolveActiveTab("/absences")).toBe("profile");
        expect(resolveActiveTab("/agenda")).toBe("agenda");
    });

    it("matches each tab with one trailing slash", () => {
        expect(resolveActiveTab("/planning/")).toBe("calendar");
        expect(resolveActiveTab("/grades/")).toBe("education");
        expect(resolveActiveTab("/absences/")).toBe("profile");
        expect(resolveActiveTab("/agenda/")).toBe("agenda");
        expect(resolveActiveTab("/")).toBe("home");
    });

    it("matches each tab with repeated trailing slashes", () => {
        expect(resolveActiveTab("/planning//")).toBe("calendar");
        expect(resolveActiveTab("/grades///")).toBe("education");
        expect(resolveActiveTab("//")).toBe("home");
    });

    it("keeps Accueil active for non-tab routes", () => {
        expect(resolveActiveTab("/settings")).toBe("home");
        expect(resolveActiveTab("/associations")).toBe("home");
        expect(resolveActiveTab("/this-route-does-not-exist")).toBe("home");
    });

    it("does not treat a nested tab path as that tab", () => {
        // /planning/2026 is not a route the app defines; it renders NotFound.
        expect(resolveActiveTab("/planning/2026")).toBe("home");
    });
});
