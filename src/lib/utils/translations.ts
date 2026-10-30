import { getFromStorage, saveToStorage } from "./storage";
import i18n from "@/i18n";
import * as dateTime from "./date-time";

export type { DateLocale, LocaleArg } from "./date-time";

export {
    getDateLocale,
    localeTag,
    getDayPickerLocale,
    format,
    parseISO,
    isValid,
    toDate,
    toMs,
    pad,
    toTime,
    atTime,
    formatTime,
    formatDistanceToNow,
    startOfDay,
    endOfDay,
    startOfHour,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    addDays,
    subDays,
    addWeeks,
    subWeeks,
    addMonths,
    subMonths,
    addHours,
    addMinutes,
    isSameDay,
    isSameMonth,
    isToday,
    isTomorrow,
    isYesterday,
    isBefore,
    isAfter,
    isEqual,
    isWithinInterval,
    isWeekend,
    isSunday,
    isSaturday,
    differenceInMinutes,
    differenceInHours,
    differenceInCalendarDays,
    min,
    max,
    getDay,
    getHours,
    getMinutes,
    getSeconds,
    getDate,
    getMonth,
    getYear,
    setHours,
    setMinutes,
    setSeconds,
    setDay,
    toISODate,
    toISODateTime,
} from "./date-time";

export type LocaleOption = "fr-FR" | "en-US" | "es-ES";

export const LOCALE_STORAGE_KEY = "mauria-locale";

const I18N_CODE: Record<LocaleOption, "fr" | "en" | "es"> = {
    "fr-FR": "fr",
    "en-US": "en",
    "es-ES": "es",
};

const toLocaleOption = (lng?: string): LocaleOption => {
    if (!lng) return "fr-FR";
    return lng.startsWith("fr") ? "fr-FR" : lng.startsWith("es") ? "es-ES" : "en-US";
};

export const readInitialLocale = (): LocaleOption => {
    if (typeof window === "undefined") return "fr-FR";
    const stored = getFromStorage(LOCALE_STORAGE_KEY);
    if (stored === "fr-FR" || stored === "en-US" || stored === "es-ES") return stored;
    const nav = navigator.language || (navigator.languages && navigator.languages[0]) || "fr";
    return toLocaleOption(nav);
};

export const applyLocale = (locale: LocaleOption) => {
    const code = I18N_CODE[locale];
    i18n.changeLanguage(code);
    saveToStorage(LOCALE_STORAGE_KEY, locale);
};

export const dateHelpers = dateTime;

export { parseFrDate, frDateToIso } from "./grades";
