import { apiRequest, getSessionSignal } from "./helper";
import { getFromStorage, removeFromStorage, saveToStorage } from "../utils/storage";

export interface AurionTimes {
    login: number | null;
    home: number | null;
    grades: number | null;
    planning: number | null;
    absences: number | null;
    documents: number | null;
}

export interface JuniaStatus {
    aurionDown: boolean;
    aurionSince: string | null;
    wifiDown: boolean;
    wifiSince: string | null;
    aurionTimes: AurionTimes;
}

export type SlowQueryKey = "documents" | "grades" | "planning" | "absences";

export const WARM_TTL_MS = 25 * 60 * 1000;

const WARM_STATE_KEY = "aurionWarmSession";
const FALLBACK_WARM_DURATION_MS = 6000;
const WARM_HIT_DURATION_MS = 300;

const FALLBACK_DURATION: Record<SlowQueryKey, number> = { documents: 15000, grades: 17000, planning: 10000, absences: 8000 };
const FALLBACK_STEP: Record<Exclude<SlowQueryKey, "documents">, number> = { grades: 1700, planning: 3600, absences: 1200 };

interface WarmState {
    warmFrom: number;
    lastActivityAt: number;
    email: string | null;
}

const readWarmState = (): WarmState | null => {
    try {
        const stored = getFromStorage(WARM_STATE_KEY);
        return stored ? (JSON.parse(stored) as WarmState) : null;
    } catch {
        return null;
    }
};

let warmState: WarmState | null = readWarmState();

const warm = (): WarmState | null => {
    if (warmState && warmState.email !== getFromStorage("email")) warmState = null;
    return warmState;
};

const loginPlusHome = (times: AurionTimes | undefined): number | null => (times?.login != null && times.home != null ? times.login + times.home : null);

export function markAurionSession(homeReadyInMs = 0): void {
    const now = Date.now();
    warmState = { warmFrom: now + homeReadyInMs, lastActivityAt: now, email: getFromStorage("email") };
    saveToStorage(WARM_STATE_KEY, JSON.stringify(warmState));
}

export function clearAurionSession(): void {
    warmState = null;
    removeFromStorage(WARM_STATE_KEY);
}

export function isAurionSessionWarm(): boolean {
    const state = warm();
    return state !== null && Date.now() >= state.warmFrom && Date.now() - state.lastActivityAt < WARM_TTL_MS;
}

export function isAurionWarmExpired(): boolean {
    const state = warm();
    return !state || Date.now() - state.lastActivityAt >= WARM_TTL_MS;
}

export function expectedFetchDuration(status: JuniaStatus | null, key: SlowQueryKey): number {
    if (key === "documents") return FALLBACK_DURATION.documents;
    const step = status?.aurionTimes?.[key] ?? null;
    if (isAurionSessionWarm()) return step ?? FALLBACK_STEP[key];
    const cold = loginPlusHome(status?.aurionTimes);
    return cold === null || step === null ? FALLBACK_DURATION[key] : cold + step;
}

export function expectedWarmDuration(status: JuniaStatus | null): number {
    if (isAurionSessionWarm()) return WARM_HIT_DURATION_MS;
    return loginPlusHome(status?.aurionTimes) ?? FALLBACK_WARM_DURATION_MS;
}

export async function fetchJuniaStatus(): Promise<JuniaStatus | null> {
    return apiRequest<JuniaStatus>("/badjunia/status", "GET", undefined, undefined, { signal: getSessionSignal() });
}
