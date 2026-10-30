export type PalantirEntityKind = "room" | "group" | "teacher";

export interface PalantirEntity {
    kind: PalantirEntityKind;
    id: string;
    label: string;
    detail: string;
    type: string;
    count: number;
    collesGroup?: string | null;
}

export interface PalantirIndexStatus {
    state: "empty" | "building" | "ready";
    phase: "plannings" | "events" | null;
    done: number;
    total: number;
    elapsedMs: number;
    builtAt: number | null;
    expiresAt: number | null;
    windowStart: number | null;
    windowEnd: number | null;
    stale: boolean;
    error: string | null;
    failed: string[];
    counts: {
        lessons: number;
        rooms: number;
        groups: number;
    };
}

export interface PalantirSearchResult {
    results: PalantirEntity[];
    status: PalantirIndexStatus;
}

export interface PalantirTeacher {
    name: string;
    lessons: number;
}

export interface PalantirStudent {
    firstName: string;
    lastName: string;
    className: string;
    groupId: string;
    collesGroup: string | null;
}

export interface PalantirPeopleResult {
    teachers: PalantirTeacher[];
    students: PalantirStudent[];
}
