import { useEffect, useMemo } from "react";

import type { Grade } from "@/types/aurion";
import { readGradeRevealMode } from "./experimental";
import { getFromStorage, notifyStorage, onStorageChange, removeFromStorage, saveToStorage, useStorageSync } from "./storage";

export const KNOWN_GRADES_STORAGE_KEY = "mauria-known-grades";
export const UNOPENED_GRADES_STORAGE_KEY = "mauria-unopened-grades";
const EVENT = "mauria-unopened-grades-change";

export const getGradeKey = (grade: Grade): string => [grade.date, grade.code, grade.name].join("|");

const parseKeys = (raw: string | null): Set<string> => {
    if (!raw) return new Set();
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
    } catch {
        return new Set();
    }
};

const memo = new Map<string, { raw: string | null; keys: Set<string> }>();

const readKeys = (key: string): Set<string> => {
    const raw = getFromStorage(key);
    const hit = memo.get(key);
    if (hit && hit.raw === raw) return new Set(hit.keys);
    const keys = parseKeys(raw);
    memo.set(key, { raw, keys });
    return new Set(keys);
};

let snapshot: readonly string[] = Object.freeze([]);

const refresh = () => {
    const next = [...readKeys(UNOPENED_GRADES_STORAGE_KEY)];
    if (next.length !== snapshot.length || next.some((v, i) => v !== snapshot[i])) snapshot = Object.freeze(next);
    return snapshot;
};

const commit = (unopened: Set<string>) => {
    if (typeof window === "undefined") return;
    saveToStorage(UNOPENED_GRADES_STORAGE_KEY, JSON.stringify([...unopened]));
    refresh();
    notifyStorage(EVENT);
};

if (typeof window !== "undefined") {
    onStorageChange((key) => {
        if (key !== null && key !== KNOWN_GRADES_STORAGE_KEY && key !== UNOPENED_GRADES_STORAGE_KEY) return;
        memo.clear();
        snapshot = Object.freeze([]);
        refresh();
        notifyStorage(EVENT);
    });
}

export const readUnopenedGrades = (): readonly string[] => refresh();

export const trackNewGrades = (grades: Grade[]) => {
    if (typeof window === "undefined" || readGradeRevealMode() === "off" || !Array.isArray(grades)) return;
    const known = readKeys(KNOWN_GRADES_STORAGE_KEY);
    const unopened = readKeys(UNOPENED_GRADES_STORAGE_KEY);
    const firstRun = getFromStorage(KNOWN_GRADES_STORAGE_KEY) === null;
    const fresh: string[] = [];
    for (const grade of grades) {
        if (!grade.grade?.trim()) continue;
        const key = getGradeKey(grade);
        if (known.has(key)) continue;
        known.add(key);
        fresh.push(key);
    }
    if (fresh.length === 0) return;
    if (!firstRun) for (const key of fresh) unopened.add(key);
    saveToStorage(KNOWN_GRADES_STORAGE_KEY, JSON.stringify([...known]));
    commit(unopened);
};

export const clearUnopenedGrades = () => {
    memo.clear();
    snapshot = Object.freeze([]);
    removeFromStorage(KNOWN_GRADES_STORAGE_KEY);
    removeFromStorage(UNOPENED_GRADES_STORAGE_KEY);
    notifyStorage(EVENT);
};

export const resetGradeTracking = () => {
    if (typeof window === "undefined") return;
    clearUnopenedGrades();
};

export const openGrade = (grade: Grade) => openGrades([grade]);

export const openGrades = (grades: Grade[]) => {
    if (typeof window === "undefined" || grades.length === 0) return;
    const unopened = readKeys(UNOPENED_GRADES_STORAGE_KEY);
    let changed = false;
    for (const grade of grades) if (unopened.delete(getGradeKey(grade))) changed = true;
    if (!changed) return;
    commit(unopened);
};

export const repackGrade = (grade: Grade) => {
    if (typeof window === "undefined") return;
    const unopened = readKeys(UNOPENED_GRADES_STORAGE_KEY);
    const key = getGradeKey(grade);
    if (unopened.has(key)) return;
    unopened.add(key);
    commit(unopened);
};

export const useUnopenedGrades = (): Set<string> => {
    const unopened = useStorageSync(EVENT, readUnopenedGrades, snapshot);
    useEffect(() => {
        window.addEventListener("pagehide", refresh);
        return () => window.removeEventListener("pagehide", refresh);
    }, []);
    return useMemo(() => new Set(unopened), [unopened]);
};
