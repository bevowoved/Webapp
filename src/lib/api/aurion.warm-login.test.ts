/**
 * B3 - the warm marker was dropped on first login.
 *
 * The bug was at the CALL SITE, not in the marker itself:
 *
 *   markAurionSession(4500);            // pre-fix: email defaults to storage
 *
 * `markAurionSession` defaults its email to `getFromStorage("email")`. On a
 * first login that key is still empty (or holds a previous account), because
 * `setSession` has not run yet. The marker is therefore stamped with the wrong
 * identity, and the next `warm()` check - which compares the marker's email to
 * the stored one - nulls it. The user paid a cold start again on first login.
 *
 * The fix passes the email through explicitly:
 *
 *   markAurionSession(4500, email);
 *
 * This test drives the real `fetchUser` with the network call mocked, then
 * asserts the marker that ends up in storage belongs to the account that just
 * logged in.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

const apiRequest = vi.fn();

vi.mock("@/lib/api/helper", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/helper")>();
    return {
        ...actual,
        apiRequest: (...args: unknown[]) => apiRequest(...args),
        // fetchJuniaStatus is called right after a successful login; keep it
        // inert so the assertion is about the marker, not the status probe.
        getSessionSignal: () => new AbortController().signal,
    };
});

vi.mock("@/lib/api/junia-status", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/api/junia-status")>();
    return { ...actual, fetchJuniaStatus: async () => null };
});

const { fetchUser } = await import("@/lib/api/aurion");
const { getFromStorage } = await import("@/lib/utils/storage");
const { clearAurionSession, isAurionSessionWarm } = await import("@/lib/api/junia-status");

const WARM_KEY = "aurionWarmSession";

beforeEach(() => {
    localStorage.clear();
    clearAurionSession();
    apiRequest.mockReset();
    vi.useRealTimers();
});

describe("B3 warm marker survives a first login", () => {
    it("stamps the marker with the email being logged in, not the stored one", async () => {
        // First login: nothing stored yet.
        expect(getFromStorage("email")).toBeNull();

        apiRequest.mockResolvedValue({ success: true });
        await fetchUser({ email: "student@example.com", password: "pw" });

        const raw = localStorage.getItem(WARM_KEY);
        expect(raw, "a warm marker must be written on successful login").not.toBeNull();
        expect(JSON.parse(raw as string).email).toBe("student@example.com");
    });

    it("the marker stays warm once setSession writes the email", async () => {
        apiRequest.mockResolvedValue({ success: true });
        await fetchUser({ email: "student@example.com", password: "pw" });

        // The login flow writes the session after the marker.
        const { saveToStorage } = await import("@/lib/utils/storage");
        saveToStorage("email", "student@example.com");

        // fetchUser stamps a 4500ms home-ready delay, so the marker is not warm
        // at t=0 by design. Advance past it.
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 5000);
        expect(isAurionSessionWarm()).toBe(true);
        vi.useRealTimers();
    });

    it("does not stamp a marker on a failed login", async () => {
        apiRequest.mockResolvedValue({ success: false, error: "bad credentials" });
        await fetchUser({ email: "student@example.com", password: "wrong" });
        expect(localStorage.getItem(WARM_KEY)).toBeNull();
    });

    it("a marker from a previous account does not make the new account warm", async () => {
        const { saveToStorage } = await import("@/lib/utils/storage");
        saveToStorage("email", "alice@example.com");

        apiRequest.mockResolvedValue({ success: true });
        await fetchUser({ email: "bob@example.com", password: "pw" });

        // Marker belongs to bob; storage still says alice.
        const raw = localStorage.getItem(WARM_KEY);
        expect(JSON.parse(raw as string).email).toBe("bob@example.com");
        expect(isAurionSessionWarm()).toBe(false);
    });
});
