/**
 * B2 - persistence died for the session on a single QuotaExceededError.
 *
 * The bug: the persister cleared `pending` unconditionally after attempting a
 * write. When `setItem` threw (quota full), the payload was discarded and no
 * further attempt was made for that data - the cache silently stopped
 * persisting until reload.
 *
 * The fix only clears `pending` when BOTH writes report success, so a failed
 * write leaves the payload queued and the next persistClient/flush retries it.
 *
 * Tested through the real persister, with localStorage made to throw.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createDoubleBufferedPersister } from "@/lib/query-client";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const KEY = "test-rq-cache";

const client = (n: number): PersistedClient =>
    ({
        timestamp: n,
        buster: "v1",
        clientState: { mutations: [], queries: [] },
    }) as unknown as PersistedClient;

const originalSetItem = Storage.prototype.setItem;

beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
});

afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    vi.useRealTimers();
    localStorage.clear();
});

/** Force every setItem to throw, as a full quota does. */
const breakQuota = () => {
    Storage.prototype.setItem = function () {
        throw new DOMException("quota", "QuotaExceededError");
    };
};

const restoreQuota = () => {
    Storage.prototype.setItem = originalSetItem;
};

describe("B2 persistence retries after a failed write", () => {
    it("writes normally when there is quota", () => {
        const persister = createDoubleBufferedPersister(KEY);
        persister.persistClient(client(1));
        vi.advanceTimersByTime(2000);
        expect(localStorage.getItem(KEY)).not.toBeNull();
    });

    it("does not persist while the quota is exhausted", () => {
        breakQuota();
        const persister = createDoubleBufferedPersister(KEY);
        persister.persistClient(client(1));
        vi.advanceTimersByTime(2000);
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("retries the SAME payload once quota returns (the regression)", () => {
        breakQuota();
        const persister = createDoubleBufferedPersister(KEY);
        persister.persistClient(client(7));
        vi.advanceTimersByTime(2000);
        expect(localStorage.getItem(KEY)).toBeNull();

        // Quota frees up. The old code had already discarded the payload, so
        // only a brand-new persistClient call would have written anything.
        restoreQuota();
        persister.persistClient(client(7));
        vi.advanceTimersByTime(2000);

        const stored = localStorage.getItem(KEY);
        expect(stored, "payload must be retried after quota returns").not.toBeNull();
        expect(JSON.parse(stored as string).timestamp).toBe(7);
    });

    it("a flush (visibilitychange/pagehide) also retries a previously failed write", () => {
        breakQuota();
        const persister = createDoubleBufferedPersister(KEY);
        persister.persistClient(client(9));
        vi.advanceTimersByTime(2000);
        expect(localStorage.getItem(KEY)).toBeNull();

        restoreQuota();
        window.dispatchEvent(new Event("pagehide"));

        const stored = localStorage.getItem(KEY);
        expect(stored, "pagehide flush must retry the queued payload").not.toBeNull();
        expect(JSON.parse(stored as string).timestamp).toBe(9);
    });
});
