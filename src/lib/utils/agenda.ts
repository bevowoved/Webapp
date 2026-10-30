import { TaskData } from "@/types/data";
import { toDate } from "./date-time";
import { readJsonCached, saveToStorage } from "./storage";

const TASKS_KEY = "tasks";

type StoredTask = Omit<TaskData, "date"> & { date: string };

const parseDate = (value: string): Date => {
    const date = toDate(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const parseTasks = (raw: string): TaskData[] => {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return (parsed as StoredTask[])
            .map((task) => ({ ...task, date: parseDate(task.date) }))
            .toSorted((a, b) => a.date.getTime() - b.date.getTime());
    } catch {
        return [];
    }
};

const readTasks = (): TaskData[] => readJsonCached(TASKS_KEY, parseTasks);

const writeTasks = (tasks: TaskData[]) =>
    saveToStorage(TASKS_KEY, JSON.stringify(tasks.map((t) => ({ ...t, date: t.date.toISOString() }))));

export function saveTaskToLocalStorage({ task }: { task: TaskData }) {
    const existing = readTasks();
    const index = existing.findIndex((t) => t.id === task.id);
    writeTasks(index === -1 ? [...existing, task] : existing.map((t, i) => (i === index ? task : t)));
}

export function getTasksFromLocalStorage(): TaskData[] {
    return readTasks();
}

export function removeTaskFromLocalStorage({ taskId }: { taskId: string }) {
    writeTasks(readTasks().filter((task) => task.id !== taskId));
}
