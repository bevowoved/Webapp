import { Lesson, Grade, Absence, AurionDocument, DocumentsResult } from "@/types/aurion";
import { APIResponse, API_URL, apiRequest, aurionPost, dedupe, getSession, getSessionSignal } from "./helper";
import { queryClient } from "@/lib/query-client";
import { expectedFetchDuration, fetchJuniaStatus, markAurionSession, type JuniaStatus, type SlowQueryKey } from "./junia-status";

export { fetchAssos, fetchBuildings, fetchCastelRuMenu, fetchColleGroup, fetchDailyMenu, fetchImportantMessage, fetchRoomsForBuilding, fetchUpdates, getSession, setSession } from "./helper";
export { clearAurionSession, isAurionSessionWarm, isAurionWarmExpired, WARM_TTL_MS } from "./junia-status";

export const AURION_WARM_QUERY_KEY = ["aurionWarm"] as const;

const DOCUMENT_TIMEOUT_MS = 45_000;
const DOCUMENT_FIELDS = ["category", "docIndex", "downloadType", "submitParam", "selectName", "optionValue", "downloadButtonParam", "consulterParam"] as const;

export async function ensureJuniaStatus(): Promise<JuniaStatus | null> {
    try {
        return (await queryClient.query({ queryKey: ["juniaStatus"], queryFn: fetchJuniaStatus, staleTime: "static" })) ?? null;
    } catch {
        return null;
    }
}

async function timedAurionFetch<T>(key: SlowQueryKey, fn: () => Promise<T>, status?: JuniaStatus | null): Promise<T> {
    const signal = getSessionSignal();
    expectedFetchDuration(status === undefined ? await ensureJuniaStatus() : status, key);
    const result = await fn();
    if (!signal.aborted) markAurionSession();
    return result;
}

export async function fetchUser({ email, password }: { email: string; password: string }) {
    return dedupe(`login:${email}`, async () => {
        const data = await apiRequest<{ success: boolean; error?: string }>("/aurion/login", "POST", { email, password });
        if (data?.success) { markAurionSession(4500, email); void ensureJuniaStatus().then((s) => { if (s?.aurionTimes?.home != null) markAurionSession(s.aurionTimes.home, email); }); }
        return data;
    });
}

export async function warmAurionSession(): Promise<boolean> {
    if (!getSession()) return false;
    if ((await ensureJuniaStatus())?.aurionDown) return false;
    return dedupe("aurionWarm", async () => {
        const data = await aurionPost<{ success: boolean; error?: string }>("/aurion/warm");
        if (data?.success) markAurionSession(0);
        return !!data?.success;
    });
}

const fetchEndpoint =
    <T>(key: SlowQueryKey, path: string) =>
    async (body?: Record<string, unknown>): Promise<APIResponse<T> | null> => {
        if (!getSession()) return null;
        const status = await ensureJuniaStatus();
        if (status?.aurionDown) return null;
        const dedupeKey = `POST:${path}:${body ? JSON.stringify(body) : ""}`;
        return dedupe(dedupeKey, () => timedAurionFetch(key, () => aurionPost<APIResponse<T>>(path, body), status));
    };

export const fetchGrades = fetchEndpoint<Grade[]>("grades", "/aurion/grades");
export const fetchAbsences = fetchEndpoint<Absence[]>("absences", "/aurion/absences");
export const fetchDocuments = fetchEndpoint<DocumentsResult>("documents", "/aurion/documents");

const fetchPlanningEndpoint = fetchEndpoint<Lesson[]>("planning", "/aurion/planning");

export async function fetchPlanning(params?: { start?: string; end?: string }): Promise<APIResponse<Lesson[]> | null> {
    const { start, end } = params ?? {};
    return fetchPlanningEndpoint(start && end ? { start, end } : undefined);
}

export type DownloadOutcome =
    | { status: "saved"; filename: string }
    | { status: "handedOff" }
    | { status: "error" };

function prefersBrowserDownload(): boolean {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function saveDocumentBlob(body: Record<string, unknown>): Promise<DownloadOutcome> {
    try {
        const response = await fetch(`${API_URL}/aurion/documents/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.any([getSessionSignal(), AbortSignal.timeout(DOCUMENT_TIMEOUT_MS)]),
        });
        if (!response.ok) return { status: "error" };
        const blob = await response.blob();
        const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "document.pdf";
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        Object.assign(anchor, { href: url, download: filename });
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return { status: "saved", filename };
    } catch {
        return { status: "error" };
    }
}

async function openDocumentInBrowser(body: Record<string, unknown>): Promise<DownloadOutcome> {
    const data = await apiRequest<APIResponse<{ token: string }>>("/aurion/documents/download-link", "POST", body);
    const token = data?.data?.token;
    if (!token) return { status: "error" };
    window.location.assign(`${API_URL}/aurion/documents/file?token=${encodeURIComponent(token)}`);
    return { status: "handedOff" };
}

export async function downloadDocument(doc: AurionDocument): Promise<DownloadOutcome> {
    const session = getSession();
    if (!session) return { status: "error" };
    const body: Record<string, unknown> = { ...session };
    for (const field of DOCUMENT_FIELDS) body[field] = doc[field];
    return prefersBrowserDownload() ? openDocumentInBrowser(body) : saveDocumentBlob(body);
}
