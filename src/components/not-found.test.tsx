/**
 * Unknown URLs must render inside the app shell, not as a blank page.
 *
 * Before the catch-all route existed, an unrecognised path matched no `<Route>`
 * at all. React Router rendered nothing: no header, no navigation, no way back.
 * The route boundary could not catch it because nothing threw — the shell was
 * never mounted — so this needs a route-level test, not an error-boundary one.
 *
 * Note: `@testing-library/jest-dom` is not a dependency here, so these use plain
 * assertions on DOM output rather than `toBeInTheDocument`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router";
import { NotFound } from "@/components/not-found";
import appSource from "@/App.tsx?raw";

// globals: false means Testing Library's auto-cleanup never registers itself,
// so rendered trees accumulate in document.body across tests. Clean up explicitly.
afterEach(cleanup);


function LocationProbe() {
    const { pathname } = useLocation();
    return (
        <>
            <output data-testid="pathname">{pathname}</output>
            <Outlet />
        </>
    );
}

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {/* The probe is a layout route so it stays mounted throughout and
                    every test can read the current location. */}
                <Route element={<LocationProbe />}>
                    <Route path="/" element={<section aria-label="home stub" />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );

describe("NotFound", () => {
    it("renders a message rather than nothing", () => {
        const { container } = renderAt("/this-route-does-not-exist");
        // The pre-fix behaviour was an empty body, so "non-empty" is the assertion.
        expect(container.textContent?.trim()).toBeTruthy();
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(container.textContent).toMatch(/Page introuvable|not found/i);
    });

    it("shows the offending path so the user can see what went wrong", () => {
        const { container } = renderAt("/a/very/unknown/path");
        expect(container.textContent).toContain("/a/very/unknown/path");
    });

    it("offers a working way home", () => {
        const { container } = renderAt("/nowhere");
        const buttons = Array.from(container.querySelectorAll("button"));
        const home = buttons.find((b) => /accueil|home/i.test(b.textContent ?? ""));
        expect(home, "a go-home button must exist").toBeTruthy();
        fireEvent.click(home!);
        expect(screen.getByTestId("pathname").textContent).toBe("/");
    });

    it("is the catch-all, nested inside the layout route", () => {
        // A shallow render cannot express route nesting, so assert on the source.
        // The nesting is what keeps the header, sidebar and bottom nav mounted;
        // a sibling `<Route path="*">` would still leave the user with only the
        // not-found message and no navigation.
        const at = appSource.indexOf('path="*"');
        expect(at, "catch-all route must exist").toBeGreaterThan(-1);
        expect(appSource.slice(at, at + 60)).toContain("<NotFound />");

        const layout = appSource.indexOf("<RootLayout />");
        expect(layout, "layout route must exist").toBeGreaterThan(-1);
        // The catch-all comes after the layout route opens ...
        expect(at).toBeGreaterThan(layout);
        // ... and before that layout route closes. Between the two there must be
        // no `</Routes>`, which would mean the catch-all fell outside the tree.
        const between = appSource.slice(layout, at);
        expect(between).not.toContain("</Routes>");
        // Exactly one closing `</Route>` boundary may separate them: none, since
        // the layout's own element is what opened. Any `</Route>` here would mean
        // we already left the layout block.
        expect(between).not.toContain("</Route>\n                >");
    });
});


