/**
 * B3 - the warm marker was dropped on first login.
 *
 * The bug: `markAurionSession(4500)` was called with no email, so it defaulted
 * to `getFromStorage("email")` - which was still the PREVIOUS session's value,
 * because `setSession` had not written the new one yet. The stored warm state
 * therefore carried a stale email, and the very next `warm()` call saw a
 * mismatch against the freshly-written email and nulled the marker. The user
 * paid the cold-start cost again on their first login.
 *
 * The fix passes the email explicitly, so the marker is stamped with the
 * identity it belongs to.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { markAurionSession, isAurionSessionWarm, clearAurionSession, WARM_TTL_MS } from "@/lib/api/junia-status";
import { saveToStorage } from "@/lib/utils/storage";

beforeEach(() => {
    localStorage.clear();
    clearAurionSession();
    vi.useRealTimers();
});

describe("B3 warm marker survives a first login", () => {
    it("a marker stamped with the new email stays warm after the email is written", () => {
        // First login: no email in storage yet.
        expect(localStorage.getItem("email")).toBeNull();

        // The fix: pass the email explicitly.
        markAurionSession(0, "student@example.com");

        // setSession now writes the email.
        saveToStorage("email", "student@example.com");

        expect(isAurionSessionWarm()).toBe(true);
    });

    it("documents the bug: defaulting to the stored email drops the marker", () => {
        // Simulate the pre-fix call shape by stamping with whatever is stored
        // (nothing) and then writing a different email.
        markAurionSession(0, null);
        saveToStorage("email", "student@example.com");
        expect(isAurionSessionWarm()).toBe(false);
    });

    it("a marker belonging to a different account is not warm", () => {
        markAurionSession(0, "alice@example.com");
        saveToStorage("email", "bob@example.com");
        expect(isAurionSessionWarm()).toBe(false);
    });

    it("respects the homeReadyInMs delay", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
        markAurionSession(4500, "student@example.com");
        saveToStorage("email", "student@example.com");

        expect(isAurionSessionWarm()).toBe(false);
        vi.advanceTimersByTime(4500);
        expect(isAurionSessionWarm()).toBe(true);
    });

    it("expires after WARM_TTL_MS", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
        markAurionSession(0, "student@example.com");
        saveToStorage("email", "student@example.com");
        expect(isAurionSessionWarm()).toBe(true);

        vi.advanceTimersByTime(WARM_TTL_MS + 1);
        expect(isAurionSessionWarm()).toBe(false);
    });
});
