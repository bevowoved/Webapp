import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type CheckboxProps = Omit<React.ComponentProps<"button">, "onChange"> & {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean | "indeterminate") => void;
};

function Checkbox({
    className,
    checked,
    onCheckedChange,
    disabled,
    onClick,
    ref,
    ...props
}: CheckboxProps) {
    const state =
        checked === "indeterminate"
            ? "indeterminate"
            : checked
              ? "checked"
              : "unchecked";

    return (
        <button
            ref={ref}
            type="button"
            role="checkbox"
            aria-checked={checked === "indeterminate" ? "mixed" : !!checked}
            data-state={state}
            disabled={disabled}
            onClick={(e) => {
                onClick?.(e);
                if (disabled) return;
                onCheckedChange?.(checked === "indeterminate" ? true : !checked);
            }}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
                className
            )}
            {...props}
        >
            {checked ? (
                <span className="flex items-center justify-center text-current">
                    <Check className="h-4 w-4" />
                </span>
            ) : null}
        </button>
    );
}

export { Checkbox };
