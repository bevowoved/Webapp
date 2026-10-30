/**
 * junia-status.ts - how long a fetch is expected to take.
 *
 * The progress drawer animates a ring against an expected duration. If that
 * estimate is wrong the ring either finishes early and sits at 97% or jumps to
 * 100% while the request is still running. The rules:
 *
 *   warm session   -> the measured step, or 300ms as a floor
 *   cold session   -> login + home + the measured step
 *   no status yet  -> a hard-coded fallback per key
 *
 * `documents` is deliberately exempt from the warm shortcut: the documents
 * endpoint is slow even on a warm session.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
    clearAurionSession,
    expectedFetchDuration,
    expectedWarmDuration,
    isAurionSessionWarm,
    isAurionWarmExpired,
    markAurionSession,
    WARM_TTL_MS,
} from "@/lib/api/junia-status";
import { clearStorage, saveToStorage } from "@/lib/utils/storage";

const status = {
    aurionDown: false,
    aurionSince: null,
    wifiDown: false,
    wifiSince: null,
    aurionTimes: { login: 1000, home: 2000, grades: 3000, planning: 4000, absences: 5000, documents: 6000 },
};

beforeEach(() => {
    clearStorage();
    clearAurionSession();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
});

afterEach(() => {
    vi.useRealTimers();
    clearAurionSession();
    clearStorage();
});

describe("cold session estimates", () => {
    it("adds login, home and the measured step", () => {
        // 1000 + 2000 + 3000
        expect(expectedFetchDuration(status, "grades")).toBe(6000);
    });

    it("uses the fallback when the status has no times yet", () => {
        expect(expectedFetchDuration(null, "grades")).toBe(17000);
        expect(expectedFetchDuration(null, "planning")).toBe(10000);
        expect(expectedFetchDuration(null, "absences")).toBe(8000);
    });

    it("uses the fallback when login or home is unknown", () => {
        const partial = { ...status, aurionTimes: { ...status.aurionTimes, login: null } };
        expect(expectedFetchDuration(partial, "grades")).toBe(17000);
    });

    it("always returns the documents fallback, cold or warm", () => {
        expect(expectedFetchDuration(status, "documents")).toBe(15000);
        markAurionSession(0);
        expect(expectedFetchDuration(status, "documents")).toBe(15000);
    });

    it("estimates the warm-up itself from login plus home", () => {
        expect(expectedWarmDuration(status)).toBe(3000);
    });

    it("falls back to 6s for the warm-up with no status", () => {
        expect(expectedWarmDuration(null)).toBe(6000);
    });
});

describe("warm session estimates", () => {
    it("uses the measured step once the session is warm", () => {
        markAurionSession(0);
        expect(expectedFetchDuration(status, "grades")).toBe(3000);
    });

    it("uses a 300ms floor for the warm-up once warm", () => {
        markAurionSession(0);
        expect(expectedWarmDuration(status)).toBe(300);
    });

    it("falls back to the per-key step when the status has no times", () => {
        markAurionSession(0);
        expect(expectedFetchDuration(null, "grades")).toBe(1700);
        expect(expectedFetchDuration(null, "planning")).toBe(3600);
        expect(expectedFetchDuration(null, "absences")).toBe(1200);
    });
});

describe("warm marker lifecycle", () => {
    it("is warm immediately when no home delay is requested", () => {
        markAurionSession(0);
        expect(isAurionSessionWarm()).toBe(true);
    });

    it("is not warm until the home-ready delay elapses", () => {
        markAurionSession(4500);
        expect(isAurionSessionWarm()).toBe(false);

        vi.advanceTimersByTime(4500);
        expect(isAurionSessionWarm()).toBe(true);
    });

    it("expires after the TTL", () => {
        markAurionSession(0);
        vi.advanceTimersByTime(WARM_TTL_MS - 1);
        expect(isAurionSessionWarm()).toBe(true);

        vi.advanceTimersByTime(2);
        expect(isAurionSessionWarm()).toBe(false);
    });

    it("reports expired when there is no marker at all", () => {
        expect(isAurionWarmExpired()).toBe(true);
    });

    it("reports not-expired for a fresh marker", () => {
        markAurionSession(0);
        expect(isAurionWarmExpired()).toBe(false);
    });

    it("is not warm when the stored email no longer matches", () => {
        markAurionSession(0, "alice@example.com");
        saveToStorage("email", "bob@example.com");
        expect(isAurionSessionWarm()).toBe(false);
    });

    it("is warm when the stored email matches", () => {
        saveToStorage("email", "alice@example.com");
        markAurionSession(0, "alice@example.com");
        expect(isAurionSessionWarm()).toBe(true);
    });

    it("clearAurionSession removes the marker", () => {
        markAurionSession(0);
        clearAurionSession();
        expect(isAurionSessionWarm()).toBe(false);
        expect(isAurionWarmExpired()).toBe(true);
    });
});
