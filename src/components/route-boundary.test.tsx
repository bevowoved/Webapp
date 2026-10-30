/**
 * route-boundary - a throw in one child must not take the shell down.
 *
 * Before this boundary existed, a render error anywhere under a route unmounted
 * the whole tree and left a blank page. The boundary catches, renders a
 * fallback in place of the failed subtree, keeps siblings mounted, and offers a
 * retry that re-attempts the render.
 *
 * `report()` dynamically imports @sentry/react; that import is left to fail
 * harmlessly in jsdom because the rejection is not awaited by render.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { I18nextProvider } from "react-i18next";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import i18n from "@/i18n";
import { RouteBoundary } from "@/components/route-boundary";

const Boom = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error("boom");
    return <div data-testid="child-ok" />;
};

const wrap = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <I18nextProvider i18n={i18n}>
                <MemoryRouter initialEntries={["/planning"]}>{ui}</MemoryRouter>
            </I18nextProvider>
        </QueryClientProvider>
    );
};

beforeEach(() => {
    cleanup();
    // React logs caught errors; keep the output readable without hiding failures.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("route-boundary shell survival", () => {
    it("renders children when nothing throws", () => {
        wrap(
            <RouteBoundary scope="planning">
                <Boom shouldThrow={false} />
            </RouteBoundary>
        );
        expect(screen.getByTestId("child-ok")).toBeTruthy();
    });

    it("renders the fallback instead of a blank page when a child throws", () => {
        wrap(
            <RouteBoundary scope="planning">
                <Boom shouldThrow={true} />
            </RouteBoundary>
        );
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.queryByTestId("child-ok")).toBeNull();
    });

    it("keeps siblings outside the boundary mounted", () => {
        wrap(
            <>
                <div data-testid="shell" />
                <RouteBoundary scope="planning">
                    <Boom shouldThrow={true} />
                </RouteBoundary>
            </>
        );
        // The shell is outside the boundary and must survive.
        expect(screen.getByTestId("shell")).toBeTruthy();
        expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("retry re-attempts the render and recovers when the child stops throwing", async () => {
        let shouldThrow = true;
        const Flaky = () => {
            if (shouldThrow) throw new Error("boom");
            return <div data-testid="child-ok" />;
        };
        wrap(
            <RouteBoundary scope="planning">
                <Flaky />
            </RouteBoundary>
        );
        expect(screen.getByRole("alert")).toBeTruthy();

        // Fix the underlying cause, then retry.
        shouldThrow = false;
        const retry = screen.getByRole("button", { name: /réessayer|retry/i });
        fireEvent.click(retry);

        await waitFor(() => expect(screen.getByTestId("child-ok")).toBeTruthy());
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("retry keeps showing the fallback while the child still throws", async () => {
        wrap(
            <RouteBoundary scope="planning">
                <Boom shouldThrow={true} />
            </RouteBoundary>
        );
        const retry = screen.getByRole("button", { name: /réessayer|retry/i });
        fireEvent.click(retry);
        await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    });
});
