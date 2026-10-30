import { Lesson } from "@/types/aurion";
import { PalantirEntityKind, PalantirIndexStatus, PalantirPeopleResult, PalantirSearchResult } from "@/types/palantir";
import { APIResponse, aurionPost } from "./helper";

async function postPalantir<T>(path: string, extra?: Record<string, unknown>): Promise<T | null> {
    const res = await aurionPost<APIResponse<T>>(path, extra);
    return res?.success ? (res.data ?? null) : null;
}

export async function fetchPalantirStatus(): Promise<PalantirIndexStatus | null> {
    return postPalantir<PalantirIndexStatus>("/palantir/status");
}

export async function searchPalantir(q: string, kinds?: PalantirEntityKind[]): Promise<PalantirSearchResult | null> {
    if (!q.trim()) return null;
    return postPalantir<PalantirSearchResult>("/palantir/search", kinds?.length ? { q, kinds } : { q });
}

export async function fetchPalantirPlanning(kind: PalantirEntityKind, id: string): Promise<Lesson[] | null> {
    return postPalantir<Lesson[]>("/palantir/planning", { kind, id });
}

export async function searchPalantirPeople(q: string): Promise<PalantirPeopleResult | null> {
    if (!q.trim()) return null;
    return postPalantir<PalantirPeopleResult>("/palantir/people", { q });
}
