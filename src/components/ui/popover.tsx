"use client";

import * as React from "react";

import { cn, Slot } from "@/lib/utils/cn";

type PopoverContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerId: string;
    contentId: string;
    setContentId: (id: string) => void;
    anchorName: string;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string): PopoverContextValue {
    const context = React.useContext(PopoverContext);
    if (!context) {
        throw new Error(`${component} must be used within <Popover>`);
    }
    return context;
}

function Popover({
    open = false,
    onOpenChange,
    children,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
}) {
    const id = React.useId();
    const anchorName = `popover-anchor-${id}`;
    const [contentId, setContentId] = React.useState(`popover-content-${id}`);
    const value = React.useMemo<PopoverContextValue>(
        () => ({
            open,
            setOpen: (next) => onOpenChange?.(next),
            triggerId: `popover-trigger-${id}`,
            contentId,
            setContentId,
            anchorName,
        }),
        [open, onOpenChange, id, anchorName, contentId]
    );

    return (
        <PopoverContext.Provider value={value}>
            <span className="relative inline-flex">{children}</span>
        </PopoverContext.Provider>
    );
}

function PopoverTrigger({
    asChild = false,
    children,
    onClick,
    ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
    const { open, setOpen, contentId, anchorName } = usePopoverContext(
        "PopoverTrigger"
    );
    const Comp = asChild ? Slot : "button";

    return (
        <Comp
            type={asChild ? undefined : "button"}
            style={{ anchorName: `--${anchorName}` }}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? contentId : undefined}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event);
                if (!event.defaultPrevented) setOpen(!open);
            }}
            {...props}
        >
            {children}
        </Comp>
    );
}

function PopoverContent({
    className,
    children,
    align = "center",
    id,
    style,
    ...props
}: React.ComponentProps<"div"> & { align?: "start" | "center" | "end" }) {
    const { open, setOpen, contentId, setContentId, anchorName } =
        usePopoverContext("PopoverContent");
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (id) setContentId(id);
    }, [id, setContentId]);

    React.useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (open && !node.matches(":popover-open")) {
            node.showPopover();
        } else if (!open && node.matches(":popover-open")) {
            node.hidePopover();
        }
    }, [open]);

    React.useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const handleToggle = (event: Event) => {
            const next = (event as ToggleEvent).newState === "open";
            if (!next) setOpen(false);
        };
        node.addEventListener("toggle", handleToggle);
        return () => node.removeEventListener("toggle", handleToggle);
    }, [setOpen]);

    return (
        <div
            {...props}
            ref={ref}
            id={id ?? contentId}
            popover="auto"
            role="dialog"
            style={{ positionAnchor: `--${anchorName}`, ...style }}
            className={cn(
                "m-0 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md",
                align === "start" && "[position-area:bottom_span-right]",
                align === "center" && "[position-area:bottom]",
                align === "end" && "[position-area:bottom_span-left]",
                className
            )}
        >
            {children}
        </div>
    );
}

export { Popover, PopoverTrigger, PopoverContent };
