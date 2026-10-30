/**
 * storage.ts - the cache in front of localStorage.
 *
 * The cache is what makes this module worth testing: every reader goes through
 * it, so a bug here silently serves stale data to the whole app. Two rules
 * matter and both have a plausible failure mode:
 *
 * 1. A failed `setItem` (quota, private mode, blocked site data) must NOT leave
 *    the cache believing the value was written. Otherwise `getFromStorage`
 *    reports a session that does not exist and the user loops on /login.
 * 2. A `storage` event from another tab must invalidate the cache, otherwise a
 *    second tab keeps showing the first tab's logged-out user.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
    clearSessionStorage,
    clearStorage,
    getFromStorage,
    onStorageChange,
    readJsonCached,
    removeFromStorage,
    saveToStorage,
} from "@/lib/utils/storage";

const originalSetItem = Storage.prototype.setItem;

const breakQuota = () => {
    Storage.prototype.setItem = function () {
        throw new DOMException("quota", "QuotaExceededError");
    };
};

beforeEach(() => {
    clearStorage();
});

afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    clearStorage();
});

describe("getFromStorage / saveToStorage", () => {
    it("returns null for a key that was never written", () => {
        expect(getFromStorage("absent")).toBeNull();
    });

    it("round-trips a value", () => {
        expect(saveToStorage("k", "v")).toBe(true);
        expect(getFromStorage("k")).toBe("v");
    });

    it("serves a repeated read from cache", () => {
        saveToStorage("k", "a");
        // Write behind the cache's back, as another tab would.
        localStorage.setItem("k", "b");
        expect(getFromStorage("k")).toBe("a");
    });

    it("re-reads after removeFromStorage", () => {
        saveToStorage("k", "a");
        removeFromStorage("k");
        expect(getFromStorage("k")).toBeNull();
        expect(localStorage.getItem("k")).toBeNull();
    });

    it("re-reads a value written behind the cache after a storage event", () => {
        saveToStorage("k", "a");
        removeFromStorage("k");
        localStorage.setItem("k", "c");
        window.dispatchEvent(Object.assign(new Event("storage"), { key: "k" }));
        expect(getFromStorage("k")).toBe("c");
    });
});

describe("a failed write must not poison the cache", () => {
    it("reports failure instead of throwing", () => {
        breakQuota();
        expect(() => saveToStorage("k", "v")).not.toThrow();
        expect(saveToStorage("k", "v")).toBe(false);
    });

    it("does not leave the failed value readable (the login-loop bug)", () => {
        breakQuota();
        saveToStorage("email", "student@example.com");
        // If the cache had accepted the write, getSession() would report a
        // session that storage does not actually hold.
        expect(getFromStorage("email")).toBeNull();
        expect(localStorage.getItem("email")).toBeNull();
    });

    it("recovers once quota returns", () => {
        breakQuota();
        saveToStorage("k", "v");
        Storage.prototype.setItem = originalSetItem;
        expect(saveToStorage("k", "v")).toBe(true);
        expect(getFromStorage("k")).toBe("v");
    });

    it("does not report a stale previous value as the new one", () => {
        saveToStorage("k", "old");
        breakQuota();
        expect(saveToStorage("k", "new")).toBe(false);
        expect(getFromStorage("k")).toBe("old");
        expect(localStorage.getItem("k")).toBe("old");
    });
});

describe("clearSessionStorage", () => {
    it("removes only the session keys", () => {
        saveToStorage("email", "a@b.c");
        saveToStorage("password", "pw");
        saveToStorage("name", "Name");
        saveToStorage("theme", "dark");

        clearSessionStorage();

        expect(getFromStorage("email")).toBeNull();
        expect(getFromStorage("password")).toBeNull();
        expect(getFromStorage("name")).toBeNull();
        expect(getFromStorage("theme")).toBe("dark");
    });
});

describe("readJsonCached", () => {
    it("passes an empty string to the transform when the key is missing", () => {
        expect(readJsonCached("missing", (raw) => `saw:${raw}`)).toBe("saw:");
    });

    it("re-runs the transform when the raw value changes", () => {
        saveToStorage("k", "1");
        expect(readJsonCached("k", (raw) => Number(raw) * 2)).toBe(2);
        saveToStorage("k", "2");
        expect(readJsonCached("k", (raw) => Number(raw) * 2)).toBe(4);
    });

    it("reuses the cached transform result for an unchanged raw value", () => {
        saveToStorage("k", "1");
        let calls = 0;
        const transform = (raw: string) => {
            calls += 1;
            return Number(raw);
        };
        readJsonCached("k", transform);
        readJsonCached("k", transform);
        expect(calls).toBe(1);
    });
});

describe("cross-tab invalidation", () => {
    it("a storage event drops the cached value", () => {
        saveToStorage("k", "a");
        expect(getFromStorage("k")).toBe("a");

        localStorage.setItem("k", "b");
        window.dispatchEvent(Object.assign(new Event("storage"), { key: "k" }));

        expect(getFromStorage("k")).toBe("b");
    });

    it("notifies observers with the changed key", () => {
        const seen: (string | null)[] = [];
        const off = onStorageChange((key) => seen.push(key));

        localStorage.setItem("k", "b");
        window.dispatchEvent(Object.assign(new Event("storage"), { key: "k" }));
        off();

        expect(seen).toEqual(["k"]);
    });

    it("stops notifying after unsubscribe", () => {
        const seen: (string | null)[] = [];
        const off = onStorageChange((key) => seen.push(key));
        off();

        window.dispatchEvent(Object.assign(new Event("storage"), { key: "k" }));

        expect(seen).toEqual([]);
    });
});
