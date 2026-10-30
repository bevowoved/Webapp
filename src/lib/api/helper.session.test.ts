/**
 * helper.ts - session persistence, request de-duplication, cache freshness.
 *
 * `setSession` is documented as returning false when storage rejects the write,
 * and the comment says the caller MUST check it or the user loops on /login.
 * That contract is invisible from the UI, so it is pinned here.
 *
 * `dedupe` is what stops three components mounting at once from firing three
 * identical GETs. Its failure mode is subtle: if a rejected promise stayed in
 * the map, every later attempt would replay the rejection.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
    clearSessionScopedCaches,
    dedupe,
    DEFAULT_STALE_MS,
    getDynamicStaleTime,
    getSession,
    pruneTransientCaches,
    setSession,
} from "@/lib/api/helper";
import { clearStorage } from "@/lib/utils/storage";

const originalSetItem = Storage.prototype.setItem;

beforeEach(() => {
    clearStorage();
    clearSessionScopedCaches();
});

afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    clearStorage();
    clearSessionScopedCaches();
});

describe("setSession", () => {
    it("stores both halves and reports success", () => {
        expect(setSession("student@example.com", "pw")).toBe(true);
        expect(getSession()).toEqual({ email: "student@example.com", password: "pw" });
    });

    it("reports failure when storage rejects the write", () => {
        Storage.prototype.setItem = function () {
            throw new DOMException("quota", "QuotaExceededError");
        };
        expect(setSession("student@example.com", "pw")).toBe(false);
    });

    it("leaves no half-session readable after a failed write", () => {
        Storage.prototype.setItem = function () {
            throw new DOMException("quota", "QuotaExceededError");
        };
        setSession("student@example.com", "pw");
        // getSession must not report a session the app cannot rely on.
        expect(getSession()).toBeNull();
    });

    it("reports failure when only the password write fails", () => {
        let calls = 0;
        Storage.prototype.setItem = function (key: string, value: string) {
            calls += 1;
            if (key === "password") throw new DOMException("quota", "QuotaExceededError");
            return originalSetItem.call(this, key, value);
        };
        expect(setSession("student@example.com", "pw")).toBe(false);
        expect(calls).toBe(2);
    });

    it("getSession is null when either half is missing", () => {
        setSession("student@example.com", "pw");
        localStorage.removeItem("password");
        clearSessionScopedCaches();
        expect(getSession()).toBeNull();
    });
});

describe("dedupe", () => {
    it("runs the work once for concurrent callers", async () => {
        let calls = 0;
        const run = () => {
            calls += 1;
            return new Promise<string>((resolve) => setTimeout(() => resolve("v"), 5));
        };

        const [a, b] = await Promise.all([dedupe("k", run), dedupe("k", run)]);

        expect(calls).toBe(1);
        expect([a, b]).toEqual(["v", "v"]);
    });

    it("runs the work again once the first flight settled", async () => {
        let calls = 0;
        const run = () => {
            calls += 1;
            return Promise.resolve("v");
        };

        await dedupe("k", run);
        await dedupe("k", run);

        expect(calls).toBe(2);
    });

    it("does not cache a rejection", async () => {
        let calls = 0;
        const failing = () => {
            calls += 1;
            return Promise.reject(new Error("boom"));
        };

        await expect(dedupe("k", failing)).rejects.toThrow("boom");
        await expect(dedupe("k", failing)).rejects.toThrow("boom");

        expect(calls).toBe(2);
    });

    it("keeps different keys independent", async () => {
        let calls = 0;
        const run = (v: string) => () => {
            calls += 1;
            return Promise.resolve(v);
        };

        const [a, b] = await Promise.all([dedupe("a", run("A")), dedupe("b", run("B"))]);

        expect(calls).toBe(2);
        expect([a, b]).toEqual(["A", "B"]);
    });
});

describe("getDynamicStaleTime", () => {
    it("returns the fallback for a path with no freshness header", () => {
        expect(getDynamicStaleTime("/aurion/grades")).toBe(DEFAULT_STALE_MS);
        expect(getDynamicStaleTime("/aurion/grades", 1234)).toBe(1234);
    });

    it("pruneTransientCaches does not throw on an empty map", () => {
        expect(() => pruneTransientCaches()).not.toThrow();
    });
});

describe("clearSessionScopedCaches", () => {
    it("drops the stored session", () => {
        setSession("student@example.com", "pw");
        clearSessionScopedCaches();
        expect(getSession()).toBeNull();
    });

    it("is safe to call twice", () => {
        setSession("student@example.com", "pw");
        clearSessionScopedCaches();
        expect(() => clearSessionScopedCaches()).not.toThrow();
    });
});

describe("a failed write does not break the next successful one", () => {
    it("recovers after quota is restored", () => {
        Storage.prototype.setItem = function () {
            throw new DOMException("quota", "QuotaExceededError");
        };
        expect(setSession("a@b.c", "pw")).toBe(false);

        Storage.prototype.setItem = originalSetItem;
        expect(setSession("a@b.c", "pw")).toBe(true);
        expect(getSession()).toEqual({ email: "a@b.c", password: "pw" });
    });
});

describe("vi is not needed to mock the network here", () => {
    it("documents that these tests touch no fetch", () => {
        // Guard against a future refactor that makes setSession call the network.
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        setSession("a@b.c", "pw");
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
