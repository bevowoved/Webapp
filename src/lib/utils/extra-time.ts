import { Lesson } from "@/types/aurion";
import { parseFromTitle, toDate } from "./home";
import { createStorageState } from "./storage";
import { format, setHours } from "./date-time";

export const EXTRA_TIME_STORAGE_KEY = "mauria-extra-time";

const EXTRA_TIME_EVENT = "mauria-extra-time-change";

const state = createStorageState<boolean>(EXTRA_TIME_STORAGE_KEY, EXTRA_TIME_EVENT, (raw) => raw === "true", (v) => String(v));

export const readExtraTimeEnabled = state.read;

export const setExtraTimeEnabled = state.write;

export const useExtraTimeEnabled = (): boolean => state.useValue(false);

const isExam = (lesson: Lesson) => /^(DS|EXAM)/i.test(parseFromTitle(lesson).type) || /^(DS|EXAM)/i.test(lesson.className);

const TT = /(?:horaire\s+)?\btt\b\s*:\s*(\d{1,2})\s*h\s*(\d{2})?\s*-\s*(\d{1,2})\s*h\s*(\d{2})?/i;

const atTime = (day: Date, hours: string, minutes?: string) => setHours(day, Number(hours), minutes ? Number(minutes) : 0, 0);

export const EXTRA_TIME_LABEL_MIN_MINUTES = 30;

const FMT = "yyyy-MM-dd'T'HH:mm:ss";

export type ExtraTimeLesson = Lesson & { origStart?: string; origEnd?: string };

const on = new WeakMap<Lesson[], ExtraTimeLesson[]>();
const off = new WeakMap<Lesson[], ExtraTimeLesson[]>();

export function applyExtraTime(lessons: Lesson[], enabled: boolean): ExtraTimeLesson[] {
    const memo = enabled ? on : off;
    const hit = memo.get(lessons);
    if (hit !== undefined) return hit;
    if (!enabled) {
        const asIs = lessons as ExtraTimeLesson[];
        memo.set(lessons, asIs);
        return asIs;
    }
    const out = lessons.map((lesson) => {
        if (!isExam(lesson)) return lesson;
        const start = toDate(lesson.start);
        const end = toDate(lesson.end);
        const tt = TT.exec(lesson.title);
        let s = start;
        let e: Date;
        if (tt) {
            s = atTime(start, tt[1]!, tt[2]);
            e = atTime(start, tt[3]!, tt[4]);
            if (e <= s) { s = start; e = end; }
        } else {
            e = new Date(end.getTime() + (end.getTime() - start.getTime()) / 3);
        }
        return { ...lesson, start: format(s, FMT), end: format(e, FMT), origStart: format(start, FMT), origEnd: lesson.end };
    });
    memo.set(lessons, out);
    return out;
}

export const formatExtraTimeLabel = (addedMs: number): string | null => {
    const minutes = Math.round(addedMs / 60_000);
    if (minutes < EXTRA_TIME_LABEL_MIN_MINUTES) return null;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `+${rest}m`;
    return rest === 0 ? `+${hours}h` : `+${hours}h${rest}`;
};
