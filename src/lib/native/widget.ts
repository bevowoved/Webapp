import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";

import type { Grade } from "@/types/aurion";
import type { WidgetLesson } from "@/lib/utils/home";

type GradesModule = typeof import("@/lib/utils/grades");

export type WidgetGradePoint = { student: number | null; class: number | null };
export type WidgetRecentGrade = { subject: string; badge: string | null; value: number; scale: number; classAvg: number | null; coefficient: number | null; date: string | null };
export type WidgetSubjectAvg = { subject: string; student: number | null; class: number | null };
export type WidgetGradesPayload = { scale: number; overallStudent: number | null; overallClass: number | null; evolution: WidgetGradePoint[]; recent: WidgetRecentGrade[]; bySubject: WidgetSubjectAvg[] };

type WidgetBridge = {
    update?: (data: { lessons: WidgetLesson[] }) => Promise<void>;
    updateGrades?: (data: WidgetGradesPayload) => Promise<void>;
    updateTheme?: (data: { theme: string }) => Promise<void>;
    updateLanguage?: (data: { language: string }) => Promise<void>;
};

type Slot = "planning" | "grades" | "theme" | "language";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SLOTS: Record<Slot, number> = { planning: 0, grades: 0, theme: 0, language: 0 };

const fnv1a = (input: string): number => {
    let hash = FNV_OFFSET;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    return hash;
};

const getPlugin = (): WidgetBridge | undefined => {
    const capacitor = (window as unknown as { Capacitor?: { Plugins?: { MauriaWidget?: WidgetBridge } } }).Capacitor?.Plugins?.MauriaWidget;
    if (capacitor) return capacitor;
    const handler = (window as unknown as { webkit?: { messageHandlers?: { MauriaWidget?: { postMessage: (b: unknown) => void } } } }).webkit?.messageHandlers?.MauriaWidget;
    if (!handler) return undefined;
    const post = (method: string) => (data: unknown) => {
        handler.postMessage({ method, data });
        return Promise.resolve();
    };
    return { update: post("update"), updateGrades: post("updateGrades"), updateTheme: post("updateTheme"), updateLanguage: post("updateLanguage") };
};

export const hasWidgetPlugin = (): boolean => getPlugin() !== undefined;

const callBridge = async (method: keyof WidgetBridge, payload: unknown, slot: Slot, hash: number): Promise<void> => {
    const fn = getPlugin()?.[method];
    if (!fn || SLOTS[slot] === hash) return;
    SLOTS[slot] = hash;
    try {
        await (fn as (data: unknown) => Promise<void>)(payload);
    } catch {
        SLOTS[slot] = 0;
    }
};

export const pushWidgetPlanning = (lessons: WidgetLesson[]): Promise<void> => callBridge("update", { lessons }, "planning", fnv1a(JSON.stringify(lessons)));
export const pushWidgetGrades = (payload: WidgetGradesPayload): Promise<void> => callBridge("updateGrades", payload, "grades", fnv1a(JSON.stringify(payload)));
export const pushWidgetTheme = (theme: string): Promise<void> => callBridge("updateTheme", { theme }, "theme", fnv1a(theme));
export const pushWidgetLanguage = (language: string): Promise<void> => callBridge("updateLanguage", { language }, "language", fnv1a(language));

const buildRecent = (g: GradesModule, grades: Grade[], label: (code: string) => string | null): WidgetRecentGrade[] =>
    grades
        .flatMap((grade) => {
            const value = g.parseGradeValue(grade.grade);
            if (!grade.date || value === null) return [];
            return [{ subject: grade.name || grade.code, badge: label(grade.code), value, scale: g.detectGradeScale(grade), classAvg: g.parseGradeValue(grade.average), coefficient: g.parseGradeValue(grade.coefficient), date: g.frDateToIso(grade.date) }];
        })
        .toSorted((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .slice(0, 8);

const buildPayload = (g: GradesModule, all: Grade[], label: (code: string) => string | null): WidgetGradesPayload => {
    const semesters = g.getGradeSemesters(all);
    const current = g.getCurrentSemesterKey();
    const semesterKey = semesters.some((s) => s.key === current) ? current : (semesters.at(-1)?.key ?? null);
    const grades = g.getGrades({ semesterKey, grades: all });
    const { overall, bySubject } = g.computeAverages(grades);
    return {
        scale: 20,
        overallStudent: overall.student,
        overallClass: overall.class,
        evolution: g.computeAverageEvolution(grades).map((p) => ({ student: p.student, class: p.class })),
        recent: buildRecent(g, grades, label),
        bySubject: bySubject.filter((s) => s.student !== null || s.class !== null).map((s) => ({ subject: label(s.labelKey) ?? s.labelKey, student: s.student, class: s.class })),
    };
};

export function useWidgetGradesSync(grades?: Grade[]) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const isRestoring = useIsRestoring();

    useEffect(() => {
        if (!hasWidgetPlugin()) return;
        const source = grades ?? queryClient.getQueryData<Grade[]>(["grades"]);
        if (!source?.length) return;
        let cancelled = false;
        void import("@/lib/utils/grades").then((g) => {
            if (cancelled) return;
            const label = (code: string) => {
                const key = g.getGradeBadgeInfoFromCode(code)?.labelKey;
                return key ? t(key) : null;
            };
            void pushWidgetGrades(buildPayload(g, source, label));
        });
        return () => {
            cancelled = true;
        };
    }, [grades, isRestoring, i18n.language, queryClient, t]);
}

export function useWidgetLanguageSync() {
    const { i18n } = useTranslation();
    useEffect(() => {
        if (!hasWidgetPlugin()) return;
        const push = (lng: string) => void pushWidgetLanguage(lng.split("-")[0] ?? lng);
        push(i18n.language);
        i18n.on("languageChanged", push);
        return () => {
            i18n.off("languageChanged", push);
        };
    }, [i18n]);
}
