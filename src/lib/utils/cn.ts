import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Class-name composition.
 *
 * `cn` merges conflicting Tailwind utilities (last wins) so callers can override
 * a component's base classes without fighting the cascade. `cva` declares
 * variant tables. Both come from published libraries rather than local copies.
 *
 * `Slot` is the one locally-held primitive: its only consumer is `Button`'s
 * `asChild` escape hatch, and the published equivalent would reintroduce two
 * Radix packages this project deliberately removed.
 */
export type { ClassValue, VariantProps };
export { cva };

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
type SlotProps = React.HTMLAttributes<HTMLElement> & {
    children?: React.ReactNode;
    asChild?: boolean;
    ref?: React.Ref<HTMLElement>;
};

const composeRefs = (a: unknown, b: unknown): React.Ref<HTMLElement> | undefined => {
    if (!a) return b as React.Ref<HTMLElement> | undefined;
    if (!b) return a as React.Ref<HTMLElement>;
    return (node: HTMLElement | null) => {
        for (const r of [a, b] as Array<React.Ref<HTMLElement>>) {
            if (typeof r === "function") r(node);
            else (r as React.MutableRefObject<HTMLElement | null>).current = node;
        }
    };
};

export function Slot({ children, ref: forwardedRef, ...slotProps }: SlotProps) {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props as Record<string, unknown>;
    const override: Record<string, unknown> = { ...childProps };

    for (const name in childProps) {
        const slotValue = slotProps[name as keyof typeof slotProps];
        const childValue = childProps[name];
        if (/^on[A-Z]/.test(name)) {
            if (slotValue && childValue) {
                override[name] = (...args: unknown[]) => {
                    const result = (childValue as (...a: unknown[]) => unknown)(...args);
                    (slotValue as (...a: unknown[]) => void)(...args);
                    return result;
                };
            } else if (slotValue) {
                override[name] = slotValue;
            }
        } else if (name === "style") {
            override[name] = { ...(slotValue as object), ...(childValue as object) };
        } else if (name === "className") {
            override[name] = cn(childValue as ClassValue, slotValue as ClassValue);
        }
    }

    const merged: Record<string, unknown> = { ...slotProps, ...override };
    if (child.type !== React.Fragment) merged.ref = composeRefs(forwardedRef, childProps.ref);
    return React.cloneElement(child, merged);
}