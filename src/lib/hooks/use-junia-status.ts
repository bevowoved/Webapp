import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchJuniaStatus, JuniaStatus } from "@/lib/api/junia-status";
import { getDynamicStaleTime } from "@/lib/api/helper";

const FRESH_MS = 1000 * 60 * 5;
const MINUTE_MS = 1000 * 60;

export const juniaStatusQueryOptions = () =>
    queryOptions({
        queryKey: ["juniaStatus"],
        queryFn: fetchJuniaStatus,
        staleTime: () => getDynamicStaleTime("/badjunia/status", MINUTE_MS),
        gcTime: FRESH_MS,
        retry: false,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        refetchInterval: MINUTE_MS,
        refetchIntervalInBackground: false,
    });

export function useJuniaStatus(): JuniaStatus | null {
    const { data, isStale } = useQuery(juniaStatusQueryOptions());
    return data && !isStale ? data : null;
}

const BLINK_EVENT = "mauria:aurion-blink";

export function requestAurionBlink() {
    window.dispatchEvent(new Event(BLINK_EVENT));
}

export { BLINK_EVENT };
