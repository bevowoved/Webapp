/**
 * Drawer and Sheet: the closed-dialog regression.
 *
 * `vaul` and Radix were removed and both components rebuilt on native
 * `<dialog>`. The bug that rewrite introduced was a class-ordering one: the base
 * class string carried `open:flex`, and a consumer passing `flex` — the sidebar
 * and update-drawer both do — overrode the implied `display: none`, because
 * `open:flex` only applies while `[open]` is present. A closed dialog stayed
 * laid out over the app: measured at 332x844 with `display: flex` and 3 of 3
 * focusables obscured.
 *
 * The fix is ordering, not specificity: `hidden open:flex` must be the last
 * entry in the merged class list, so `tailwind-merge` lets it win over anything
 * the consumer passes. That ordering is exactly what these tests pin — jsdom
 * does no cascade, but it does let us assert which utility is last.
 *
 * jsdom implements neither `HTMLDialogElement.showModal` nor `close`, so both
 * are stubbed here. The stubs mirror the documented behaviour: `showModal()`
 * sets `open` on the element and `close()` clears it and fires `close`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// `globals: false` in vitest.config.ts means no auto-cleanup from RTL.
afterEach(cleanup);

let showModal: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;

beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
    });
    close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
        configurable: true,
        writable: true,
        value: showModal,
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
        configurable: true,
        writable: true,
        value: close,
    });
});

const lastTwo = (el: Element) => el.className.trim().split(/\s+/).slice(-2).join(" ");

const classTokens = (el: Element) => el.className.trim().split(/\s+/);

describe("DrawerContent", () => {
    it("puts `hidden open:flex` last so a consumer's `flex` cannot win", () => {
        const { container } = render(
            <Drawer open={false} onOpenChange={() => {}}>
                <DrawerContent className="flex">{"body"}</DrawerContent>
            </Drawer>
        );
        const dialog = container.querySelector("dialog")!;
        expect(dialog).toBeTruthy();
        // Ordering is the whole fix: tailwind-merge keeps the last conflicting
        // utility. If this string moves back into the base list, the consumer's
        // `flex` wins again and the closed drawer overlays the app.
        expect(lastTwo(dialog)).toBe("hidden open:flex");
        expect(classTokens(dialog).indexOf("hidden")).toBeGreaterThan(
            classTokens(dialog).indexOf("flex")
        );
    });

    it("still ends with `hidden open:flex` when the consumer passes flex-col", () => {
        const { container } = render(
            <Drawer open={false} onOpenChange={() => {}}>
                <DrawerContent className="flex flex-col gap-2">{"body"}</DrawerContent>
            </Drawer>
        );
        expect(lastTwo(container.querySelector("dialog")!)).toBe("hidden open:flex");
    });

    it("opens the dialog with showModal when open is true", () => {
        render(
            <Drawer open onOpenChange={() => {}}>
                <DrawerContent>{"body"}</DrawerContent>
            </Drawer>
        );
        expect(showModal).toHaveBeenCalledTimes(1);
    });

    it("does not call showModal while closed", () => {
        render(
            <Drawer open={false} onOpenChange={() => {}}>
                <DrawerContent>{"body"}</DrawerContent>
            </Drawer>
        );
        expect(showModal).not.toHaveBeenCalled();
    });

    it("reports a native close back through onOpenChange", () => {
        const onOpenChange = vi.fn();
        render(
            <Drawer open onOpenChange={onOpenChange}>
                <DrawerContent>{"body"}</DrawerContent>
            </Drawer>
        );
        const dialog = document.querySelector("dialog")!;
        // The user dismissed it with Escape, which the browser implements as a
        // `close` event; React state has to follow or it desyncs from the DOM.
        dialog.dispatchEvent(new Event("close"));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closes the dialog when open flips to false", () => {
        const { rerender } = render(
            <Drawer open onOpenChange={() => {}}>
                <DrawerContent>{"body"}</DrawerContent>
            </Drawer>
        );
        rerender(
            <Drawer open={false} onOpenChange={() => {}}>
                <DrawerContent>{"body"}</DrawerContent>
            </Drawer>
        );
        expect(close).toHaveBeenCalled();
    });

    it("throws a clear error when used outside a Drawer", () => {
        // React logs the error before rethrowing; silence it so the run stays clean.
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<DrawerContent>{"orphan"}</DrawerContent>)).toThrow(/must be used within/);
        spy.mockRestore();
    });
});

describe("SheetContent", () => {
    it("puts `hidden open:flex` last so a consumer's `flex` cannot win", () => {
        const { container } = render(
            <Sheet open={false} onOpenChange={() => {}}>
                <SheetContent closeLabel="close" className="flex">{"body"}</SheetContent>
            </Sheet>
        );
        const dialog = container.querySelector("dialog")!;
        expect(dialog).toBeTruthy();
        expect(lastTwo(dialog)).toBe("hidden open:flex");
    });

    it("opens with showModal and reports close", () => {
        const onOpenChange = vi.fn();
        render(
            <Sheet open onOpenChange={onOpenChange}>
                <SheetContent closeLabel="close">{"body"}</SheetContent>
            </Sheet>
        );
        expect(showModal).toHaveBeenCalledTimes(1);
        document.querySelector("dialog")!.dispatchEvent(new Event("close"));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});

