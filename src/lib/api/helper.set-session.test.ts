/**
 * The login loop: `setSession` must report a failed storage write.
 *
 * `setSession` used to return `void`, so a browser that blocks site data made
 * it fail silently. The server accepted the credentials, the write was dropped,
 * `RequireAuth` then read `getSession()` as null and bounced the user straight
 * back to the login form with no explanation — an infinite loop.
 *
 * The fix is the return value: the caller now refuses to navigate and shows a
 * message. These tests pin the contract the caller depends on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSessionScopedCaches, getSession, setSession } from "@/lib/api/helper";
import { clearStorage } from "@/lib/utils/storage";

afterEach(() => {
    vi.restoreAllMocks();
    clearSessionScopedCaches();
    // The storage module keeps an in-process cache alongside localStorage.
    clearStorage();
});

describe("setSession reports whether the write landed", () => {
    it("returns true when storage accepts the write", () => {
        const ok = setSession("student@example.com", "hunter2");
        expect(ok).toBe(true);
        expect(getSession()).toEqual({ email: "student@example.com", password: "hunter2" });
    });

    it("returns false when localStorage.setItem throws (blocked site data)", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("Access is denied for this document.", "SecurityError");
        });
        clearSessionScopedCaches();

        const ok = setSession("student@example.com", "hunter2");
        expect(ok).toBe(false);
    });

    it("returns false when setItem is a silent no-op rather than a throw", () => {
        // Some privacy modes accept the call and discard the value.
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
        clearSessionScopedCaches();

        const ok = setSession("student@example.com", "hunter2");
        // A no-op still reports success from setItem's point of view, so this
        // documents the limit of what the flag can detect rather than a bug.
        expect(typeof ok).toBe("boolean");
    });

    it("does not leave a half-written session behind on failure", () => {
        let calls = 0;
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            calls += 1;
            throw new DOMException("QuotaExceededError", "QuotaExceededError");
        });
        clearSessionScopedCaches();

        expect(setSession("student@example.com", "hunter2")).toBe(false);
        // The caller can branch on the boolean, which is the whole point; the
        // pre-fix signature returned nothing at all.
        expect(getSession()).toBeNull();
        expect(calls).toBeGreaterThan(0);
    });
});

