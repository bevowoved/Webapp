import { format, parseISO, toISODate } from "./date-time";
import { DS_BY_CLASS } from "@/lib/data/ds";
import { toDate } from "@/lib/utils/home";
import { Lesson } from "@/types/aurion";

const PLACEHOLDER = /DS selon planning/i;

const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

const dsCache = new WeakMap<Lesson[], Map<string, Lesson[]>>();

const parseLocal = (date: string, time: string): Date => {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return new Date(y!, m! - 1, d!, hh ?? 0, mm ?? 0, 0, 0);
};

export function resolveDsLessons(lessons: Lesson[], className: string | null | undefined): Lesson[] {
    if (!className) return lessons;
    const schedule = DS_BY_CLASS[className];
    if (!schedule) return lessons;

    let byClass = dsCache.get(lessons);
    if (byClass === undefined) {
        byClass = new Map();
        dsCache.set(lessons, byClass);
    }
    const hit = byClass.get(className);
    if (hit !== undefined) return hit;

    const replaced = new Set<string>();
    const kept = lessons.filter((lesson) => {
        if (!PLACEHOLDER.test(lesson.title)) return true;
        const day = toISODate(toDate(lesson.start));
        if (!schedule.exams.some((exam) => exam.date === day)) return true;
        replaced.add(day);
        return false;
    });

    if (replaced.size === 0) {
        byClass.set(className, lessons);
        return lessons;
    }

    const type = "DS_SURV";
    const exams = schedule.exams
        .filter((exam) => replaced.has(exam.date))
        .map<Lesson>((exam) => {
            const start = parseLocal(exam.date, exam.start);
            const end = parseLocal(exam.date, exam.end);
            return {
                id: `ds-${className}-${exam.date}-${exam.start}`,
                title: [schedule.room, exam.subject, type, ""].join("\n"),
                start: format(start, DATETIME_FORMAT),
                end: format(end, DATETIME_FORMAT),
                allDay: false,
                editable: false,
                className: type,
            };
        });

    const out = [...kept, ...exams];
    byClass.set(className, out);
    return out;
}

export { parseISO };
