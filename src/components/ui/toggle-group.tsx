"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

type ToggleVariant = "default" | "outline";
type ToggleSize = "default" | "sm" | "lg";

const BASE =
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2";

const VARIANTS: Record<ToggleVariant, string> = {
    default: "bg-transparent",
    outline:
        "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
};

const SIZES: Record<ToggleSize, string> = {
    default: "h-10 px-3 min-w-10",
    sm: "h-9 px-2.5 min-w-9",
    lg: "h-11 px-5 min-w-11",
};

const toggleVariants = ({
    variant = "default",
    size = "default",
    className,
}: {
    variant?: ToggleVariant | null;
    size?: ToggleSize | null;
    className?: string;
} = {}): string =>
    cn(BASE, VARIANTS[variant ?? "default"], SIZES[size ?? "default"], className);

type ToggleGroupContextValue = {
    variant?: ToggleVariant | null;
    size?: ToggleSize | null;
    type: "single" | "multiple";
    value: unknown;
    toggle: (value: string) => void;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
    variant: "default",
    size: "default",
    type: "single",
    value: undefined,
    toggle: () => {},
});

type ToggleGroupProps = Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> & {
    type?: "single" | "multiple";
    value?: string | string[] | null;
    defaultValue?: string | string[];
    onValueChange?: (value: string | string[]) => void;
    variant?: ToggleVariant | null;
    size?: ToggleSize | null;
    disabled?: boolean;
};

function ToggleGroup({
    className,
    variant,
    size,
    children,
    type = "single",
    value,
    defaultValue,
    onValueChange,
    disabled,
    ref,
    ...props
}: ToggleGroupProps) {
    const [internal, setInternal] = React.useState<string | string[]>(
        defaultValue ?? (type === "multiple" ? [] : "")
    );
    const isControlled = value !== undefined;
    const current = isControlled ? (value ?? "") : internal;

    const toggle = React.useCallback(
        (item: string) => {
            let next: string | string[];
            if (type === "multiple") {
                const list = Array.isArray(current) ? current : [];
                next = list.includes(item)
                    ? list.filter((v) => v !== item)
                    : [...list, item];
            } else {
                next = current === item ? "" : item;
            }
            if (!isControlled) setInternal(next);
            onValueChange?.(next);
        },
        [current, isControlled, onValueChange, type]
    );

    return (
        <div
            ref={ref}
            role="group"
            aria-disabled={disabled || undefined}
            className={cn("flex items-center justify-center gap-1", className)}
            {...props}
        >
            <ToggleGroupContext value={{ variant, size, type, value: current, toggle }}>
                {children}
            </ToggleGroupContext>
        </div>
    );
}

type ToggleGroupItemProps = Omit<React.ComponentProps<"button">, "value"> & {
    value: string;
    variant?: ToggleVariant | null;
    size?: ToggleSize | null;
};

function ToggleGroupItem({
    className,
    children,
    variant,
    size,
    value,
    disabled,
    onClick,
    ref,
    ...props
}: ToggleGroupItemProps) {
    const context = React.use(ToggleGroupContext);
    const pressed = Array.isArray(context.value)
        ? context.value.includes(value)
        : context.value === value;

    return (
        <button
            ref={ref}
            type="button"
            aria-pressed={pressed}
            data-state={pressed ? "on" : "off"}
            disabled={disabled}
            onClick={(e) => {
                onClick?.(e);
                if (!disabled) context.toggle(value);
            }}
            className={cn(
                toggleVariants({
                    variant: context.variant ?? variant,
                    size: context.size ?? size,
                }),
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export { ToggleGroup, ToggleGroupItem };
