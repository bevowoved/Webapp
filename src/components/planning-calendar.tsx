import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDays, format, getDateLocale, isSameDay, isSunday, startOfWeek, toDate, toTime } from "@/lib/utils/date-time";
import { Lesson } from "@/types/aurion";
import {
    abbreviateSubjects,
    formatLessonCourse,
    formatLessonLocation,
    formatLessonTeacher,
    formatLessonType,
    parseFromTitle,
} from "@/lib/utils/home";
import { formatExtraTimeLabel } from "@/lib/utils/extra-time";
import "@/styles/planning-calendar.css";

const SLOT_MIN = 7 * 60;
const SLOT_MAX = 22 * 60;
const SLOT_STEP = 30;
const SLOT_COUNT = (SLOT_MAX - SLOT_MIN) / SLOT_STEP;
const DRIFT_PX = 10;
const SELECT_HOLD_MS = 200;
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => SLOT_MIN + i * SLOT_STEP);

export type PlanningView = "timeGridWeek" | "timeGridDay";

export type PlanningCalendarHandle = {
    prev?: () => void;
    next?: () => void;
    today?: () => void;
    changeView?: (view: PlanningView) => void;
    updateSize?: () => void;
    getApi?: () => unknown;
};

export type PlanningEventArg = {
    event: {
        id: string;
        title: string;
        start: Date;
        end: Date;
        classNames: string[];
        extendedProps: Record<string, unknown>;
        toJSON: () => Lesson;
    };
    [extra: string]: unknown;
};

export type PlanningSelectArg = { start: Date; end: Date };

type Props = {
    lessons?: Lesson[];
    eventSources?: Lesson[][];
    onEventClick?: (arg: PlanningEventArg) => void;
    eventClassNames?: (arg: PlanningEventArg) => string[];
    onSelect?: (arg: PlanningSelectArg) => void;
    ref?: React.Ref<PlanningCalendarHandle>;
};

const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

const asDate = (value: string | Date) => (value instanceof Date ? value : toDate(value));

const toArg = (lesson: Lesson, start: Date, end: Date): PlanningEventArg => ({
    event: {
        id: lesson.id,
        title: lesson.title,
        start,
        end,
        classNames: [lesson.className],
        extendedProps: lesson as unknown as Record<string, unknown>,
        toJSON: () => ({ ...lesson }),
    },
});

const placeLanes = <T extends { start: Date; end: Date }>(items: T[]) => {
    const sorted = items.toSorted((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
    const rows: T[][] = [];
    const at = new Map<T, { lane: number; span: number }>();
    for (const item of sorted) {
        let lane = rows.findIndex((row) => row[row.length - 1].end <= item.start);
        if (lane === -1) {
            lane = rows.length;
            rows.push([]);
        }
        rows[lane].push(item);
        at.set(item, { lane, span: 1 });
    }
    for (const item of sorted) {
        const info = at.get(item)!;
        for (let l = info.lane + 1; l < rows.length; l++) {
            if (rows[l].some((o) => o.start < item.end && o.end > item.start)) break;
            info.span++;
        }
    }
    const total = Math.max(1, rows.length);
    return sorted.map((item) => ({ ...item, ...at.get(item)!, total }));
};

const extraZones = (lesson: Lesson, start: Date, end: Date) => {
    const total = end.getTime() - start.getTime();
    const orig = lesson as unknown as { origStart?: string; origEnd?: string };
    if (total <= 0) return null;
    const clamp = (ms: number) => Math.max(0, Math.min(total, ms));
    const lead = orig.origStart ? clamp(toDate(orig.origStart).getTime() - start.getTime()) : 0;
    const trail = orig.origEnd ? clamp(end.getTime() - toDate(orig.origEnd).getTime()) : 0;
    if ((lead <= 0 && trail <= 0) || total <= lead + trail) return null;
    const pct = (ms: number) => `${(ms / total) * 100}%`;
    return { lead, trail, leadPct: pct(lead), trailTop: pct(total - trail), label: formatExtraTimeLabel(lead + trail), leadWins: lead > trail };
};

const rowOf = (m: number, edge: "start" | "end"): number => {
    const o = (Math.min(SLOT_MAX, Math.max(SLOT_MIN, m)) - SLOT_MIN) / SLOT_STEP;
    const line = (edge === "start" ? Math.floor(o) : Math.ceil(o)) + 1;
    return edge === "start" ? Math.min(SLOT_COUNT, Math.max(1, line)) : Math.min(SLOT_COUNT + 1, Math.max(1, line));
};

const describe = (lesson: Lesson) => {
    const { courseTitle, location, type, teacher } = parseFromTitle(lesson);
    const colle = lesson.className === "est-colle";
    const course = formatLessonCourse(courseTitle);
    const stripped = course.replace(/khôlle\s*(?:de\s+)?/gi, "").trim();
    return [
        lesson.className === "est-perso",
        formatLessonLocation(location),
        (colle ? stripped || course : course) || formatLessonType(type),
        colle ? formatLessonType(type) : "",
        formatLessonTeacher(teacher),
    ] as const;
};

export const PlanningCalendar = memo(function PlanningCalendar({ lessons, eventSources, onEventClick, eventClassNames, onSelect, ref }: Props) {
    const { t, i18n } = useTranslation();
    const locale = getDateLocale(i18n.language);
    const all = useMemo(() => lessons ?? eventSources?.flat() ?? [], [lessons, eventSources]);
    const [view, setView] = useState<PlanningView>("timeGridWeek");
    const [anchor, setAnchor] = useState(() => (isSunday(new Date()) ? addDays(new Date(), 1) : new Date()));
    const [now, setNow] = useState(() => new Date());
    const [ghost, setGhost] = useState<{ day: number; slot: number } | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const pressRef = useRef<{ x: number; y: number; day: number; slot: number } | null>(null);

    const step = useCallback((dir: number) => setAnchor((a) => addDays(a, dir * (view === "timeGridWeek" ? 7 : 1))), [view]);
    const goToday = useCallback(() => setAnchor(new Date()), []);

    useImperativeHandle(ref, () => ({ prev: () => step(-1), next: () => step(1), today: goToday, changeView: setView, updateSize: () => undefined }), [step, goToday]);

    useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(id);
    }, []);

    const days = useMemo(() => {
        const base = view === "timeGridWeek" ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor;
        return Array.from({ length: view === "timeGridWeek" ? 5 : 1 }, (_, i) => addDays(base, i));
    }, [anchor, view]);

    const byDay = useMemo(
        () =>
            days.map((day) => {
                const dayEnd = addDays(day, 1);
                return placeLanes(
                    all
                        .map((lesson) => ({ lesson, start: asDate(lesson.start), end: asDate(lesson.end) }))
                        .filter((e) => e.start < dayEnd && e.end > day)
                );
            }),
        [days, all]
    );

    const slotAt = useCallback((x: number, y: number) => {
        const grid = gridRef.current;
        if (!grid) return null;
        const col = [...grid.querySelectorAll<HTMLElement>("[data-day]")].find((node) => {
            const r = node.getBoundingClientRect();
            return x >= r.left && x < r.right;
        });
        if (!col) return null;
        const r = col.getBoundingClientRect();
        const ratio = (y - r.top) / r.height;
        return ratio < 0 || ratio > 1 ? null : { day: Number(col.dataset.day), slot: Math.min(SLOT_COUNT - 1, Math.floor(ratio * SLOT_COUNT)) };
    }, []);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid || !onSelect) return;
        let holdTimer: number | null = null;
        let ready = false;
        const clear = () => {
            if (holdTimer !== null) {
                window.clearTimeout(holdTimer);
                holdTimer = null;
            }
            ready = false;
            pressRef.current = null;
            setGhost(null);
        };
        const down = (e: Event) => {
            const p = e as PointerEvent;
            if ((p.target as Element).closest("[data-event]")) return;
            const hit = slotAt(p.clientX, p.clientY);
            if (!hit) return;
            pressRef.current = { x: p.clientX, y: p.clientY, ...hit };
            if (p.pointerType === "touch") {
                ready = false;
                holdTimer = window.setTimeout(() => {
                    ready = true;
                    holdTimer = null;
                    setGhost(hit);
                }, SELECT_HOLD_MS);
            } else {
                ready = true;
                setGhost(hit);
            }
        };
        const move = (e: Event) => {
            const p = pressRef.current;
            const ev = e as PointerEvent;
            if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > DRIFT_PX) clear();
        };
        const up = () => {
            const p = pressRef.current;
            if (p && ready) {
                const start = new Date(days[p.day].getTime() + (SLOT_MIN + p.slot * SLOT_STEP) * 60_000);
                onSelect({ start, end: new Date(start.getTime() + 60 * 60_000) });
            }
            clear();
        };
        const handlers: [string, (e: Event) => void][] = [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", clear]];
        for (const [type, fn] of handlers) grid.addEventListener(type, fn);
        return () => {
            for (const [type, fn] of handlers) grid.removeEventListener(type, fn);
            clear();
        };
    }, [days, onSelect, slotAt]);

    const nowDay = days.findIndex((d) => isSameDay(d, now));
    const nowRow = Math.floor((minuteOfDay(now) - SLOT_MIN) / SLOT_STEP) + 1;

    return (
        <div className="pcal">
            <div className="pcal-toolbar">
                <button type="button" className="pcal-btn" onClick={goToday}>
                    {t("schedulePage.buttons.today")}
                </button>
                <div className="pcal-views">
                    {(["timeGridWeek", "timeGridDay"] as const).map((v) => (
                        <button key={v} type="button" className={`pcal-btn${view === v ? " is-active" : ""}`} onClick={() => setView(v)}>
                            {t(v === "timeGridWeek" ? "schedulePage.buttons.week" : "schedulePage.buttons.day")}
                        </button>
                    ))}
                </div>
                <div className="pcal-nav">
                    <button type="button" className="pcal-btn" aria-label="previous" onClick={() => step(-1)}>{"\u2039"}</button>
                    <button type="button" className="pcal-btn" aria-label="next" onClick={() => step(1)}>{"\u203A"}</button>
                </div>
            </div>

            <div className="pcal-title">
                {format(days[0], view === "timeGridWeek" ? "d MMM" : "EEEE d MMM", { locale })}
            </div>

            <div className="pcal-head">
                <div className="pcal-gutter" />
                {days.map((day, i) => (
                    <div key={day.getTime()} className={`pcal-dayhead${i === nowDay ? " is-today" : ""}`}>
                        <span className="pcal-dayname">{format(day, "EEE", { locale })}</span>
                        <span className="pcal-daynum">{day.getDate()}</span>
                    </div>
                ))}
            </div>

            <div className="pcal-body">
                <div className="pcal-gutter">
                    {SLOTS.map((m, i) =>
                        m % 60 === 0 ? (
                            <div key={i} className="pcal-slotlabel" style={{ gridRow: i + 1 }}>
                                {toTime(new Date(days[0].getTime() + m * 60_000))}
                            </div>
                        ) : null
                    )}
                </div>

                <div ref={gridRef} className="pcal-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                    {days.map((_, dayIdx) => (
                        <div key={dayIdx} className="pcal-col" data-day={dayIdx}>
                            {SLOTS.map((m, i) => (
                                <div key={i} className={`pcal-slot${m % 60 === 0 ? " is-hour" : ""}`} />
                            ))}

                            {byDay[dayIdx].map(({ lesson, start, end, lane, span, total }) => {
                                const arg = toArg(lesson, start, end);
                                const extra = eventClassNames?.(arg) ?? [];
                                const classes = [lesson.className, ...extra].filter(Boolean).join(" ");
                                const [perso, place, heading, detail, tutor] = describe(lesson);
                                const zones = extraZones(lesson, start, end);
                                const rowStart = rowOf(minuteOfDay(start), "start");
                                const rowEnd = Math.max(rowStart + 1, rowOf(minuteOfDay(end) || SLOT_MAX, "end"));
                                const width = 100 / total;

                                return (
                                    <button
                                        type="button"
                                        key={`${lesson.id}-${start.getTime()}`}
                                        data-event
                                        className={`pcal-event ${classes}`}
                                        style={{
                                            gridRow: `${rowStart} / ${rowEnd}`,
                                            gridColumn: `${lane + 1} / span ${span}`,
                                            width: `${width * span}%`,
                                        }}
                                        onClick={() => onEventClick?.(arg)}
                                    >
                                        {zones && zones.lead > 0 && (
                                            <span className="pcal-extra pcal-extra-before" style={{ height: zones.leadPct }}>
                                                {zones.leadWins ? <span className="pcal-extra-label">{zones.label}</span> : null}
                                            </span>
                                        )}
                                        {zones && zones.trail > 0 && (
                                            <span className="pcal-extra pcal-extra-after" style={{ top: zones.trailTop }}>
                                                {!zones.leadWins ? <span className="pcal-extra-label">{zones.label}</span> : null}
                                            </span>
                                        )}
                                        <span className="pcal-event-title">
                                            {place && <span>{place}</span>}
                                            <strong>
                                                {perso ? lesson.title : (
                                                    <>
                                                        <span className="sm:hidden">{abbreviateSubjects(heading) || heading}</span>
                                                        <span className="hidden sm:inline">{heading}</span>
                                                    </>
                                                )}
                                            </strong>
                                            {(detail || tutor) && (
                                                <span>
                                                    {detail || tutor}
                                                    {detail && tutor && <span className="hidden sm:inline"> {tutor}</span>}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}

                            {ghost?.day === dayIdx && (
                                <div className="pcal-ghost is-pressing" style={{ gridRow: `${ghost.slot + 1}`, gridColumn: "1 / -1" }} />
                            )}

                            {nowDay === dayIdx && nowRow >= 1 && nowRow <= SLOT_COUNT && (
                                <div className="pcal-now" style={{ gridRow: `${nowRow}`, gridColumn: "1 / -1" }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
