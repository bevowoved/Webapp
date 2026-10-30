import { useSyncExternalStore } from "react";
import type { Query, QueryKey } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { expectedFetchDuration, expectedWarmDuration, type JuniaStatus, type SlowQueryKey } from "@/lib/api/junia-status";
import { AURION_WARM_QUERY_KEY } from "@/lib/hooks/use-aurion-warm";

const DEFAULT_DURATION = 2000;
const WARM_QUERY_NAME = AURION_WARM_QUERY_KEY[0];
const SLOW_QUERY_KEYS: SlowQueryKey[] = ["documents", "grades", "planning", "absences"];
const TRACKED_NAMES = new Set<string>([WARM_QUERY_NAME, ...SLOW_QUERY_KEYS]);
const MIN = 0.05;
const MAX = 0.95;
const TICK_MS = 140;
const FOLLOW = 0.3;
const RAMP_MS = 800;
const HIDE_MS = 300;

export type FetchEntry = {
    id: string;
    name: string;
    progress: number;
};

type FetchProgress = {
    progress: number;
    visible: boolean;
    done: boolean;
    fetches: FetchEntry[];
};

type InFlightFetch = {
    name: string;
    start: number;
    expected: number;
    progress: number;
    queued: boolean;
};

const inFlight = new Map<string, InFlightFetch>();
const listeners = new Set<() => void>();
const EMPTY_FETCHES: FetchEntry[] = [];

let snapshot: FetchProgress = { progress: 0, visible: false, done: false, fetches: EMPTY_FETCHES };
let displayed = 0;
let cycleActive = false;
let tickId = 0;
let rampId = 0;
let hideId = 0;

function emit(next: Partial<FetchProgress>) {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
}

const toPercent = (ratio: number): number => Math.round(MIN * 100 + ratio * (MAX - MIN) * 100);

function listFetches(): FetchEntry[] {
    if (inFlight.size === 0) return EMPTY_FETCHES;
    const entries: FetchEntry[] = [];
    for (const [id, fetch] of inFlight) entries.push({ id, name: fetch.name, progress: toPercent(fetch.progress) });
    return entries;
}

const getStatus = (): JuniaStatus | null => queryClient.getQueryData<JuniaStatus | null>(["juniaStatus"]) ?? null;

function expectedDuration(queryKey: QueryKey): number {
    const key = String(queryKey[0]);
    if (key === WARM_QUERY_NAME) return expectedWarmDuration(getStatus());
    if (!TRACKED_NAMES.has(key)) return DEFAULT_DURATION;
    return expectedFetchDuration(getStatus(), key as SlowQueryKey);
}

function register(query: Query, name: string, queued: boolean, now: number): boolean {
    if (inFlight.has(query.queryHash)) return false;
    inFlight.set(query.queryHash, { name, start: now, expected: expectedDuration(query.queryKey), progress: 0, queued });
    return true;
}

function sync() {
    const now = Date.now();
    const fetching = new Set<string>();
    let changed = false;

    const cache = queryClient.getQueryCache();
    const warming = cache.find({ queryKey: AURION_WARM_QUERY_KEY })?.state.fetchStatus === "fetching";

    for (const query of cache.getAll()) {
        const name = String(query.queryKey[0]);
        if (!TRACKED_NAMES.has(name)) continue;
        const isWarm = name === WARM_QUERY_NAME;
        const { fetchStatus, status } = query.state;

        if (fetchStatus === "fetching") {
            fetching.add(query.queryHash);
            const existing = inFlight.get(query.queryHash);
            if (!existing) changed = register(query, name, false, now) || changed;
            else if (existing.queued) {
                Object.assign(existing, { queued: false, start: now, progress: 0 });
                changed = true;
            }
        } else if (!isWarm && warming && fetchStatus === "idle" && status !== "success") {
            fetching.add(query.queryHash);
            changed = register(query, name, true, now) || changed;
        }
    }

    for (const hash of inFlight.keys()) {
        if (fetching.has(hash)) continue;
        inFlight.delete(hash);
        changed = true;
    }

    if (changed) emit({ fetches: listFetches() });

    if (inFlight.size > 0 && !cycleActive) startCycle();
    else if (inFlight.size === 0 && cycleActive) finishCycle();
}

function stopTimers() {
    if (tickId) window.clearInterval(tickId);
    if (rampId) window.clearInterval(rampId);
    if (hideId) window.clearTimeout(hideId);
    tickId = rampId = hideId = 0;
}

function startCycle() {
    stopTimers();
    cycleActive = true;
    displayed = 0;
    emit({ progress: MIN * 100, visible: true, done: false });
    tickId = window.setInterval(tick, TICK_MS);
}

function tick() {
    if (inFlight.size === 0) {
        finishCycle();
        return;
    }
    const now = Date.now();
    const warm = [...inFlight.values()].find((fetch) => fetch.name === WARM_QUERY_NAME);

    let leadFinish = -Infinity;
    let leadRingProgress = 0;

    for (const fetch of inFlight.values()) {
        const behindWarm = fetch.queued && warm !== undefined && fetch !== warm;
        const start = behindWarm ? warm.start : fetch.start;
        const expected = behindWarm ? warm.expected + fetch.expected : fetch.expected;

        const ratio = (now - start) / expected;
        const base = MAX * (1 - Math.pow(1 - Math.min(1, ratio), 0.93));
        const burst = Math.random() < 0.22 ? Math.random() * 0.08 : 0;
        const ringValue = Math.min(MAX, base + (Math.random() - 0.5) * 0.03 + burst);

        if (!fetch.queued) fetch.progress = Math.min(MAX, Math.max(fetch.progress + 0.004, ringValue));

        const finish = start + expected;
        if (finish > leadFinish) {
            leadFinish = finish;
            leadRingProgress = fetch.queued ? ringValue : fetch.progress;
        }
    }
    if (leadFinish === -Infinity) return;

    displayed += (leadRingProgress - displayed) * FOLLOW;
    emit({ progress: toPercent(displayed), fetches: listFetches() });
}

function finishCycle() {
    if (tickId) {
        window.clearInterval(tickId);
        tickId = 0;
    }
    cycleActive = false;

    const rampFrom = snapshot.progress;
    if (rampFrom <= 0) {
        emit({ fetches: EMPTY_FETCHES });
        return;
    }
    const rampStart = Date.now();
    rampId = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - rampStart) / RAMP_MS);
        emit({ progress: Math.round(rampFrom + (100 - rampFrom) * (1 - Math.pow(1 - t, 3))) });
        if (t < 1) return;
        window.clearInterval(rampId);
        rampId = 0;
        emit({ done: true });
        hideId = window.setTimeout(() => {
            hideId = 0;
            emit({ visible: false });
        }, HIDE_MS);
    }, 16);
}

let subscribed = false;

function subscribe(listener: () => void) {
    if (!subscribed) {
        subscribed = true;
        queryClient.getQueryCache().subscribe(sync);
        sync();
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const getSnapshot = (): FetchProgress => snapshot;

export function useFetchProgress(): FetchProgress {
    return useSyncExternalStore(subscribe, getSnapshot);
}
