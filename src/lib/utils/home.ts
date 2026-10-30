import { Lesson } from "@/types/aurion";
import { PreparedLesson, HomeUpcoming } from "@/types/home";
import i18n from "@/i18n";
import { addDays, format, isAfter, isSameDay, isWithinInterval, startOfWeek, toDate } from "./date-time";

export { toDate };

const timeRange = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;

const scheduleNote = /(?:horaire\s+)?\btt\b\s*:/i;

const TYPE_CODE = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/;

export type ParsedTitle = {
    courseTitle: string;
    location: string;
    type: string;
    teacher: string;
};

export const parseFromTitle = (lesson: Lesson): ParsedTitle => {
    const all = lesson.title.split("\n").map((l) => l.trim());
    const lines = all.length > 1 && scheduleNote.test(all[all.length - 1]!) ? all.slice(0, -1) : all;
    const timeIndex = lines.findIndex((line) => timeRange.test(line));
    const typeIndex = timeIndex === -1 ? lines.length - 2 : timeIndex - 1;

    if (typeIndex < 2) {
        const filled = lines.filter(Boolean);
        return {
            courseTitle: filled[1] ?? filled[0] ?? lesson.title,
            location: filled[0] ?? "",
            type: filled[2] ?? lesson.className ?? "",
            teacher: filled[3] ?? "",
        };
    }

    const course = lines[typeIndex - 1] ?? "";
    const teacher = lines.slice(typeIndex + 1).find((line) => line && !timeRange.test(line));
    const leading = lines.slice(0, typeIndex - 1).filter(Boolean);
    const location = leading[0] ?? "";
    const note = leading.slice(1);

    return {
        courseTitle: course ? (TYPE_CODE.test(course) ? formatLessonType(course) : course) : note.join(" "),
        location,
        type: lines[typeIndex] || lesson.className || "",
        teacher: teacher ?? "",
    };
};

const lessonTypes = new Set([
    "COURS_TD",
    "CI",
    "CM",
    "TD",
    "TP",
    "PROJET",
    "PROJET_AUTO_GERE",
    "TD_AUTO_GERE_PLANIFIE",
    "TP_AUTO_GERE_PLANIFIE",
    "CM_AUTO_GERE_PLANIFIE",
    "AUTO_GERE",
    "AUTO_APPR",
    "COURS_TD_DIST",
    "CM_DIST",
    "TP_DIST",
    "E_LEARNING",
    "REUNION",
    "PROMO",
    "ATELIER",
    "DS_SURV",
    "EXAM",
    "EXAM_SURV",
    "SOUTENANCE",
    "VISITE",
    "CONF",
    "ASSOCIATIF",
    "ENTRETIEN",
    "SEMINAIRE",
    "DS",
]);

export const formatLessonType = (lessonType: string) => {
    const code = lessonType.toUpperCase();
    return lessonTypes.has(code) ? i18n.t(`homePage.lessonTypes.${code}`) : lessonType;
};

export const formatLessonTeacher = (teacher: string) =>
    teacher.replace(/\bMonsieur\b/gi, "M.").replace(/\bMadame\b/gi, "Mme");

export const formatLessonLocation = (location: string) => {
    const parts = location.split(",").map((part) => part.trim());
    let compact: string;
    if (parts.length >= 2 && /^salle\s+/i.test(parts[0]!)) {
        const room = parts[0]!.replace(/^salle\s+/i, "");
        const campus = parts[1];
        compact = campus && !room.toUpperCase().startsWith(campus.toUpperCase()) ? `${campus} ${room}` : room;
    } else {
        compact = location.split(" - ")[0]!.split(",")[0]!.trim();
    }
    compact = compact.replace(/_\d+[A-Za-z]+.*$/, "");
    return compact.replace(/_/g, " ");
};

const subjectAbbreviations: Array<{ match: RegExp; key: string }> = [
    { match: /sciences?\s+industrielles?(?:\s+(?:pour|de)\s+l['’]ing[ée]nieurs?)?/gi, key: "sii" },
    { match: /formations?\s+humaines?\s+(?:et|&)\s+sociales?/gi, key: "fhs" },
    { match: /projets?\s+professionnels?\s+(?:et|&)\s+personnels?/gi, key: "ppp" },
    { match: /communications?\s+(?:et|&)\s+cultures?\s+g[ée]n[ée]rales?/gi, key: "generalCulture" },
    { match: /g[ée]opolitique\s+du\s+monde\s+actuel/gi, key: "geopolitics" },
    { match: /business\s+intelligence/gi, key: "businessIntelligence" },
    { match: /intelligences?\s+artificielles?/gi, key: "ai" },
    { match: /bases?\s+de\s+donn[ée]es/gi, key: "database" },
    { match: /math[ée]matiques?/gi, key: "maths" },
    { match: /sciences?\s+physiques?/gi, key: "physics" },
    { match: /physiques?(?:[\s-]+chimies?)?/gi, key: "physics" },
    { match: /informatiques?/gi, key: "computerScience" },
    { match: /anglais/gi, key: "english" },
    { match: /espagnol/gi, key: "spanish" },
    { match: /allemand/gi, key: "german" },
    { match: /statistiques?/gi, key: "stats" },
    { match: /[ée]lectroniques?/gi, key: "electronics" },
    { match: /d[ée]veloppement/gi, key: "development" },
    { match: /programmation/gi, key: "programming" },
    { match: /technologies?/gi, key: "technologies" },
    { match: /introductions?/gi, key: "intro" },
];

const anchoredAbbreviations = subjectAbbreviations.map(({ match, key }) => ({
    match: new RegExp(`(^|[^\\p{L}])(?:${match.source})`, "giu"),
    key,
}));

export const abbreviateSubjects = (title: string) =>
    anchoredAbbreviations.reduce(
        (text, { match, key }) => text.replace(match, (_full, before: string) => `${before}${i18n.t(`schedulePage.subjectsShort.${key}`)}`),
        title
    );

const termSuffix = /\s+-\s+\d*\s*(?:er|ère|e|ème|nd|nde)?\s*semestre\s*\d*$/i;

export const formatLessonCourse = (courseTitle: string) => courseTitle.replace(termSuffix, "").trim();

export function formatElapsed(since: string, now = Date.now()): string {
    const minutes = Math.max(0, Math.floor((now - toDate(since).getTime()) / 60_000));
    if (minutes < 1) return "<1 min";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) return `${hours} h`;
    return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

type TimedLesson = { lesson: Lesson; start: Date; end: Date };

const timedLesson = (lesson: Lesson): TimedLesson => ({ lesson, start: toDate(lesson.start), end: toDate(lesson.end) });

const lessonTime = (start: Date, end: Date): string => `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;

const courseOf = (lesson: Lesson): string => formatLessonCourse(parseFromTitle(lesson).courseTitle);

const toCourse = ({ lesson, start, end }: TimedLesson): PreparedLesson => {
    const { courseTitle, location, type, teacher } = parseFromTitle(lesson);
    return { courseTitle, time: lessonTime(start, end), location, type, details: lesson, teacher };
};

const upcomingCache = new WeakMap<Lesson[], HomeUpcoming>();

export const getHomeUpcoming = ({ lessons }: { lessons: Lesson[] }): HomeUpcoming => {
    const hit = upcomingCache.get(lessons);
    if (hit !== undefined) return hit;

    const now = new Date();
    const tomorrow = addDays(now, 1);
    const timed = lessons.map(timedLesson);
    const enriched = timed.filter(({ start }) => isSameDay(start, now) || isSameDay(start, tomorrow));
    const current = enriched.find(({ start, end }) => isWithinInterval(now, { start, end }));
    const byStart = (a: TimedLesson, b: TimedLesson) => a.start.getTime() - b.start.getTime();

    const result: HomeUpcoming = {
        current: current ? toCourse(current) : null,
        today: enriched.filter(({ start }) => isSameDay(start, now) && isAfter(start, now)).sort(byStart).map(toCourse),
        tomorrow: enriched.filter(({ start }) => isSameDay(start, tomorrow)).sort(byStart).map(toCourse),
    };
    upcomingCache.set(lessons, result);
    return result;
};

export const findNextLessonOfCurrentCourse = (
    lessons: Lesson[],
    now = new Date(),
    graceMinutes = 10
): { course: string; start: Date } | null => {
    const timed = lessons.map(timedLesson);
    const graceStart = new Date(now.getTime() - graceMinutes * 60 * 1000);

    const reference =
        timed.find(({ start, end }) => start <= now && now < end) ??
        timed.filter(({ end }) => graceStart <= end && end <= now).sort((a, b) => b.end.getTime() - a.end.getTime())[0];
    if (!reference) return null;

    const course = courseOf(reference.lesson);
    if (!course) return null;
    const key = course.toLowerCase();

    const next = timed
        .filter(({ lesson, start }) => start >= reference.end && courseOf(lesson).toLowerCase() === key)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    return next ? { course, start: next.start } : null;
};

export type WidgetLesson = {
    title: string;
    type: string;
    location: string;
    time: string;
    startMs: number;
    endMs: number;
};

const widgetCache = new WeakMap<Lesson[], WidgetLesson[]>();

export const buildWidgetLessons = (lessons: Lesson[]): WidgetLesson[] => {
    const hit = widgetCache.get(lessons);
    if (hit !== undefined) return hit;
    const from = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
    const out = lessons
        .map(timedLesson)
        .filter(({ end }) => end.getTime() >= from)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map(({ lesson, start, end }) => {
            const { courseTitle, location, type } = parseFromTitle(lesson);
            return {
                title: abbreviateSubjects(formatLessonCourse(courseTitle)),
                type,
                location: formatLessonLocation(location),
                time: lessonTime(start, end),
                startMs: start.getTime(),
                endMs: end.getTime(),
            };
        });
    widgetCache.set(lessons, out);
    return out;
};
