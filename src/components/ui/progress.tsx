"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

function Progress({
    className,
    value,
    ref,
    ...props
}: React.ComponentProps<"div"> & { value?: number | null }) {
    return (
        <div
            ref={ref}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value ?? 0}
            className={cn(
                "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
                className
            )}
            {...props}
        >
            <div
                className="h-full w-full flex-1 bg-primary transition-all"
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </div>
    );
}

export { Progress };
