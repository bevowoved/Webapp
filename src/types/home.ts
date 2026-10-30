import { Lesson } from "./aurion";

export type PreparedLesson = {
    courseTitle: string;
    time: string;
    location: string;
    type: string;
    teacher: string;
    notes?: string;
    details: Lesson;
};

export type HomeUpcoming = {
    current: PreparedLesson | null;
    today: PreparedLesson[];
    tomorrow: PreparedLesson[];
};
