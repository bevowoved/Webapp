/**
 * cn - conflict resolution and the className override convention.
 *
 * The hand-rolled merger had four real defects (gradient stops, drop-shadow)
 * plus four grid-placement families it did not know about. Replacing it with
 * tailwind-merge + clsx fixed those; these tests pin the behaviours that the
 * rest of the UI depends on so a future swap cannot regress them silently.
 */
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn grid placement (the C2 families)", () => {
    it("resolves col-start", () => {
        expect(cn("col-start-1", "col-start-3")).toBe("col-start-3");
    });
    it("resolves col-end", () => {
        expect(cn("col-end-2", "col-end-4")).toBe("col-end-4");
    });
    it("resolves row-start", () => {
        expect(cn("row-start-1", "row-start-2")).toBe("row-start-2");
    });
    it("resolves row-end", () => {
        expect(cn("row-end-2", "row-end-3")).toBe("row-end-3");
    });
});

describe("cn gradient stops and drop-shadow (the four real defects)", () => {
    it("resolves from- stops", () => {
        expect(cn("from-red-500", "from-blue-500")).toBe("from-blue-500");
    });
    it("resolves to- stops", () => {
        expect(cn("to-red-500", "to-blue-500")).toBe("to-blue-500");
    });
    it("resolves via- stops", () => {
        expect(cn("via-red-500", "via-blue-500")).toBe("via-blue-500");
    });
    it("resolves drop-shadow sizes", () => {
        expect(cn("drop-shadow-md", "drop-shadow-lg")).toBe("drop-shadow-lg");
    });
});

describe("cn list and align families", () => {
    it("resolves list-style-position", () => {
        expect(cn("list-inside", "list-outside")).toBe("list-outside");
    });
    it("resolves list-style-type", () => {
        expect(cn("list-disc", "list-decimal")).toBe("list-decimal");
    });
    it("resolves align-items", () => {
        expect(cn("items-center", "items-start")).toBe("items-start");
    });
    it("resolves align-content", () => {
        expect(cn("content-center", "content-between")).toBe("content-between");
    });
    it("keeps list-style-position and list-style-type independent", () => {
        expect(cn("list-inside list-disc")).toBe("list-inside list-disc");
    });
});

describe("cn className override convention", () => {
    it("a caller class overrides the component base class", () => {
        expect(cn("bg-primary text-primary-foreground", "bg-red-500")).toBe(
            "text-primary-foreground bg-red-500"
        );
    });

    it("the calendar today+outside case drops text-accent-foreground", () => {
        // Mirrors calendar.tsx:189 - a day that is both today and outside the
        // month gets both class sets; the outside colour must win.
        const base = "group/day relative aspect-square h-full w-full select-none p-0 text-center";
        const today = "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none";
        const outside = "text-muted-foreground aria-selected:text-muted-foreground";
        const result = cn(base, today, outside);
        expect(result).not.toContain("text-accent-foreground");
        expect(result).toContain("text-muted-foreground");
    });

    it("keeps non-conflicting classes from both sides", () => {
        expect(cn("p-4", "m-4")).toBe("p-4 m-4");
        expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
        expect(cn("flex", "items-center")).toBe("flex items-center");
    });

    it("ignores falsy inputs", () => {
        expect(cn("p-4", false, null, undefined, "", "m-4")).toBe("p-4 m-4");
    });

    it("handles conditional objects and arrays", () => {
        expect(cn({ "p-4": true, "m-4": false })).toBe("p-4");
        expect(cn(["p-4", ["m-4"]])).toBe("p-4 m-4");
    });
});
