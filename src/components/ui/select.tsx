"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type SelectOption = {
    value: string;
    label: string;
};

type SelectProps = Omit<
    React.ComponentProps<"select">,
    "value" | "onChange" | "children" | "multiple" | "size"
> & {
    value?: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
};

function Select({
    value,
    onValueChange,
    options,
    placeholder,
    className,
    ...props
}: SelectProps) {
    return (
        <span className="relative inline-flex w-full items-center">
            <select
                value={value ?? ""}
                onChange={(event) => onValueChange(event.currentTarget.value)}
                className={cn(
                    "native-select h-9 w-full rounded-md border border-input bg-background px-2 pr-7 text-sm text-foreground ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                {...props}
            >
                {placeholder ? (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                ) : null}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                aria-hidden="true"
                className="native-select-icon pointer-events-none absolute right-1.5 size-4 opacity-50"
            />
        </span>
    );
}

export { Select };
