import { cn } from "@/lib/utils/cn";
import { ArrowUpToLine, Loader2 } from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useIsFetching } from "@tanstack/react-query";
import {
    requestAurionBlink,
    useJuniaStatus,
} from "@/lib/hooks/use-junia-status";

type Props = {
    children: React.ReactNode;
    onRefresh: () => Promise<unknown> | unknown;
    isPullable?: boolean;
    className?: string;
    pullingText?: string;
    refreshingText?: string;
} & Record<string, unknown>;

const THRESHOLD = 64;
const MAX_PULL = 96;
const RESISTANCE = 0.5;

export function PullToRefresh({
    children,
    onRefresh,
    isPullable = true,
    className,
    pullingText,
    refreshingText,
    ...rest
}: Props) {
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const isFetching = useIsFetching() > 0;
    const blinkOnly = aurionDown && isFetching;
    const [isClosing, setIsClosing] = useState(false);
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const closingTimerRef = useRef<number | null>(null);
    const startYRef = useRef<number | null>(null);
    const activeRef = useRef(false);
    const pullRef = useRef(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const pullable = isPullable || blinkOnly;
    const pullableRef = useRef(pullable);
    const refreshingRef = useRef(refreshing);
    useEffect(() => {
        pullableRef.current = pullable;
        refreshingRef.current = refreshing;
    }, [pullable, refreshing]);

    useEffect(() => {
        return () => {
            if (closingTimerRef.current !== null) {
                window.clearTimeout(closingTimerRef.current);
            }
        };
    }, []);

    const scheduleClosingReset = useCallback(() => {
        setIsClosing(true);
        if (closingTimerRef.current !== null) {
            window.clearTimeout(closingTimerRef.current);
        }
        closingTimerRef.current = window.setTimeout(() => {
            setIsClosing(false);
            closingTimerRef.current = null;
        }, 240);
    }, []);

    const handleRefresh = useCallback(() => {
        if (aurionDown) requestAurionBlink();
        if (blinkOnly) {
            scheduleClosingReset();
            return Promise.resolve();
        }

        const escalateError = (error: unknown) => {
            setTimeout(() => {
                throw error;
            }, 0);
        };
        const isPromiseLike = (
            value: unknown
        ): value is PromiseLike<unknown> => {
            return (
                typeof value === "object" &&
                value !== null &&
                "then" in value &&
                typeof (value as { then?: unknown }).then === "function"
            );
        };

        try {
            const maybePromise = onRefresh();
            if (isPromiseLike(maybePromise)) {
                Promise.resolve(maybePromise).catch(escalateError);
            }
        } catch (error) {
            escalateError(error);
        }

        scheduleClosingReset();

        return Promise.resolve();
    }, [onRefresh, scheduleClosingReset, aurionDown, blinkOnly]);

    const handleRefreshRef = useRef(handleRefresh);
    useEffect(() => {
        handleRefreshRef.current = handleRefresh;
    }, [handleRefresh]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el) return;

        const onTouchStart = (e: TouchEvent) => {
            if (!pullableRef.current || refreshingRef.current) return;
            if (window.scrollY > 0) return;
            const touch = e.touches[0];
            if (!touch) return;
            startYRef.current = touch.clientY;
            activeRef.current = true;
        };

        const paintPull = (next: number) => {
            const prev = pullRef.current;
            pullRef.current = next;
            if (indicatorRef.current) indicatorRef.current.style.height = `${next}px`;
            if ((prev === 0) !== (next === 0) || (prev >= THRESHOLD) !== (next >= THRESHOLD)) {
                setPull(next);
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!activeRef.current || startYRef.current === null) return;
            const touch = e.touches[0];
            if (!touch) return;
            const delta = touch.clientY - startYRef.current;
            if (delta <= 0 || window.scrollY > 0) {
                if (window.scrollY > 0) activeRef.current = false;
                if (pullRef.current !== 0) paintPull(0);
                return;
            }
            e.preventDefault();
            paintPull(Math.min(MAX_PULL, delta * RESISTANCE));
        };

        const onTouchEnd = () => {
            if (!activeRef.current) return;
            activeRef.current = false;
            startYRef.current = null;
            const released = pullRef.current;
            pullRef.current = 0;
            if (released >= THRESHOLD) {
                setRefreshing(true);
                setPull(0);
                void Promise.resolve(handleRefreshRef.current()).finally(() => {
                    setRefreshing(false);
                });
            } else {
                setPull(0);
            }
        };

        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd);
        el.addEventListener("touchcancel", onTouchEnd);
        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
            el.removeEventListener("touchcancel", onTouchEnd);
        };
    }, []);

    const showPulling = pull > 0 && !refreshing;
    const indicatorHeight = refreshing ? THRESHOLD : pull;

    return (
        <div
            ref={rootRef}
            className={cn("min-h-[calc(100vh-16rem)]", className)}
            {...rest}
        >
            <div
                ref={indicatorRef}
                className="overflow-hidden"
                style={{
                    height: indicatorHeight,
                    transition:
                        pull > 0 ? "none" : "height 200ms ease-out",
                }}
                aria-live="polite"
            >
                {refreshing ? (
                    <div
                        className={cn(
                            "w-full py-2 text-left text-sm text-muted-foreground flex items-center gap-2 [&_svg]:size-5! transition-opacity duration-200 ease-out",
                            isClosing && "opacity-0"
                        )}
                    >
                        <Loader2 className="animate-spin" />
                        <span>{refreshingText}</span>
                    </div>
                ) : showPulling ? (
                    <div className="w-full py-2 text-left text-sm text-muted-foreground flex items-center gap-2 [&_svg]:size-5!">
                        <ArrowUpToLine
                            style={{
                                transform: `rotate(${pull >= THRESHOLD ? 180 : 0}deg)`,
                                transition: "transform 150ms ease-out",
                            }}
                        />
                        <span>{pullingText}</span>
                    </div>
                ) : null}
            </div>
            {children}
        </div>
    );
}
