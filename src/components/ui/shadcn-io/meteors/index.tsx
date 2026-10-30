"use client";

import React, { useMemo } from "react";

function cn(...cls: Array<string | undefined | false>) {
    return cls.filter(Boolean).join(" ");
}

const seeded = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
};

export interface MeteorsProps {
    number?: number;
    minDelay?: number;
    maxDelay?: number;
    minDuration?: number;
    maxDuration?: number;
    angle?: number;
    className?: string;
}

export const Meteors: React.FC<MeteorsProps> = ({
    number = 20,
    minDelay = 0.2,
    maxDelay = 1.2,
    minDuration = 2,
    maxDuration = 10,
    angle = 215,
    className,
}) => {
    const meteorStyles = useMemo(() => {
        const random = seeded(number * 7919 + Math.round(angle));
        return Array.from({ length: number }, () => {
            const delay = random() * (maxDelay - minDelay) + minDelay;
            const dur = random() * (maxDuration - minDuration) + minDuration;
            const topPct = random() * 120 - 10;

            return {
                "--angle": `${angle}deg`,
                top: `${topPct}%`,
                left: `calc(0% + ${Math.floor(random() * 100)}vw)`,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
                animationFillMode: "both",
                transform: `rotate(${angle}deg)`,
            } as React.CSSProperties;
        });
    }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

    return (
        <>
            {meteorStyles.map((style, idx) => (
                <span
                    key={idx}
                    style={style}
                    className={cn(
                        "pointer-events-none absolute size-0.5 rotate-(--angle) animate-meteor rounded-full bg-mauria-accent shadow-[0_0_0_1px_var(--meteors-trail-glow)]",
                        className
                    )}
                >
                    <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-linear-to-r from-mauria-accent to-transparent" />
                </span>
            ))}
        </>
    );
};

export default Meteors;
