import { createElement, useEffect, type ReactNode } from "react";
import { QueryCache, QueryClient, focusManager, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { clearUnopenedGrades, trackNewGrades } from "@/lib/utils/unopened-grades";
import { getFromStorage, removeFromStorage, saveToStorage } from "@/lib/utils/storage";
import { bindCompleteLogout, broadcastSessionEvent, clearSessionScopedCaches, getSession, pruneTransientCaches } from "@/lib/api/helper";
import { clearAurionSession } from "@/lib/api/junia-status";
import type { Grade } from "@/types/aurion";

export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

const BUFFER_SUFFIX = "-buffer";
const MAIN_KEY = "mauria-rq-cache";
const THROTTLE_MS = 1000;

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onSuccess: (data, query) => {
            if (query.queryKey[0] === "grades") trackNewGrades(data as Grade[]);
        },
    }),
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24,
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

const parseClient = (raw: string | null): PersistedClient | undefined => {
    try {
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
    } catch {
        return undefined;
    }
};

export function createDoubleBufferedPersister(key = MAIN_KEY): Persister {
    const bufferKey = `${key}${BUFFER_SUFFIX}`;
    let pending: PersistedClient | null = null;
    let lastWrittenJson: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: number | null = null;

    const write = (): void => {
        if (!pending) return;
        const serialized = JSON.stringify(pending);
        if (serialized === lastWrittenJson) {
            pending = null;
            return;
        }
        if (saveToStorage(bufferKey, serialized) && saveToStorage(key, serialized)) {
            lastWrittenJson = serialized;
            pending = null;
        }
    };

    const clearPending = (): void => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (idleHandle !== null) {
            cancelIdleCallback(idleHandle);
            idleHandle = null;
        }
    };

    const flush = (): void => {
        clearPending();
        write();
    };

    const schedule = (): void => {
        if (timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            if (typeof requestIdleCallback !== "function") return write();
            idleHandle = requestIdleCallback(() => {
                idleHandle = null;
                write();
            });
        }, THROTTLE_MS);
    };

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flush();
        });
        window.addEventListener("pagehide", flush);
    }

    return {
        persistClient: (client) => {
            pending = client;
            schedule();
        },
        restoreClient: () => parseClient(getFromStorage(key)) ?? parseClient(getFromStorage(bufferKey)),
        removeClient: () => {
            lastWrittenJson = null;
            pending = null;
            removeFromStorage(key);
            removeFromStorage(bufferKey);
        },
    };
}

const persister = createDoubleBufferedPersister();

const TRANSIENT_QUERY_KEYS = new Set(["juniaStatus", "aurionWarm", "colles-group"]);

const shouldDehydrateQuery = (query: Query): boolean =>
    query.state.status === "success" && query.state.data !== undefined && !TRANSIENT_QUERY_KEYS.has(String(query.queryKey[0]));

let logoutSync = false;

export function clearLogoutState(remote = false): void {
    if (logoutSync) return;
    logoutSync = true;
    try {
        void queryClient.cancelQueries(undefined, { revert: false });
        clearAurionSession();
        clearSessionScopedCaches();
        clearUnopenedGrades();
        persister.removeClient();
        queryClient.clear();
        if (!remote) broadcastSessionEvent("logout");
    } finally {
        logoutSync = false;
    }
}

if (typeof window !== "undefined") bindCompleteLogout(clearLogoutState);

export function ReactQueryProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const resume = (): void => {
            if (!navigator.onLine) return;
            void queryClient.resumePausedMutations();
        };
        const onVisible = (): void => {
            if (document.visibilityState === "visible" && !getSession()) clearLogoutState(true);
        };
        const listeners: [string, (event: Event) => void][] = [
            [
                "pageshow",
                (event) => {
                    if (!getSession()) clearLogoutState(true);
                    else if ((event as PageTransitionEvent).persisted) resume();
                },
            ],
            ["pagehide", () => pruneTransientCaches()],
        ];

        focusManager.subscribe((focused) => {
            if (focused) resume();
            else pruneTransientCaches();
        });

        document.addEventListener("visibilitychange", onVisible);
        for (const [type, listener] of listeners) window.addEventListener(type, listener);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            for (const [type, listener] of listeners) window.removeEventListener(type, listener);
        };
    }, []);

    return createElement(
        PersistQueryClientProvider,
        {
            client: queryClient,
            persistOptions: { persister, maxAge: PERSIST_MAX_AGE, dehydrateOptions: { shouldDehydrateQuery } },
            onSuccess: () => {
                void queryClient.resumePausedMutations();
            },
        },
        children
    );
}
