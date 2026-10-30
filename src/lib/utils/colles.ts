import { addDays, addMinutes, format, parseISO, startOfDay } from "./date-time";
import i18n from "@/i18n";
import { COLLES_CLASSES } from "@/lib/data/colles";
import { Lesson } from "@/types/aurion";
import { CollesClass } from "@/types/colles";

const COLLE_DURATION_MINUTES = 60;

const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

function buildColleLessons(collesClass: CollesClass, group: string): Lesson[] {
    const weeks = collesClass.groups[group] ?? [];
    const type = i18n.t("schedulePage.colles.type");

    const lessons: Lesson[] = [];
    weeks.forEach((codes, weekIndex) => {
        const weekStart = collesClass.weekStarts[weekIndex];
        if (!weekStart) return;

        codes.forEach((code) => {
            const slot = collesClass.slots[code];
            if (!slot) return;

            const [hours = 0, minutes = 0] = slot.start.split(":").map(Number);
            const day = addDays(startOfDay(parseISO(weekStart)), slot.weekday - 1);
            const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
            const end = addMinutes(start, COLLE_DURATION_MINUTES);
            const subject = i18n.t(`schedulePage.colles.subjects.${slot.subject}`);

            lessons.push({
                id: `colle-${collesClass.id}-${group}-${weekIndex + 1}-${code}`,
                title: [slot.room, i18n.t("schedulePage.colles.event", { subject }), type, slot.teacher].join("\n"),
                start: format(start, DATETIME_FORMAT),
                end: format(end, DATETIME_FORMAT),
                allDay: false,
                editable: false,
                className: "est-colle",
            });
        });
    });

    return lessons;
}

export function buildCollesLessons(className: string | null | undefined, group: string | null | undefined): Lesson[] {
    if (!className || !group) return [];
    const collesClass = COLLES_CLASSES.find((c) => c.label === className);
    if (!collesClass) return [];
    return buildColleLessons(collesClass, group);
}

const normalizeRoom = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

let cachedRoomColles: { language: string; byRoom: Map<string, Lesson[]> } | null = null;

function allRoomColles(): Map<string, Lesson[]> {
    if (cachedRoomColles?.language === i18n.language) return cachedRoomColles.byRoom;

    const byRoom = new Map<string, Lesson[]>();
    for (const collesClass of COLLES_CLASSES) {
        for (const group of Object.keys(collesClass.groups)) {
            for (const lesson of buildColleLessons(collesClass, group)) {
                const room = normalizeRoom(lesson.title.split("\n")[0] ?? "");
                const bucket = byRoom.get(room);
                if (bucket) bucket.push(lesson);
                else byRoom.set(room, [lesson]);
            }
        }
    }

    cachedRoomColles = { language: i18n.language, byRoom };
    return byRoom;
}

export function getRoomCollesLessons(room: string): Lesson[] {
    const byRoom = allRoomColles();
    const needle = normalizeRoom(room);
    if (!needle) return [];
    const direct = byRoom.get(needle);
    if (direct) return direct;

    const lessons: Lesson[] = [];
    for (const [key, bucket] of byRoom) {
        if (key.startsWith(`${needle} -`) || key.startsWith(`${needle} `)) lessons.push(...bucket);
    }
    return lessons;
}

const labelTokens = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

function matchCollesClass(classLabel: string): CollesClass | undefined {
    const tokens = new Set(labelTokens(classLabel));
    return COLLES_CLASSES.find((c) => tokens.has(c.label.toLowerCase()));
}

export function getClassCollesLessons(classLabel: string): Lesson[] {
    const collesClass = matchCollesClass(classLabel);
    if (!collesClass) return [];
    return Object.keys(collesClass.groups).flatMap((group) => buildColleLessons(collesClass, group));
}

export function getStudentCollesLessons(classLabel: string, group: string): Lesson[] {
    const collesClass = matchCollesClass(classLabel);
    return collesClass ? buildColleLessons(collesClass, group) : [];
}

const TEACHER_TITLE_WORDS = new Set(["m", "mm", "mme", "mr", "monsieur", "madame", "dr", "pr"]);

const surnameTokens = (value: string) => labelTokens(value).filter((token) => !TEACHER_TITLE_WORDS.has(token));

let cachedTeacherColles: { language: string; bySurname: Map<string, Lesson[]> } | null = null;

function allTeacherColles(): Map<string, Lesson[]> {
    if (cachedTeacherColles?.language === i18n.language) return cachedTeacherColles.bySurname;

    const bySurname = new Map<string, Lesson[]>();
    for (const collesClass of COLLES_CLASSES) {
        const seen = new Set<string>();
        for (const group of Object.keys(collesClass.groups)) {
            for (const lesson of buildColleLessons(collesClass, group)) {
                const dedup = `${lesson.start}|${lesson.title}`;
                if (seen.has(dedup)) continue;
                seen.add(dedup);

                const teacher = lesson.title.split("\n")[3] ?? "";
                for (const token of surnameTokens(teacher)) {
                    const bucket = bySurname.get(token);
                    if (bucket) bucket.push(lesson);
                    else bySurname.set(token, [lesson]);
                }
            }
        }
    }

    cachedTeacherColles = { language: i18n.language, bySurname };
    return bySurname;
}

export function getTeacherCollesLessons(teacher: string): Lesson[] {
    const bySurname = allTeacherColles();
    const tokens = surnameTokens(teacher);
    if (!tokens.length) return [];

    const lessons: Lesson[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
        for (const lesson of bySurname.get(token) ?? []) {
            if (seen.has(lesson.id)) continue;
            seen.add(lesson.id);
            lessons.push(lesson);
        }
    }
    return lessons;
}
