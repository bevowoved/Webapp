/**
 * Shell components: the not-found page, the empty/down state, the progress ring,
 * the checkbox and Button's `asChild` escape hatch.
 *
 * All of these are reached by real navigation, so a regression is visible to
 * every user rather than to one screen. None of them needs a dialog, so nothing
 * here depends on the jsdom `HTMLDialogElement` gap.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { I18nextProvider } from "react-i18next";
import { ServerCrash } from "lucide-react";
import i18n from "@/i18n";
import { NotFound } from "@/components/not-found";
import { EmptyListState } from "@/components/aurion-down-state";
import { ProgressRing } from "@/components/progress-ring";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const wrap = (ui: React.ReactNode, path = "/nope") =>
    render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </I18nextProvider>
    );

const LocationProbe = () => {
    const { pathname } = useLocation();
    return <div data-testid="path">{pathname}</div>;
};

beforeEach(() => {
    cleanup();
});

afterEach(() => {
    cleanup();
});

describe("NotFound", () => {
    it("renders an alert with the translated message", () => {
        wrap(<NotFound />);
        expect(screen.getByRole("alert")).toBeTruthy();
        expect(screen.getByRole("alert").textContent).toContain("Page introuvable");
    });

    it("shows the offending path so the user can see what went wrong", () => {
        wrap(<NotFound />, "/planning/typo");
        expect(screen.getByRole("alert").textContent).toContain("/planning/typo");
    });

    it("navigates home when the button is pressed", () => {
        wrap(
            <Routes>
                <Route path="/nope" element={<NotFound />} />
                <Route path="/" element={<LocationProbe />} />
            </Routes>
        );
        fireEvent.click(screen.getByRole("button", { name: /retour à l'accueil/i }));
        expect(screen.getByTestId("path").textContent).toBe("/");
    });
});

describe("EmptyListState", () => {
    const base = {
        aurionDown: false,
        hasCachedItems: false,
        cachedMessage: "cached",
        icon: ServerCrash,
        emptyTitle: "Empty title",
        emptyBody: "Empty body",
    };

    it("shows the empty title and body when idle", () => {
        wrap(<EmptyListState {...base} busy={false} />);
        expect(document.body.textContent).toContain("Empty title");
        expect(document.body.textContent).toContain("Empty body");
    });

    it("shows the loading label and the hint while busy", () => {
        wrap(<EmptyListState {...base} busy loadingHint="please wait" />);
        expect(document.body.textContent).toContain("Chargement…");
        expect(document.body.textContent).toContain("please wait");
        expect(document.body.textContent).not.toContain("Empty body");
    });

    it("shows the down state when Aurion is down and nothing is cached", () => {
        wrap(<EmptyListState {...base} busy={false} aurionDown />);
        expect(document.body.textContent).toContain("cached");
        expect(document.body.textContent).not.toContain("Empty title");
    });

    it("prefers the empty state over the down state when something is cached", () => {
        wrap(<EmptyListState {...base} busy={false} aurionDown hasCachedItems />);
        expect(document.body.textContent).toContain("Empty title");
        expect(document.body.textContent).not.toContain("cached");
    });
});

describe("ProgressRing", () => {
    const circles = (container: HTMLElement) => container.querySelectorAll("circle");
    const circumference = (size: number, stroke: number) => 2 * Math.PI * ((size - stroke) / 2);

    it("draws a full circumference and offsets it by the value", () => {
        const { container } = render(<ProgressRing value={50} size={28} strokeWidth={3} />);
        const [track, bar] = circles(container);
        const c = circumference(28, 3);

        expect(Number(track?.getAttribute("r"))).toBeCloseTo(12.5, 5);
        expect(Number(bar?.getAttribute("stroke-dasharray"))).toBeCloseTo(c, 5);
        expect(Number(bar?.getAttribute("stroke-dashoffset"))).toBeCloseTo(c / 2, 5);
    });

    it("clamps a value above 100 to a full ring", () => {
        const { container } = render(<ProgressRing value={250} />);
        expect(Number(circles(container)[1]?.getAttribute("stroke-dashoffset"))).toBe(0);
    });

    it("clamps a negative value to an empty ring", () => {
        const { container } = render(<ProgressRing value={-50} />);
        const c = circumference(28, 3);
        expect(Number(circles(container)[1]?.getAttribute("stroke-dashoffset"))).toBeCloseTo(c, 5);
    });

    it("applies a caller className to the svg", () => {
        const { container } = render(<ProgressRing value={0} className="text-red-500" />);
        expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-red-500");
    });
});

describe("Checkbox", () => {
    it("reports the unchecked state", () => {
        render(<Checkbox checked={false} />);
        const box = screen.getByRole("checkbox");
        expect(box.getAttribute("aria-checked")).toBe("false");
        expect(box.getAttribute("data-state")).toBe("unchecked");
    });

    it("reports the checked state", () => {
        render(<Checkbox checked />);
        const box = screen.getByRole("checkbox");
        expect(box.getAttribute("aria-checked")).toBe("true");
        expect(box.getAttribute("data-state")).toBe("checked");
    });

    it("reports an indeterminate state as aria-checked=mixed", () => {
        render(<Checkbox checked="indeterminate" />);
        const box = screen.getByRole("checkbox");
        expect(box.getAttribute("aria-checked")).toBe("mixed");
        expect(box.getAttribute("data-state")).toBe("indeterminate");
    });

    it("toggles to true when clicked from unchecked", () => {
        const seen: unknown[] = [];
        render(<Checkbox checked={false} onCheckedChange={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByRole("checkbox"));
        expect(seen).toEqual([true]);
    });

    it("toggles to false when clicked from checked", () => {
        const seen: unknown[] = [];
        render(<Checkbox checked onCheckedChange={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByRole("checkbox"));
        expect(seen).toEqual([false]);
    });

    it("resolves indeterminate to true on click", () => {
        const seen: unknown[] = [];
        render(<Checkbox checked="indeterminate" onCheckedChange={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByRole("checkbox"));
        expect(seen).toEqual([true]);
    });

    it("does not fire when disabled", () => {
        const seen: unknown[] = [];
        render(<Checkbox checked={false} disabled onCheckedChange={(v) => seen.push(v)} />);
        fireEvent.click(screen.getByRole("checkbox"));
        expect(seen).toEqual([]);
    });
});

describe("Button asChild", () => {
    // A non-literal child keeps the i18n lint rule satisfied; the text is
    // irrelevant to what these tests assert.
    const label = "go";

    it("renders the child element rather than a button", () => {
        render(
            <Button asChild>
                <a href="/x">{label}</a>
            </Button>
        );
        expect(document.querySelector("a")).toBeTruthy();
        expect(document.querySelector("button")).toBeNull();
    });

    it("merges the caller className over the button base classes", () => {
        render(
            <Button asChild className="bg-red-500">
                <a href="/x">{label}</a>
            </Button>
        );
        const classes = document.querySelector("a")!.className.split(/\s+/);
        expect(classes).toContain("bg-red-500");
        // The base `bg-primary` must have lost to the caller's class. The
        // `hover:` variant is a different utility and legitimately survives.
        expect(classes).not.toContain("bg-primary");
    });

    it("calls both the slot and the child onClick", () => {
        const calls: string[] = [];
        render(
            <Button asChild onClick={() => calls.push("slot")}>
                <a href="/x" onClick={() => calls.push("child")}>
                    {label}
                </a>
            </Button>
        );
        fireEvent.click(document.querySelector("a")!);
        expect(calls).toEqual(["child", "slot"]);
    });

    it("renders nothing for a non-element child", () => {
        const { container } = render(
            <Button asChild>
                {"just text" as unknown as React.ReactElement}
            </Button>
        );
        expect(container.querySelector("button")).toBeNull();
        expect(container.querySelector("a")).toBeNull();
    });
});
