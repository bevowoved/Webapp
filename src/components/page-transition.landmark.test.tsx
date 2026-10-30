/**
 * W2-5 - the pre-shell routes render no main landmark.
 *
 * The bug: `/login`, `/welcome` and `/campus` sit outside `RootLayout`, so they
 * never inherit its `<main>`. Each page wrapped its content in `<PageTransition>`
 * without `as="main"`, and that component defaults to `as="div"`. The document
 * therefore had a header, a form and a heading but no main landmark: screen
 * reader landmark navigation found nothing, and there is no skip-to-content
 * target. `PageTransition` already supported `as="main"`; the pages simply never
 * asked for it.
 *
 * Measured in the production build at 390x844 and 1440x900:
 *   /welcome  hasMain=false   /campus hasMain=false   /login hasMain=false
 * Every in-shell route reported hasMain=true, and `/preparing` reported true
 * because it redirects into the shell once its prefetch settles.
 *
 * The fix passes `as="main"` on those three pages. The shell keeps rendering
 * its own `<main>` and never uses PageTransition's default, so a document still
 * has exactly one main landmark.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nextProvider } from "react-i18next";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import { LoginPage } from "@/pages/secondary/login";
import { WelcomePage } from "@/pages/secondary/welcome";
import { CampusPage } from "@/pages/secondary/campus";

const wrap = (ui: React.ReactNode, path: string) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
            </I18nextProvider>
        </QueryClientProvider>
    );
};

beforeEach(() => {
    cleanup();
    // These pages are chatty in jsdom (framer-motion, storage); keep output clean.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("W2-5 pre-shell routes expose a main landmark", () => {
    it("/login renders exactly one main landmark", () => {
        wrap(<LoginPage />, "/login");
        const mains = screen.getAllByRole("main");
        expect(mains).toHaveLength(1);
        // The form must live inside the landmark, not beside it.
        expect(mains[0]!.querySelector("form")).toBeTruthy();
    });

    it("/welcome renders exactly one main landmark", () => {
        wrap(<WelcomePage />, "/welcome");
        const mains = screen.getAllByRole("main");
        expect(mains).toHaveLength(1);
        expect(mains[0]!.querySelector("h1")).toBeTruthy();
    });

    it("/campus renders exactly one main landmark", () => {
        wrap(<CampusPage />, "/campus");
        const mains = screen.getAllByRole("main");
        expect(mains).toHaveLength(1);
        expect(mains[0]!.querySelector("h1")).toBeTruthy();
    });
});
