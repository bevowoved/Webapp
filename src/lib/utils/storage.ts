import { useSyncExternalStore } from "react";

const MAX_STORAGE_CACHE = 128;
const MAX_JSON_CACHE = 32;
const cache = new Map<string, string | null>();
const jsonCache = new Map<string, { raw: string | null; value: unknown }>();
const listeners = new Map<string, Set<() => void>>();
const subscribes = new Map<string, (cb: () => void) => () => void>();
const observers = new Set<(key: string | null) => void>();

const store = (): Storage | null => {
    try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};

const raw = <T>(fn: (s: Storage) => T, fallback: T): T => {
    try { const s = store(); return s ? fn(s) : fallback; } catch { return fallback; }
};

const trim = (map: Map<string, unknown>, max: number) => {
    while (map.size > max) {
        const k = map.keys().next();
        if (k.done) break;
        map.delete(k.value as string);
    }
};

const invalidate = (key: string | null) => {
    if (key === null) { cache.clear(); jsonCache.clear(); return; }
    cache.delete(key);
    jsonCache.delete(key);
};

export const notifyStorage = (event: string) => listeners.get(event)?.forEach((fn) => fn());

export const onStorageChange = (observer: (key: string | null) => void): (() => void) => {
    observers.add(observer);
    return () => { observers.delete(observer); };
};

export const subscribeStorage = (event: string, callback: () => void): (() => void) => {
    let set = listeners.get(event);
    if (!set) listeners.set(event, (set = new Set()));
    set.add(callback);
    return () => {
        const current = listeners.get(event);
        current?.delete(callback);
        if (!current?.size) listeners.delete(event);
    };
};

const subscribe = (event: string) => {
    let fn = subscribes.get(event);
    if (!fn) subscribes.set(event, (fn = (cb: () => void) => subscribeStorage(event, cb)));
    return fn;
};

export const useStorageSync = <T>(event: string, read: () => T, fallback?: T): T =>
    useSyncExternalStore(subscribe(event), read, () => fallback as T);

export function getFromStorage(key: string): string | null {
    if (cache.has(key)) return cache.get(key) ?? null;
    const value = raw((s) => s.getItem(key), null);
    cache.set(key, value);
    trim(cache, MAX_STORAGE_CACHE);
    return value;
}

export function saveToStorage(key: string, value: string): boolean {
    if (cache.get(key) === value) return true;
    const written = raw((s) => { s.setItem(key, value); return true; }, false);
    if (!written) { invalidate(key); return false; }
    cache.set(key, value);
    trim(cache, MAX_STORAGE_CACHE);
    return true;
}

export function removeFromStorage(key: string) {
    invalidate(key);
    raw((s) => s.removeItem(key), undefined);
}

export const SESSION_KEYS = ["email", "password", "name"] as const;

export function clearSessionStorage() {
    for (const key of SESSION_KEYS) removeFromStorage(key);
}

export function clearStorage() {
    invalidate(null);
    raw((s) => s.clear(), undefined);
}

export function readJsonCached<T>(key: string, transform: (raw: string) => T): T {
    const source = getFromStorage(key);
    const hit = jsonCache.get(key);
    if (hit && hit.raw === source) return hit.value as T;
    const value = transform(source ?? "");
    jsonCache.set(key, { raw: source, value });
    trim(jsonCache, MAX_JSON_CACHE);
    return value;
}

export function writeAndNotify(key: string, value: string, event: string) {
    saveToStorage(key, value);
    notifyStorage(event);
}

export function createStorageState<T>(key: string, event: string, parse: (raw: string | null) => T, serialize: (v: T) => string) {
    const read = (): T => parse(getFromStorage(key));
    return {
        read,
        write: (value: T): void => writeAndNotify(key, serialize(value), event),
        useValue: (fallback: T): T => useStorageSync(event, read, fallback),
    };
}

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        invalidate(event.key);
        observers.forEach((observer) => observer(event.key));
        listeners.forEach((_, name) => notifyStorage(name));
    });
}
