import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchAbsences, fetchDocuments, fetchGrades, fetchPlanning, getSession } from "@/lib/api/aurion";
import { fetchColleGroup, getDynamicStaleTime } from "@/lib/api/helper";
import { detectStudentClass, isCpgClass } from "@/lib/utils/grades";
import { buildCollesLessons } from "@/lib/utils/colles";
import { resolveDsLessons } from "@/lib/utils/ds";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { Absence, DocumentsResult, Grade, Lesson } from "@/types/aurion";

export const EMPTY_LESSONS: Lesson[] = Object.freeze([]) as unknown as Lesson[];
export const EMPTY_GRADES: Grade[] = Object.freeze([]) as unknown as Grade[];
export const EMPTY_ABSENCES: Absence[] = Object.freeze([]) as unknown as Absence[];

const DAY_MS = 1000 * 60 * 60 * 24;
const DEFAULT_STALE_MS = 5 * 60 * 1000;
const DOCUMENTS_STALE_MS = 10 * 60 * 1000;

const aurionOptions = <T>(key: string, path: string, fetch: () => Promise<{ success?: boolean; data?: T[] } | null>, empty: T[], enabled: boolean) =>
    queryOptions({
        queryKey: [key],
        queryFn: async (): Promise<T[]> => {
            const res = await fetch();
            if (!res?.success) throw new Error(`Failed to fetch ${key}`);
            return res.data ?? empty;
        },
        enabled,
        staleTime: (query) => getDynamicStaleTime(path, DEFAULT_STALE_MS, query.state.dataUpdatedAt),
        gcTime: DAY_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });

export const planningQueryOptions = (enabled = true) =>
    queryOptions({
        ...aurionOptions("planning", "/aurion/planning", fetchPlanning, EMPTY_LESSONS, enabled),
        placeholderData: (previousData: Lesson[] | undefined) => previousData ?? EMPTY_LESSONS,
    });

export const gradesQueryOptions = (enabled = true) =>
    queryOptions({
        ...aurionOptions("grades", "/aurion/grades", fetchGrades, EMPTY_GRADES, enabled),
        placeholderData: (previousData: Grade[] | undefined) => previousData ?? EMPTY_GRADES,
    });

export const absencesQueryOptions = (enabled = true) =>
    queryOptions({
        ...aurionOptions("absences", "/aurion/absences", fetchAbsences, EMPTY_ABSENCES, enabled),
        placeholderData: (previousData: Absence[] | undefined) => previousData ?? EMPTY_ABSENCES,
    });

export const documentsQueryOptions = (enabled = true) =>
    queryOptions({
        queryKey: ["documents"],
        queryFn: async (): Promise<DocumentsResult> => {
            const res = await fetchDocuments();
            if (!res?.success || !res.data) throw new Error("Failed to fetch documents");
            return res.data;
        },
        enabled,
        staleTime: (query) => getDynamicStaleTime("/aurion/documents", DOCUMENTS_STALE_MS, query.state.dataUpdatedAt),
        gcTime: DAY_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        placeholderData: (previousData: DocumentsResult | undefined) => previousData,
    });

export function usePlanning(): Lesson[] {
    const { isWarming } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const { data = EMPTY_LESSONS } = useQuery(planningQueryOptions(!isWarming && !aurionDown));
    return data;
}

function useColleGroup() {
    const { isWarming } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const { data: grades = EMPTY_GRADES } = useQuery(gradesQueryOptions(!isWarming && !aurionDown));
    const confirmedCpg = isCpgClass(detectStudentClass(grades));
    const email = getSession()?.email;
    const { data } = useQuery(
        queryOptions({
            queryKey: ["colles-group", email, confirmedCpg],
            queryFn: () => (email ? fetchColleGroup(email, confirmedCpg) : null),
            staleTime: DAY_MS,
            gcTime: DAY_MS,
            refetchIntervalInBackground: false,
            refetchOnWindowFocus: false,
        })
    );
    return data ?? null;
}

export function useColles(): Lesson[] {
    const { i18n } = useTranslation();
    const match = useColleGroup();
    return useMemo(() => {
        void i18n.language;
        return buildCollesLessons(match?.class, match?.group);
    }, [match?.class, match?.group, i18n.language]);
}

export function useResolvedPlanning(lessons: Lesson[]): Lesson[] {
    const match = useColleGroup();
    return useMemo(() => resolveDsLessons(lessons, match?.class), [lessons, match?.class]);
}
