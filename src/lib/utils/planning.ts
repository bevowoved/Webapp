import { UserEvent } from "@/types/data";
import { toMs } from "./date-time";
import { readJsonCached, saveToStorage } from "./storage";

const USER_EVENTS_KEY = "userEvents";

const toIso = (value: string): string => {
    const time = toMs(value);
    return Number.isNaN(time) ? value : new Date(time).toISOString();
};

const normalize = (event: UserEvent): UserEvent => ({ ...event, start: toIso(event.start), end: toIso(event.end) });

const parseUserEvents = (raw: string): UserEvent[] => {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as UserEvent[]).map(normalize) : [];
    } catch {
        return [];
    }
};

const readUserEvents = (): UserEvent[] => readJsonCached(USER_EVENTS_KEY, parseUserEvents);

const writeUserEvents = (events: UserEvent[]) =>
    saveToStorage(USER_EVENTS_KEY, JSON.stringify(events.map(normalize)));

export function saveUserEventToLocalStorage({ userEvent }: { userEvent: UserEvent }) {
    const existing = readUserEvents();
    const index = existing.findIndex((ue) => ue.id === userEvent.id);
    writeUserEvents(index === -1 ? [...existing, userEvent] : existing.map((ue, i) => (i === index ? userEvent : ue)));
}

export function getUserEventsFromLocalStorage(): UserEvent[] {
    return readUserEvents();
}

export function removeUserEventFromLocalStorage({ userEventId }: { userEventId: string }) {
    writeUserEvents(readUserEvents().filter((ue) => ue.id !== userEventId));
}
