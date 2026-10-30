import { type KeyboardEvent, useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    isSameDay,
    isSameMonth,
    isToday,
    localeTag,
    startOfMonth,
    startOfWeek,
} from "@/lib/utils/date-time";

export type CalendarProps = {
    mode?: "single";
    selected?: Date;
    defaultMonth?: Date;
    onSelect?: (date: Date | undefined) => void;
    className?: string;
    locale?: { code?: string } | string;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    showOutsideDays?: boolean;
    buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

const WEEK_LENGTH = 7;

const weekdayLabel = (tag: string, index: number): string =>
    new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2021, 7, 1 + index, 12))
    );

const monthLabel = (tag: string, month: Date): string =>
    new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(month);

const dayLabel = (tag: string, day: Date): string =>
    new Intl.DateTimeFormat(tag, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(day);

export function Calendar({
    selected,
    defaultMonth,
    onSelect,
    className,
    locale,
    weekStartsOn = 1,
    showOutsideDays = true,
    buttonVariant = "ghost",
}: CalendarProps) {
    const { t } = useTranslation();
    const tag = localeTag(locale);
    const [month, setMonth] = useState(() =>
        startOfMonth(selected ?? defaultMonth ?? new Date())
    );
    const gridRef = useRef<HTMLTableSectionElement>(null);

    const weeks = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn });
        const all = eachDayOfInterval({ start, end });
        return Array.from({ length: all.length / WEEK_LENGTH }, (_, i) =>
            all.slice(i * WEEK_LENGTH, (i + 1) * WEEK_LENGTH)
        );
    }, [month, weekStartsOn]);

    const weekdays = useMemo(
        () =>
            Array.from({ length: WEEK_LENGTH }, (_, index) =>
                weekdayLabel(tag, (index + weekStartsOn) % WEEK_LENGTH)
            ),
        [tag, weekStartsOn]
    );

    const focusDay = useCallback((target: Date) => {
        const key = target.toLocaleDateString();
        requestAnimationFrame(() => {
            gridRef.current
                ?.querySelector<HTMLButtonElement>(`button[data-day="${CSS.escape(key)}"]`)
                ?.focus();
        });
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLButtonElement>, day: Date) => {
            let next: Date | null = null;
            if (e.key === "ArrowLeft") next = addDays(day, -1);
            else if (e.key === "ArrowRight") next = addDays(day, 1);
            else if (e.key === "ArrowUp") next = addDays(day, -7);
            else if (e.key === "ArrowDown") next = addDays(day, 7);
            else if (e.key === "Home") next = startOfWeek(day, { weekStartsOn });
            else if (e.key === "End") next = endOfWeek(day, { weekStartsOn });
            else if (e.key === "PageUp") next = addMonths(day, -1);
            else if (e.key === "PageDown") next = addMonths(day, 1);
            if (!next) return;
            e.preventDefault();
            if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
            focusDay(next);
        },
        [focusDay, month, weekStartsOn]
    );

    const navBtnClass = cn(
        buttonVariants({ variant: buttonVariant }),
        "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50"
    );

    return (
        <div
            data-slot="calendar"
            className={cn(
                "bg-background group/calendar w-fit p-3 [--cell-size:2rem] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
                className
            )}
        >
            <div className="relative flex flex-col gap-4 md:flex-row">
                <div className="flex w-full flex-col gap-4">
                    <nav
                        className="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1"
                        aria-label={monthLabel(tag, month)}
                    >
                        <button
                            type="button"
                            className={navBtnClass}
                            onClick={() => setMonth((m) => addMonths(m, -1))}
                            aria-label={t("common.previous")}
                        >
                            <ChevronLeftIcon className="size-4" />
                        </button>
                        <button
                            type="button"
                            className={navBtnClass}
                            onClick={() => setMonth((m) => addMonths(m, 1))}
                            aria-label={t("common.next")}
                        >
                            <ChevronRightIcon className="size-4" />
                        </button>
                    </nav>
                    <div className="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
                        <span className="select-none text-sm font-medium">
                            {monthLabel(tag, month)}
                        </span>
                    </div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="flex">
                                {weekdays.map((label, index) => (
                                    <th
                                        key={`${label}-${index}`}
                                        scope="col"
                                        className="text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody ref={gridRef}>
                            {weeks.map((week, weekIdx) => (
                                <tr key={weekIdx} className="mt-2 flex w-full">
                                    {week.map((day) => {
                                        const outside = !isSameMonth(day, month);
                                        if (outside && !showOutsideDays) {
                                            return (
                                                <td
                                                    key={day.toISOString()}
                                                    className="invisible relative aspect-square h-full w-full p-0"
                                                />
                                            );
                                        }
                                        const isSelected = Boolean(
                                            selected && isSameDay(day, selected)
                                        );
                                        const today = isToday(day);
                                        return (
                                            <td
                                                key={day.toISOString()}
                                                data-selected={isSelected || undefined}
                                                className={cn(
                                                    "group/day relative aspect-square h-full w-full select-none p-0 text-center",
                                                    today &&
                                                        "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
                                                    outside &&
                                                        "text-muted-foreground aria-selected:text-muted-foreground"
                                                )}
                                            >
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    data-day={day.toLocaleDateString()}
                                                    data-selected-single={isSelected}
                                                    aria-label={dayLabel(tag, day)}
                                                    aria-selected={isSelected}
                                                    aria-current={today ? "date" : undefined}
                                                    onClick={() => {
                                                        setMonth(startOfMonth(day));
                                                        onSelect?.(day);
                                                    }}
                                                    onKeyDown={(e) => handleKeyDown(e, day)}
                                                    className={cn(
                                                        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none",
                                                        outside && "text-muted-foreground"
                                                    )}
                                                >
                                                    {day.getDate()}
                                                </Button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

