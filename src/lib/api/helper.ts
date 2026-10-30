import { AssociationData, DailyMenu, MessageEntry, UpdatesEntry } from "@/types/data";
import { Building, RoomsForBuilding } from "@/types/findmyroom";
import { queryOptions } from "@tanstack/react-query";
import { getFromStorage, removeFromStorage, saveToStorage, clearSessionStorage } from "../utils/storage";

export const API_URL = import.meta.env.VITE_API_URL ?? "https://mauria-api.fly.dev";

export interface APIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface ApiRequestOptions {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

export interface ColleGroup {
    class: string | null;
    group: string | null;
}

export const EMPTY_MESSAGES: MessageEntry[] = Object.freeze([]) as unknown as MessageEntry[];

const SESSION_HEADER_KEY = "aurionSessionHeader";
export const MINUTE_MS = 1000 * 60;
export const DAY_MS = MINUTE_MS * 60 * 24;
export const DEFAULT_STALE_MS = MINUTE_MS * 5;
const CACHE_MAX = 64;
const FAST_PREFIXES = ["/associations", "/messages", "/updates", "/tools", "/lacatho/", "/crous/", "/findmyroom/", "/badjunia/"];

const freshUntilMap = new Map<string, number>();
const inflightMap = new Map<string, Promise<unknown>>();

let aurionSessionHeader = getFromStorage(SESSION_HEADER_KEY);
let sessionChannel: BroadcastChannel | null = null;
let cachedFirstName: string | null = null;
let sessionGuard = new AbortController();
let updatesHeadVersion: string | null = null;
let updatesCache: UpdatesEntry[] | null = null;

export const getSessionSignal = (): AbortSignal => sessionGuard.signal;

const resetSessionGuard = (): void => {
    sessionGuard.abort();
    sessionGuard = new AbortController();
};

const setBounded = <K, V>(map: Map<K, V>, key: K, value: V): void => {
    map.set(key, value);
    while (map.size > CACHE_MAX) {
        const oldest = map.keys().next();
        if (oldest.done) return;
        map.delete(oldest.value);
    }
};

const timeoutFor = (path: string): number =>
    path.startsWith("/aurion/warm") || path.startsWith("/aurion/login") ? 15_000 : FAST_PREFIXES.some((prefix) => path.startsWith(prefix)) ? 10_000 : 45_000;

const markFresh = (path: string, response: Response): void => {
    if (response.headers.get("warning")?.includes("110")) return;
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 0);
    const age = Number(response.headers.get("age") ?? 0);
    if (maxAge > age) setBounded(freshUntilMap, path, Date.now() + (maxAge - age) * 1000);
};

export function getDynamicStaleTime(path: string, fallbackMs = DEFAULT_STALE_MS, dataUpdatedAt?: number): number {
    const until = freshUntilMap.get(path);
    if (until === undefined) return fallbackMs;
    const remaining = until - (dataUpdatedAt ?? Date.now());
    return remaining > 0 ? remaining : 0;
}

export function pruneTransientCaches(): void {
    const now = Date.now();
    for (const [key, until] of freshUntilMap) if (until <= now) freshUntilMap.delete(key);
}

export function clearSessionScopedCaches(): void {
    resetSessionGuard();
    freshUntilMap.clear();
    inflightMap.clear();
    cachedFirstName = null;
    aurionSessionHeader = null;
    updatesHeadVersion = null;
    updatesCache = null;
    removeFromStorage(SESSION_HEADER_KEY);
    clearSessionStorage();
}

let completeLogout: ((remote: boolean) => void) | null = null;

export function bindCompleteLogout(fn: (remote: boolean) => void): void {
    completeLogout = fn;
}

const channel = (): BroadcastChannel | null => {
    if (sessionChannel) return sessionChannel;
    if (typeof BroadcastChannel === "undefined") return null;
    sessionChannel = new BroadcastChannel("mauria-session");
    sessionChannel.onmessage = (event: MessageEvent) => {
        const message = event.data as { type?: string; value?: string } | null;
        if (!message?.type) return;
        if (message.type === "session" && message.value) {
            aurionSessionHeader = message.value;
            saveToStorage(SESSION_HEADER_KEY, message.value);
        }
        if (message.type === "logout") {
            if (completeLogout) completeLogout(true);
            else clearSessionScopedCaches();
        }
    };
    return sessionChannel;
};

export function broadcastSessionEvent(type: "session" | "logout", value?: string): void {
    channel()?.postMessage({ type, value });
}

const adoptSession = (response: Response): void => {
    const next = response.headers.get("x-aurion-session");
    if (next && next !== aurionSessionHeader) {
        aurionSessionHeader = next;
        saveToStorage(SESSION_HEADER_KEY, next);
        broadcastSessionEvent("session", next);
    }
    const state = response.headers.get("x-session-state");
    if (state === "expired" || state === "stale") {
        if (completeLogout) completeLogout(false);
        else {
            clearSessionScopedCaches();
            broadcastSessionEvent("logout");
        }
    }
};

export function getSession(): { email: string; password: string } | null {
    const email = getFromStorage("email");
    const password = getFromStorage("password");
    return email && password ? { email, password } : null;
}

/**
 * Persists the session.
 *
 * Returns false when storage rejected the write. That happens in private modes and
 * when the browser blocks site data — `saveToStorage` catches the SecurityError and
 * reports failure rather than throwing. The caller MUST check this: navigating as if
 * the session were stored sends the user straight back to /login, because
 * `getSession()` then reads null. That is a silent infinite login loop.
 */
export function setSession(email: string, password: string): boolean {
    resetSessionGuard();
    const wroteEmail = saveToStorage("email", email);
    const wrotePassword = saveToStorage("password", password);
    return wroteEmail && wrotePassword;
}

export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = inflightMap.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const flight = run().finally(() => inflightMap.delete(key));
    setBounded(inflightMap, key, flight);
    return flight;
}

async function perform<T>(path: string, options: ApiRequestOptions): Promise<T | null> {
    const method = options.method ?? "POST";
    const hasBody = options.body !== undefined;
    const headers: Record<string, string> = { ...options.headers };
    const guard = sessionGuard.signal;
    const signals = [guard, AbortSignal.timeout(timeoutFor(path)), ...(options.signal ? [options.signal] : [])];
    aurionSessionHeader = getFromStorage(SESSION_HEADER_KEY);

    if (hasBody) headers["Content-Type"] = "application/json";
    if (aurionSessionHeader && path.startsWith("/aurion/")) headers["x-aurion-session"] = aurionSessionHeader;

    try {
        const response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
            signal: AbortSignal.any(signals),
        });
        if (guard.aborted) return null;
        adoptSession(response);
        if (!response.ok || response.status === 204 || response.headers.get("content-length") === "0") return null;
        const raw = await response.text();
        if (!raw) return null;
        const parsed = JSON.parse(raw) as T;
        markFresh(path, response);
        return parsed;
    } catch {
        return null;
    }
}

export async function apiRequest<T>(
    path: string,
    method: "GET" | "POST" = "POST",
    body?: Record<string, unknown>,
    headers?: Record<string, string>,
    options?: Omit<ApiRequestOptions, "method" | "body" | "headers">
): Promise<T | null> {
    const merged: ApiRequestOptions = { method, body, headers, ...(options ?? {}) };
    return method === "GET" ? dedupe(`${method}:${path}`, () => perform<T>(path, merged)) : perform<T>(path, merged);
}

export async function aurionPost<T>(path: string, body?: Record<string, unknown>): Promise<T | null> {
    const session = getSession();
    return session ? apiRequest<T>(path, "POST", { ...session, ...body }) : null;
}

export async function fetchFirstName(): Promise<string> {
    if (cachedFirstName === null) {
        cachedFirstName = getFromStorage("name") ?? deriveFirstName(getFromStorage("email"));
        saveToStorage("name", cachedFirstName);
    }
    return cachedFirstName;
}

export function getFirstName(): string | Promise<string> {
    return cachedFirstName ?? getFromStorage("name") ?? fetchFirstName();
}

function deriveFirstName(email: string | null): string {
    const match = email?.match(/^([\w+-]*)([.-])/);
    return match ? match[1].split(/[-.]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("-") : "";
}

export async function fetchColleGroup(email: string, confirmedCpg: boolean): Promise<ColleGroup | null> {
    return apiRequest<ColleGroup>("/colles/group", "POST", { email, confirmedCpg });
}

export async function fetchBuildings(): Promise<Building[] | null> {
    return apiRequest<Building[]>("/findmyroom/buildings", "GET");
}

export async function fetchRoomsForBuilding(buildingCode: string): Promise<RoomsForBuilding | null> {
    return apiRequest<RoomsForBuilding>(`/findmyroom/rooms/${encodeURIComponent(buildingCode)}`, "GET");
}

async function fetchMenu(path: string): Promise<DailyMenu | null> {
    const menu = await apiRequest<DailyMenu>(path, "GET");
    return menu?.restaurants?.length ? menu : null;
}

export async function fetchDailyMenu(): Promise<DailyMenu | null> {
    return fetchMenu("/lacatho/menu");
}

export async function fetchCastelRuMenu(): Promise<DailyMenu | null> {
    return fetchMenu("/crous/castelru/menu");
}

export async function fetchAssos(): Promise<AssociationData[] | null> {
    return apiRequest<AssociationData[]>("/associations", "GET");
}

export async function fetchImportantMessage(): Promise<MessageEntry[]> {
    const response = await apiRequest<MessageEntry[] | MessageEntry>("/messages", "GET");
    if (!response) return EMPTY_MESSAGES;
    return (Array.isArray(response) ? response : [response]).filter((entry) => entry?.title);
}

export async function fetchUpdates(): Promise<UpdatesEntry[] | null> {
    const latest = (await apiRequest<UpdatesEntry[]>("/updates?head=1", "GET"))?.[0]?.version ?? null;
    if (latest === null || (latest === updatesHeadVersion && updatesCache)) return updatesCache;
    const full = await apiRequest<UpdatesEntry[]>("/updates", "GET");
    updatesHeadVersion = latest;
    if (full) updatesCache = full;
    return full;
}

export const updatesQueryOptions = () =>
    queryOptions({
        queryKey: ["updates"],
        queryFn: fetchUpdates,
        staleTime: DEFAULT_STALE_MS,
        gcTime: DAY_MS,
    });
