"use client";

import { Grade } from "@/types/aurion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function parseNum(val?: string | null): number {
    if (!val) return NaN;
    return parseFloat(val.replace(",", "."));
}

export type EvolutionPoint = {
    date: string;
    student: number | null;
    class: number | null;
    studentAbove?: number | null;
    studentBelow?: number | null;
};

export type EvolutionSeries = {
    key: "student" | "class" | "studentAbove" | "studentBelow";
    label: string;
    stroke: string;
    strokeWidth: number;
    dash?: string;
    connectNulls?: boolean;
};

const CHART_PAD = { top: 6, right: 6, bottom: 16, left: 22 };
const CHART_H = 144;

export function GradesEvolutionChart({
    data,
    series,
    formatDate,
    yMax = 20,
    yTicks = 5,
    className,
}: {
    data: EvolutionPoint[];
    series: EvolutionSeries[];
    formatDate: (d: string) => string;
    yMax?: number;
    yTicks?: number;
    className?: string;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(320);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const obs = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 0;
            if (w > 0) setWidth(Math.round(w));
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const innerW = Math.max(1, width - CHART_PAD.left - CHART_PAD.right);
    const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
    const n = data.length;

    const xAt = (i: number) =>
        CHART_PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (v: number) =>
        CHART_PAD.top + innerH - (v / yMax) * innerH;

    const paths = useMemo(() => {
        const xCoord = (i: number) =>
            CHART_PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
        const yCoord = (v: number) =>
            CHART_PAD.top + innerH - (v / yMax) * innerH;
        return series.map((s) => {
            const segments: string[] = [];
            let current: string[] = [];
            for (let i = 0; i < n; i++) {
                const v = data[i][s.key];
                if (v === null || v === undefined) {
                    if (!s.connectNulls) {
                        if (current.length) segments.push(current.join(" "));
                        current = [];
                    }
                    continue;
                }
                const cmd = current.length === 0 ? "M" : "L";
                current.push(
                    `${cmd}${xCoord(i).toFixed(2)},${yCoord(v).toFixed(2)}`
                );
            }
            if (current.length) segments.push(current.join(" "));
            return { key: s.key, stroke: s.stroke, strokeWidth: s.strokeWidth, dash: s.dash, d: segments.join(" ") };
        });
    }, [data, series, yMax, innerW, innerH, n]);

    const ticks = useMemo(
        () =>
            Array.from({ length: yTicks }, (_, i) =>
                Math.round((yMax / (yTicks - 1)) * i)
            ),
        [yMax, yTicks]
    );

    const labelEvery = Math.max(1, Math.ceil(n / 4));

    const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = wrapRef.current;
        if (!el || n === 0) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) return;
        const rel = ((e.clientX - rect.left) / rect.width) * width;
        const t = (rel - CHART_PAD.left) / innerW;
        const idx = Math.round(t * (n - 1));
        setHover(Math.max(0, Math.min(n - 1, idx)));
    };

    const hoverPoint = hover !== null ? data[hover] : null;

    return (
        <div
            ref={wrapRef}
            className={className}
            style={{ position: "relative" }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
        >
            <svg
                viewBox={`0 0 ${width} ${CHART_H}`}
                width="100%"
                height={CHART_H}
                role="img"
                style={{ touchAction: "pan-y", display: "block" }}
            >
                {ticks.map((tv) => (
                    <g key={tv}>
                        <line
                            x1={CHART_PAD.left}
                            x2={width - CHART_PAD.right}
                            y1={yAt(tv)}
                            y2={yAt(tv)}
                            stroke="currentColor"
                            strokeOpacity={0.12}
                            strokeWidth={1}
                        />
                        <text
                            x={CHART_PAD.left - 4}
                            y={yAt(tv) + 3}
                            textAnchor="end"
                            fontSize={8}
                            fill="currentColor"
                            fillOpacity={0.55}
                        >
                            {tv}
                        </text>
                    </g>
                ))}

                {data.map((point, i) =>
                    i % labelEvery === 0 || i === n - 1 ? (
                        <text
                            key={`${point.date}-${i}`}
                            x={xAt(i)}
                            y={CHART_H - 4}
                            textAnchor="middle"
                            fontSize={8}
                            fill="currentColor"
                            fillOpacity={0.55}
                        >
                            {formatDate(point.date)}
                        </text>
                    ) : null
                )}

                {paths.map((p) =>
                    p.d ? (
                        <path
                            key={p.key}
                            d={p.d}
                            fill="none"
                            stroke={p.stroke}
                            strokeWidth={p.strokeWidth}
                            strokeDasharray={p.dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    ) : null
                )}

                {hover !== null && (
                    <g>
                        <line
                            x1={xAt(hover)}
                            x2={xAt(hover)}
                            y1={CHART_PAD.top}
                            y2={CHART_PAD.top + innerH}
                            stroke="currentColor"
                            strokeOpacity={0.3}
                            strokeWidth={1}
                            strokeDasharray="3 3"
                        />
                        {series.map((s) => {
                            const v = data[hover][s.key];
                            if (v === null || v === undefined) return null;
                            return (
                                <circle
                                    key={s.key}
                                    cx={xAt(hover)}
                                    cy={yAt(v)}
                                    r={2.5}
                                    fill={s.stroke}
                                />
                            );
                        })}
                    </g>
                )}
            </svg>

            {hoverPoint && (
                <div
                    className="pointer-events-none absolute z-10 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl space-y-1"
                    style={{
                        left: `${(xAt(hover!) / width) * 100}%`,
                        top: 0,
                        transform:
                            hover! > n / 2
                                ? "translateX(-105%)"
                                : "translateX(5%)",
                    }}
                >
                    <p className="font-medium">{formatDate(hoverPoint.date)}</p>
                    {series.map((s) => {
                        const v = hoverPoint[s.key];
                        if (v === null || v === undefined) return null;
                        return (
                            <div key={s.key} className="flex items-center gap-2">
                                <div
                                    className="h-2 w-2 shrink-0 rounded-[2px]"
                                    style={{ backgroundColor: s.stroke }}
                                />
                                <span className="text-muted-foreground">
                                    {s.label}
                                </span>
                                <span className="ml-auto pl-3 font-mono font-medium tabular-nums">
                                    {Number(v).toFixed(2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function GradePositionSlider({ grade }: { grade: Grade }) {
    const { t } = useTranslation();
    const trackRef = useRef<HTMLDivElement>(null);
    const [trackW, setTrackW] = useState(300);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        const obs = new ResizeObserver((entries) => {
            setTrackW(entries[0].contentRect.width);
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const myGrade = parseNum(grade.grade);
    const avg = parseNum(grade.average);
    const median = parseNum(grade.median);
    const min = parseNum(grade.min);
    const max = parseNum(grade.max);

    const allValues = [myGrade, avg, median, min, max].filter((v) => !isNaN(v) && v > 0);
    const scale = allValues.every((v) => v <= 10) ? 10 : 20;
    const pct = (val: number) =>
        `${Math.min(100, Math.max(0, (val / scale) * 100))}%`;

    const isAboveAverage = !isNaN(avg) && myGrade >= avg;
    const accentColor = isAboveAverage ? "hsl(142 70% 45%)" : "hsl(0 70% 55%)";

    const labelMin = t("gradesPage.min");
    const labelAverage = t("gradesPage.average");
    const labelMedian = t("gradesPage.median");
    const labelMax = t("gradesPage.max");

    const classMarkers = [
        { value: min, label: labelMin },
        { value: avg, label: labelAverage },
        { value: median, label: labelMedian },
        { value: max, label: labelMax },
    ].filter((m) => !isNaN(m.value) && m.value > 0);

    const sd = parseNum(grade.standardDeviation);
    const sdStart = !isNaN(avg) && !isNaN(sd) ? Math.max(0, avg - sd) : null;
    const sdEnd   = !isNaN(avg) && !isNaN(sd) ? Math.min(scale, avg + sd) : null;

    const TRACK_TOP = 44;
    const TRACK_H = 12;
    const DOT_SIZE = 22;
    const CHAR_W = 5.5;
    const GAP = 4;
    const ROW_H = 14;

    const markerLayout = (() => {
        const halfW = (text: string) => (text.length * CHAR_W) / 2;
        const overlapsH = (posA: number, labelA: string, posB: number, labelB: string) => {
            const pxA = (posA / 100) * trackW;
            const pxB = (posB / 100) * trackW;
            return Math.abs(pxA - pxB) < halfW(labelA) + halfW(labelB) + GAP;
        };

        const sorted = classMarkers.toSorted((a, b) => a.value - b.value);

        const numbersAbove = sorted.reduce<Array<{ value: number; label: string; visible: boolean }>>((acc, m) => {
            const lastVisible = acc.findLast((p) => p.visible);
            const visible =
                !lastVisible ||
                !overlapsH(
                    (m.value / scale) * 100,
                    String(m.value),
                    (lastVisible.value / scale) * 100,
                    String(lastVisible.value)
                );
            acc.push({ ...m, visible });
            return acc;
        }, []);

        const placedMarkers = sorted.reduce<Array<{ value: number; label: string; row: number }>>((acc, m) => {
            const pos = (m.value / scale) * 100;
            let row = 0;
            while (acc.filter((p) => p.row === row).some((p) => overlapsH(pos, m.label, (p.value / scale) * 100, p.label))) {
                row++;
            }
            acc.push({ ...m, row });
            return acc;
        }, []);

        const maxRow = placedMarkers.reduce((max, m) => Math.max(max, m.row), 0);
        return { numbersAbove, placedMarkers, maxRow };
    })();

    const { numbersAbove, placedMarkers, maxRow } = markerLayout;

    if (isNaN(myGrade)) return null;

    const labelsBottom = TRACK_TOP + TRACK_H + 4 + (4 + maxRow * ROW_H) + 10;
    const SD_TOP = labelsBottom + 6;
    const containerH = SD_TOP + 20;

    return (
        <div className="space-y-1">
            <p className="text-sm font-medium">{t("gradesPage.positionInClass")}</p>
            <div className="relative w-full" style={{ height: containerH }}>
                <div
                    ref={trackRef}
                    className="absolute left-0 right-0 rounded-full bg-muted"
                    style={{ top: TRACK_TOP, height: TRACK_H }}
                />
                <div
                    className="absolute left-0 right-0 overflow-hidden rounded-full"
                    style={{ top: TRACK_TOP, height: TRACK_H }}
                >
                    <div
                        className="absolute left-0 top-0 h-full"
                        style={{ width: pct(myGrade), backgroundColor: accentColor, opacity: 0.35 }}
                    />
                </div>
                {classMarkers.map((m) => (
                    <div
                        key={m.label}
                        className="absolute"
                        style={{
                            left: pct(m.value),
                            top: TRACK_TOP,
                            width: 2,
                            height: TRACK_H,
                            transform: "translateX(-50%)",
                            backgroundColor: "hsl(var(--muted-foreground) / 0.45)",
                        }}
                    />
                ))}
                <div
                    className="absolute"
                    style={{
                        left: pct(myGrade),
                        top: TRACK_TOP + TRACK_H / 2,
                        transform: "translate(-50%, -50%)",
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        borderRadius: "50%",
                        backgroundColor: accentColor,
                        border: "2.5px solid hsl(var(--background))",
                        boxShadow: `0 0 0 3px ${accentColor}40, 0 2px 6px rgba(0,0,0,0.18)`,
                        zIndex: 10,
                    }}
                />
                <div
                    className="absolute flex flex-col items-center"
                    style={{ left: pct(myGrade), top: 0, transform: "translateX(-50%)" }}
                >
                    <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: accentColor }}
                    >
                        {grade.grade}/{scale}
                    </span>
                    <div className="w-px" style={{ height: 8, backgroundColor: accentColor }} />
                </div>
                {numbersAbove.map((m) =>
                    m.visible ? (
                        <div
                            key={m.label}
                            className="absolute flex flex-col items-center"
                            style={{
                                left: pct(m.value),
                                top: TRACK_TOP - 18,
                                transform: "translateX(-50%)",
                            }}
                        >
                            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                                {m.value}
                            </span>
                            <div
                                className="w-px"
                                style={{ height: 4, backgroundColor: "hsl(var(--muted-foreground) / 0.3)" }}
                            />
                        </div>
                    ) : null
                )}
                {placedMarkers.map((m) => (
                    <div
                        key={m.label}
                        className="absolute flex flex-col items-center"
                        style={{
                            left: pct(m.value),
                            top: TRACK_TOP + TRACK_H + 4,
                            transform: "translateX(-50%)",
                        }}
                    >
                        <div
                            className="w-px"
                            style={{
                                height: 4 + m.row * ROW_H,
                                backgroundColor: "hsl(var(--muted-foreground) / 0.3)",
                            }}
                        />
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {m.label}
                        </span>
                    </div>
                ))}
                <div
                    className="absolute left-0 right-0 flex justify-between"
                    style={{ top: TRACK_TOP + TRACK_H + 4 }}
                >
                    <span className="text-[9px] text-muted-foreground/40">0</span>
                    <span className="text-[9px] text-muted-foreground/40">{scale}</span>
                </div>
                {sdStart !== null && sdEnd !== null && (
                    <>
                        <div
                            className="absolute w-px bg-muted-foreground/40"
                            style={{ left: pct(sdStart), top: SD_TOP, height: 8 }}
                        />
                        <div
                            className="absolute w-px bg-muted-foreground/40"
                            style={{ left: pct(sdEnd), top: SD_TOP, height: 8 }}
                        />
                        <div
                            className="absolute bg-muted-foreground/40"
                            style={{
                                left: pct(sdStart),
                                width: `${((sdEnd - sdStart) / scale) * 100}%`,
                                top: SD_TOP + 4,
                                height: 1,
                            }}
                        />
                        <div
                            className="absolute flex justify-center"
                            style={{
                                left: pct(sdStart),
                                width: `${((sdEnd - sdStart) / scale) * 100}%`,
                                top: SD_TOP + 8,
                            }}
                        >
                            <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">
                                {t("gradesPage.standardDeviation")}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

