"use client";

import * as React from "react";

import { cn, Slot } from "@/lib/utils/cn";

type DrawerContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawerContext(component: string): DrawerContextValue {
    const context = React.useContext(DrawerContext);
    if (!context) {
        throw new Error(`${component} must be used within <Drawer>`);
    }
    return context;
}

function Drawer({
    open = false,
    onOpenChange,
    children,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
}) {
    const value = React.useMemo<DrawerContextValue>(
        () => ({ open, setOpen: (next) => onOpenChange?.(next) }),
        [open, onOpenChange]
    );

    return (
        <DrawerContext.Provider value={value}>
            {children}
        </DrawerContext.Provider>
    );
}

function DrawerContent({
    className,
    children,
    ...props
}: React.ComponentProps<"dialog">) {
    const { open, setOpen } = useDrawerContext("DrawerContent");
    const ref = React.useRef<HTMLDialogElement>(null);

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
                "fixed inset-x-0 bottom-0 top-auto z-50 m-0 mt-24 h-auto max-h-[85dvh] w-full max-w-none flex-col rounded-t-[10px] border-0 bg-background p-0 pb-safe text-foreground backdrop:bg-black/40 backdrop:backdrop-blur-md",
                className,
                "hidden open:flex"
            )}
            {...props}
        >
            <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
            {children}
        </dialog>
    );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
            {...props}
        />
    );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("mt-auto flex flex-col gap-2 p-4", className)}
            {...props}
        />
    );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<"h2">) {
    return (
        <h2
            className={cn(
                "text-lg font-semibold leading-none tracking-tight",
                className
            )}
            {...props}
        />
    );
}

function DrawerDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function DrawerClose({
    asChild = false,
    children,
    onClick,
    ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const { setOpen } = useDrawerContext("DrawerClose");
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event);
                if (!event.defaultPrevented) setOpen(false);
            }}
            {...props}
        >
            {children}
        </Comp>
    );
}

export {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
    DrawerClose,
};
