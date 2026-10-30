export type ColleSubject = "maths" | "physics" | "english" | "cs" | "engineering";

export type ColleSlot = {
    subject: ColleSubject;
    teacher: string;
    room: string;
    weekday: number;
    start: string;
};

export type CollesClass = {
    id: string;
    label: string;
    source: string;
    weekStarts: string[];
    slots: Record<string, ColleSlot>;
    groups: Record<string, string[][]>;
};
