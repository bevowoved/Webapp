import { useMemo } from "react";
import { Cherry, Coins, Package, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Grade } from "@/types/aurion";
import { format, getDateLocale, parseFrDate } from "@/lib/utils/translations";
import { getGradeBadgeInfoFromCode, getRarityForGrade, parseGradeValue, type GradeRarity } from "@/lib/utils/grades";

export type RevealCardMode = "cs2" | "fdj" | "slots";

export type RevealCardTheme = {
    icon: LucideIcon;
    caseClass: string;
    cornerClass: string;
    iconClass: string;
    valueClass: string;
    badgeClass: string;
    ctaClass: string;
    dateClass: string;
    ctaKey: string;
    ctaShortKey: string;
};

export const REVEAL_CARD_THEMES: Record<RevealCardMode, RevealCardTheme> = {
    cs2: {
        icon: Package,
        caseClass: "cs2-case",
        cornerClass: "border-amber-400/70",
        iconClass: "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]",
        valueClass: "text-amber-300/80",
        badgeClass: "border-amber-400/60 text-amber-300",
        ctaClass: "bg-amber-400 text-zinc-950",
        dateClass: "text-amber-300/70",
        ctaKey: "gradesPage.clickToOpen",
        ctaShortKey: "gradesPage.clickToOpenShort",
    },
    fdj: {
        icon: Coins,
        caseClass: "fdj-case",
        cornerClass: "border-amber-300/70",
        iconClass: "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.85)]",
        valueClass:
            "mt-1.5 rounded-sm bg-[linear-gradient(135deg,#9aa1ab,#eef1f5_45%,#b9c0c9_70%,#e3e7ec)] text-zinc-600 shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
        badgeClass: "border-amber-300/60 text-amber-200",
        ctaClass: "bg-amber-400 text-emerald-950",
        dateClass: "text-emerald-100/70",
        ctaKey: "gradesPage.clickToScratch",
        ctaShortKey: "gradesPage.clickToScratchShort",
    },
    slots: {
        icon: Cherry,
        caseClass: "slots-case",
        cornerClass: "border-yellow-300/70",
        iconClass: "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]",
        valueClass: "text-yellow-200/80",
        badgeClass: "border-yellow-300/60 text-yellow-200",
        ctaClass: "bg-rose-500 text-white",
        dateClass: "text-yellow-200/70",
        ctaKey: "gradesPage.clickToSpin",
        ctaShortKey: "gradesPage.clickToSpinShort",
    },
};

export type GradeReveal = {
    value: number | null;
    rarity: GradeRarity;
    bigWin: boolean;
    delta: number | null;
    above: boolean;
    trendColor: string;
    subjectLabel: string | null;
    dateLabel: string | null;
    seed: number;
};

const hashKey = (input: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const hashSeed = (...parts: Array<string | number>): number => hashKey(parts.join("|"));

export const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const seededSpread = (seed: number, count: number, spread: number): number[] => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => (random() - 0.5) * spread);
};

export const trendTone = (above: boolean) => (above ? "#22c55e" : "#ef4444");

export const trendBadgeStyle = (tone: string) => ({
    backgroundColor: `${tone}1f`,
    boxShadow: `inset 0 0 0 1px ${tone}66`,
});

export const TREND_BADGE_CLASS = "flex items-center gap-2 rounded-sm px-3 py-1.5";

export const TREND_LABEL_CLASS = "font-mono text-[11px] font-bold uppercase tracking-wider";

export const TREND_VALUE_CLASS = "font-mono text-[11px] font-bold";

export const formatDelta = (delta: number): string =>
    `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)}`;

export const trendLabelKey = (above: boolean): string =>
    above ? "gradesPage.caseOpening.aboveAverage" : "gradesPage.caseOpening.belowAverage";

export const CORNERS = [
    "left-1 top-1 rounded-tl-sm border-l-2 border-t-2",
    "right-1 top-1 rounded-tr-sm border-r-2 border-t-2",
    "bottom-1 left-1 rounded-bl-sm border-b-2 border-l-2",
    "bottom-1 right-1 rounded-br-sm border-b-2 border-r-2",
] as const;

export const pickTier = <T extends { min: number }>(tiers: readonly T[], value: number): T => {
    let tier = tiers[0]!;
    for (const candidate of tiers) if (value >= candidate.min) tier = candidate;
    return tier;
};

export function useGradeReveal(grade: Grade): GradeReveal {
    const { t, i18n } = useTranslation();

    return useMemo(() => {
        const value = parseGradeValue(grade.grade);
        const rarity = getRarityForGrade(value ?? 0);
        const average = parseGradeValue(grade.average);
        const delta = value !== null && average !== null ? value - average : null;
        const above = delta !== null && delta >= 0;
        const badgeInfo = grade.code?.trim() ? getGradeBadgeInfoFromCode(grade.code) : null;

        let dateLabel: string | null = null;
        const parsed = parseFrDate(grade.date);
        if (parsed) dateLabel = format(parsed, "d MMM yyyy", { locale: getDateLocale(i18n.language) });

        return {
            value,
            rarity,
            bigWin: rarity.id === "covert" || rarity.id === "exceedingly-rare",
            delta,
            above,
            trendColor: trendTone(above),
            subjectLabel: badgeInfo?.labelKey ? t(badgeInfo.labelKey) : null,
            dateLabel,
            seed: hashSeed(grade.date, grade.code, grade.name),
        };
    }, [grade, t, i18n.language]);
}

export const formatTicketSerial = (seed: number): string =>
    `MAU-${String(seed % 10000).padStart(4, "0")}-${String(Math.floor(seed / 10000) % 10000).padStart(4, "0")}`;
