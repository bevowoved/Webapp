"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn, cva, type VariantProps } from "@/lib/utils/cn";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
    return (
        <SheetPrimitive.Overlay
            className={cn(
                "fixed inset-0 z-50 bg-black/40 backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                className
            )}
            {...props}
        />
    );
}

const sheetVariants = cva(
    "fixed z-50 gap-4 bg-background shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
    {
        variants: {
            side: {
                top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
                bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
                left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
                right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
            },
        },
        defaultVariants: {
            side: "right",
        },
    }
);

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> &
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
    ref,
    ...props
}: SheetContentProps) {
    const currentSide = side ?? "right";

    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
                ref={ref}
                className={cn(
                    sheetVariants({ side: currentSide }),
                    sheetSafePadding[currentSide],
                    className
                )}
                {...props}
            >
                {children}
                <SheetPrimitive.Close className="absolute right-[var(--sheet-close-right,calc(var(--safe-area-right,0px)+1rem))] top-[var(--sheet-close-top,calc(var(--safe-area-top,0px)+1rem))] flex h-[2rem] w-[2rem] items-center justify-center rounded-sm opacity-70 ring-offset-background transition-all hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-[1.5rem] w-[1.5rem]" />
                </SheetPrimitive.Close>
            </SheetPrimitive.Content>
        </SheetPortal>
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

function SheetTitle({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
    return (
        <SheetPrimitive.Title
            className={cn("text-lg font-semibold text-foreground", className)}
            {...props}
        />
    );
}

function SheetDescription({
    className,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
    return (
        <SheetPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetPortal,
    SheetOverlay,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
};
