import { useEffect } from "react";
import { queryOptions, useQueries } from "@tanstack/react-query";
import { fetchDailyMenu, fetchImportantMessage, getDynamicStaleTime } from "@/lib/api/helper";
import { useAurionWarm } from "@/lib/hooks/use-aurion-warm";
import { useJuniaStatus } from "@/lib/hooks/use-junia-status";
import { absencesQueryOptions, gradesQueryOptions, planningQueryOptions } from "@/lib/hooks/use-colles";
import { expectedFetchDuration, expectedWarmDuration, type JuniaStatus } from "@/lib/api/junia-status";

export type PrefetchKey = "planning" | "grades" | "absences" | "importantMessages" | "dailyMenu";

export const PREFETCH_KEYS: PrefetchKey[] = ["planning", "grades", "absences", "importantMessages", "dailyMenu"];

const FAST_QUERY_DURATION_MS = 2000;
const MESSAGES_STALE_MS = 5 * 60 * 1000;
const MENU_STALE_MS = 30 * 60 * 1000;
const DAY_MS = 1000 * 60 * 60 * 24;
const SLOW_KEYS = new Set<string>(["planning", "grades", "absences"]);

const starts = new Map<string, number>();

function markPrefetchStart(key: string) {
    if (!starts.has(key)) starts.set(key, Date.now());
}

export function clearPrefetchStarts() {
    starts.clear();
}

function expectedPrefetchDuration(status: JuniaStatus | null, key: string): number {
    if (key === "warm") return expectedWarmDuration(status);
    if (SLOW_KEYS.has(key)) return expectedFetchDuration(status, key as "planning" | "grades" | "absences");
    return FAST_QUERY_DURATION_MS;
}

export function prefetchProgress(status: JuniaStatus | null, key: string, settled: boolean): number {
    if (settled) return 100;
    const start = starts.get(key);
    if (!start) return 0;
    return Math.round(Math.min(0.97, (Date.now() - start) / expectedPrefetchDuration(status, key)) * 100);
}

const feedOptions = <T>(key: string, path: string, fetch: () => Promise<T | null>, staleMs: number) =>
    queryOptions({
        queryKey: [key],
        queryFn: fetch,
        staleTime: getDynamicStaleTime(path, staleMs),
        gcTime: DAY_MS,
        refetchOnWindowFocus: false,
        retry: 1,
    });

export function useWelcomePrefetch() {
    const { isWarming, status: warmStatus, fetchStatus: warmFetchStatus } = useAurionWarm();
    const aurionDown = useJuniaStatus()?.aurionDown ?? false;
    const slow = !isWarming && !aurionDown;

    const results = useQueries({
        queries: [
            planningQueryOptions(slow),
            gradesQueryOptions(slow),
            absencesQueryOptions(slow),
            feedOptions("importantMessages", "/messages", fetchImportantMessage, MESSAGES_STALE_MS),
            feedOptions("dailyMenu", "/lacatho/menu", fetchDailyMenu, MENU_STALE_MS),
        ],
    });

    useEffect(() => {
        if (warmFetchStatus === "fetching") markPrefetchStart("warm");
        for (let index = 0; index < results.length; index++) {
            if (results[index].fetchStatus === "fetching") markPrefetchStart(PREFETCH_KEYS[index]);
        }
    });

    return { results, isBusy: isWarming || results[0].isLoading, warm: { status: warmStatus } };
}
