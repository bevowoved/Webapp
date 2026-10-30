import { queryOptions, useQuery } from "@tanstack/react-query";
import { AURION_WARM_QUERY_KEY, getSession, isAurionWarmExpired, warmAurionSession } from "@/lib/api/aurion";

export { AURION_WARM_QUERY_KEY };

const DAY_MS = 1000 * 60 * 60 * 24;

export const aurionWarmQueryOptions = (enabled: boolean) =>
    queryOptions({
        queryKey: AURION_WARM_QUERY_KEY,
        queryFn: warmAurionSession,
        enabled,
        staleTime: () => (isAurionWarmExpired() ? 0 : Infinity),
        gcTime: DAY_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
    });

export function useAurionWarm() {
    const hasSession = !!getSession();
    const { status, fetchStatus, isFetching } = useQuery(aurionWarmQueryOptions(hasSession));
    const isWarming = hasSession && (status === "pending" || (isFetching && isAurionWarmExpired()));
    return { isWarming, status, fetchStatus };
}
