import { Lesson } from "@/types/aurion";
import i18n from "@/i18n";
import { parseFromTitle } from "./home";
import { toDate } from "./date-time";

const escapeIcsText = (text: string): string =>
    text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const formatDateUTC = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");

const buildIcsContent = (events: Lesson[]): string => {
    const stamp = formatDateUTC(new Date());
    const vevents = events
        .map((lesson) => {
            const parsed = parseFromTitle(lesson);
            const start = toDate(lesson.start);
            const end = toDate(lesson.end);
            return [
                "BEGIN:VEVENT",
                `UID:${lesson.id}@mauria`,
                `DTSTAMP:${stamp}`,
                `DTSTART:${formatDateUTC(start)}`,
                `DTEND:${formatDateUTC(end)}`,
                `SUMMARY:${escapeIcsText(parsed.courseTitle || i18n.t("schedulePage.calendar.untitledEvent"))}`,
                `LOCATION:${escapeIcsText(parsed.location || "Mauria")}`,
                `DESCRIPTION:${escapeIcsText(
                    `${i18n.t("schedulePage.calendar.teacher")}: ${parsed.teacher || i18n.t("schedulePage.calendar.unknown")}, ${i18n.t("schedulePage.calendar.type")}: ${parsed.type || i18n.t("schedulePage.calendar.unknown")}`
                )}`,
                "END:VEVENT",
            ].join("\r\n");
        })
        .join("\r\n");

    return (
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Mauria//Planning//FR",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            vevents,
            "END:VCALENDAR",
        ].join("\r\n") + "\r\n"
    );
};

export const exportCalendar = async (events: Lesson[]): Promise<void> => {
    const icsContent = buildIcsContent(events);
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const file = new File([blob], "mauria-planning.ics", { type: "text/calendar" });

    if (navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: "Mauria Planning" });
            return;
        } catch (error) {
            if ((error as DOMException).name === "AbortError") return;
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mauria-planning.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
