"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn, cva, Slot, type VariantProps } from "@/lib/utils/cn";

type SheetContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(component: string): SheetContextValue {
    const context = React.useContext(SheetContext);
    if (!context) {
        throw new Error(`${component} must be used within <Sheet>`);
    }
    return context;
}

function Sheet({
    open = false,
    onOpenChange,
    children,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
}) {
    const value = React.useMemo<SheetContextValue>(
        () => ({ open, setOpen: (next) => onOpenChange?.(next) }),
        [open, onOpenChange]
    );

    return (
        <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
    );
}

function SheetTrigger({
    asChild = false,
    children,
    onClick,
    ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const { setOpen } = useSheetContext("SheetTrigger");
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event);
                if (!event.defaultPrevented) setOpen(true);
            }}
            {...props}
        >
            {children}
        </Comp>
    );
}

const sheetVariants = cva(
    "fixed z-50 gap-4 border-0 bg-background p-0 text-foreground shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-md",
    {
        variants: {
            side: {
                top: "inset-x-0 top-0 bottom-auto m-0 w-full max-w-none rounded-b-lg border-b",
                bottom: "inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-lg border-t",
                left: "inset-y-0 left-0 right-auto m-0 h-full w-3/4 max-w-none rounded-r-lg border-r sm:max-w-sm",
                right: "inset-y-0 right-0 left-auto m-0 h-full w-3/4 max-w-none rounded-l-lg border-l sm:max-w-sm",
            },
        },
        defaultVariants: {
            side: "right",
        },
    }
);

type SheetContentProps = React.ComponentProps<"dialog"> &
    VariantProps<typeof sheetVariants>;

const sheetSafePadding: Record<
    NonNullable<SheetContentProps["side"]>,
    string
> = {
    top: "px-safe-or-6 pt-safe-or-6 pb-6",
    bottom: "px-safe-or-6 pb-safe-or-6 pt-6",
    left: "py-safe-or-6 pl-safe-or-6 pr-6",
    right: "py-safe-or-6 pr-safe-or-6 pl-6",
};

function SheetContent({
    side = "right",
    className,
    children,
    closeLabel,
    ...props
}: SheetContentProps & { closeLabel: string }) {
    const { open, setOpen } = useSheetContext("SheetContent");
    const ref = React.useRef<HTMLDialogElement>(null);
    const currentSide = side ?? "right";

    React.useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    React.useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        const handleClose = () => setOpen(false);
        dialog.addEventListener("close", handleClose);
        return () => dialog.removeEventListener("close", handleClose);
    }, [setOpen]);

    return (
        <dialog
            ref={ref}
            aria-modal="true"
            className={cn(
                sheetVariants({ side: currentSide }),
                sheetSafePadding[currentSide],
                "flex-col",
                className,
                "hidden open:flex"
            )}
            {...props}
        >
            {children}
            <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="absolute right-[var(--sheet-close-right,calc(var(--safe-area-right,0px)+1rem))] top-[var(--sheet-close-top,calc(var(--safe-area-top,0px)+1rem))] flex h-[2rem] w-[2rem] items-center justify-center rounded-sm opacity-70 ring-offset-background transition-all hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
                <X className="h-[1.5rem] w-[1.5rem]" aria-hidden="true" />
            </button>
        </dialog>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col space-y-2 text-center sm:text-left",
                className
            )}
            {...props}
        />
    );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
                className
            )}
            {...props}
        />
    );
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
    return (
        <h2
            className={cn("text-lg font-semibold text-foreground", className)}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
};
