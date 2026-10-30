import { useTranslation } from "react-i18next";

export type DateLocale = "fr" | "en" | "es";

export type LocaleArg = DateLocale | string | { code?: string } | null | undefined;

export type Interval = { start: Date | number; end: Date | number };

const MAX_FMT_CACHE = 32;
const MAX_ISO_CACHE = 512;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export const pad = (n: number) => n.toString().padStart(2, "0");

export const toTime = (date: Date) => format(date, "HH:mm");

export const atTime = (day: Date, time: string) => {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
};

export const formatTime = (time: string, hour12: boolean) => {
    if (!time) return "--:--";
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    if (!hour12) return `${pad(hours)}:${pad(minutes)}`;
    return `${hours % 12 || 12}:${pad(minutes)} ${hours < 12 ? "AM" : "PM"}`;
};

export const useHour12 = () => {
    const { i18n } = useTranslation();
    return i18n.language.startsWith("en");
};

export const getDateLocale = (language?: string): DateLocale => {
    if (!language) return "fr";
    const lower = language.toLowerCase();
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("es")) return "es";
    return "en";
};

export const localeTag = (locale?: LocaleArg): string => {
    const l = getDateLocale(typeof locale === "string" ? locale : locale?.code);
    if (l === "fr") return "fr-FR";
    if (l === "es") return "es-ES";
    return "en-US";
};

export const toDate = (value: Date | number | string): Date => {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "number") return new Date(value);
    return new Date(value);
};

export const toMs = (value: Date | number | string): number => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return new Date(value).getTime();
};

const fmtCache = new Map<string, Intl.DateTimeFormat>();

const dtf = (locale: LocaleArg, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
    const tag = localeTag(locale);
    const key = `${tag}\u0000${JSON.stringify(options)}`;
    let f = fmtCache.get(key);
    if (f === undefined) {
        if (fmtCache.size >= MAX_FMT_CACHE) {
            const oldest = fmtCache.keys().next();
            if (!oldest.done) fmtCache.delete(oldest.value);
        }
        f = new Intl.DateTimeFormat(tag, options);
        fmtCache.set(key, f);
    }
    return f;
};

const nameCache = new Map<string, string[]>();

const ES_SHORT_OVERRIDES: Record<number, string> = { 8: "sep" };

const monthNames = (locale: LocaleArg, style: "long" | "short"): string[] => {
    const tag = localeTag(locale);
    const key = `M\u0000${tag}\u0000${style}`;
    let names = nameCache.get(key);
    if (names === undefined) {
        const f = dtf(locale, { month: style, timeZone: "UTC" });
        names = [];
        for (let m = 0; m < 12; m++) names.push(f.format(new Date(Date.UTC(2021, m, 15, 12))));
        if (style === "short" && tag === "es-ES") {
            for (const [idx, value] of Object.entries(ES_SHORT_OVERRIDES)) names[Number(idx)] = value;
        }
        nameCache.set(key, names);
    }
    return names;
};

const weekdayNames = (locale: LocaleArg, style: "long" | "short"): string[] => {
    const tag = localeTag(locale);
    const key = `W\u0000${tag}\u0000${style}`;
    let names = nameCache.get(key);
    if (names === undefined) {
        const f = dtf(locale, { weekday: style, timeZone: "UTC" });
        names = [];
        for (let d = 0; d < 7; d++) names.push(f.format(new Date(Date.UTC(2021, 7, 1 + d, 12))));
        nameCache.set(key, names);
    }
    return names;
};

const EN_ORDINAL_SUFFIX = new Map([["one", "st"], ["two", "nd"], ["few", "rd"], ["other", "th"]]);

const EN_ORDINAL = new Intl.PluralRules("en-US", { type: "ordinal" });

const ordinal = (n: number, locale: DateLocale): string =>
    locale === "en"
        ? `${n}${EN_ORDINAL_SUFFIX.get(EN_ORDINAL.select(n))}`
        : locale === "es"
          ? `${n}º`
          : n === 1
            ? `${n}er`
            : `${n}ème`;

const dayOfYear = (d: Date): number => {
    const start = Date.UTC(d.getFullYear(), 0, 1);
    const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((now - start) / MS_DAY) + 1;
};

const WEEK_FIRST_DAY: Record<DateLocale, number> = { fr: 1, en: 0, es: 1 };

const WEEK_MINIMAL_DAYS: Record<DateLocale, number> = { fr: 4, en: 1, es: 1 };

const weekStart = (d: Date, startsOn: number): number => addDays(startOfDay(d), -((d.getDay() - startsOn + 7) % 7)).getTime();

const weekYearStart = (d: Date, startsOn: number, minimalDays: number): number => {
    const anchor = new Date(d.getFullYear(), 0, minimalDays);
    const next = new Date(d.getFullYear() + 1, 0, minimalDays);
    const year = weekStart(d, startsOn) >= weekStart(next, startsOn) ? d.getFullYear() + 1 : weekStart(d, startsOn) < weekStart(anchor, startsOn) ? d.getFullYear() - 1 : d.getFullYear();
    return weekStart(new Date(year, 0, minimalDays), startsOn);
};

const weekOfYear = (d: Date, loc: DateLocale): number =>
    Math.round((weekStart(d, WEEK_FIRST_DAY[loc]) - weekYearStart(d, WEEK_FIRST_DAY[loc], WEEK_MINIMAL_DAYS[loc])) / (MS_DAY * 7)) + 1;

const twelve = (h: number): number => (h % 12 === 0 ? 12 : h % 12);

const meridiem = (h: number): string => (h < 12 ? "AM" : "PM");

const quarter = (d: Date): number => Math.floor(d.getMonth() / 3) + 1;

type TokenFn = (d: Date, loc: DateLocale) => string;

const year = (d: Date): string => String(d.getFullYear());
const mer = (d: Date): string => meridiem(d.getHours());
const monthLong: TokenFn = (d, l) => monthNames(l, "long")[d.getMonth()]!;
const monthShort: TokenFn = (d, l) => monthNames(l, "short")[d.getMonth()]!;
const dayLong: TokenFn = (d, l) => weekdayNames(l, "long")[d.getDay()]!;
const dayShort: TokenFn = (d, l) => weekdayNames(l, "short")[d.getDay()]!;

const TOKENS: Record<string, TokenFn> = {
    yyyy: year, yyy: year, y: year,
    yy: (d) => year(d).slice(-2),
    MMMM: monthLong, MMM: monthShort,
    MM: (d) => pad(d.getMonth() + 1), M: (d) => String(d.getMonth() + 1),
    Mo: (d, l) => ordinal(d.getMonth() + 1, l),
    dd: (d) => pad(d.getDate()), d: (d) => String(d.getDate()),
    do: (d, l) => ordinal(d.getDate(), l),
    EEEE: dayLong, eeee: dayLong, cccc: dayLong,
    EEE: dayShort, EE: dayShort, E: dayShort, eee: dayShort, ccc: dayShort,
    c: (d) => String(d.getDay() === 0 ? 7 : d.getDay()),
    HH: (d) => pad(d.getHours()), H: (d) => String(d.getHours()),
    hh: (d) => pad(twelve(d.getHours())), h: (d) => String(twelve(d.getHours())),
    mm: (d) => pad(d.getMinutes()), m: (d) => String(d.getMinutes()),
    ss: (d) => pad(d.getSeconds()), s: (d) => String(d.getSeconds()),
    a: mer, aa: mer, aaa: mer,
    DDD: (d) => String(dayOfYear(d)).padStart(3, "0"), D: (d) => String(dayOfYear(d)),
    ww: (d, l) => pad(weekOfYear(d, l)), w: (d, l) => String(weekOfYear(d, l)),
    Q: (d) => String(quarter(d)), q: (d) => String(quarter(d)),
    X: (d) => String(Math.floor(d.getTime() / 1000)), x: (d) => String(d.getTime()),
};

const TOKEN_BY_FIRST = Map.groupBy(Object.keys(TOKENS).sort((a, b) => b.length - a.length), (key) => key[0]!);

const QUOTED = /^'(.*?)'/;

const PRESETS: Record<string, string> = {
    PPPP: "EEEE d MMMM yyyy",
    PPP: "d MMMM yyyy",
    PP: "d MMM yyyy",
    P: "dd/MM/yyyy",
};

export function format(value: Date | number | string, pattern: string, options?: { locale?: LocaleArg }): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return "Invalid Date";
    const loc = getDateLocale(typeof options?.locale === "string" ? options.locale : options?.locale?.code);
    const src = PRESETS[pattern] ?? pattern;
    const parts: string[] = [];
    let i = 0;
    while (i < src.length) {
        const char = src[i]!;
        if (char === "'") {
            const quoted = QUOTED.exec(i === 0 ? src : src.slice(i));
            if (quoted) {
                const inner = quoted[1]!;
                if (inner === "") {
                    parts.push("'");
                    i += 1;
                } else {
                    parts.push(inner);
                    i += quoted[0].length;
                }
                continue;
            }
        }
        const bucket = TOKEN_BY_FIRST.get(char);
        let hit = false;
        if (bucket !== undefined) {
            for (const key of bucket) {
                if (src.startsWith(key, i)) {
                    parts.push(TOKENS[key]!(date, loc));
                    i += key.length;
                    hit = true;
                    break;
                }
            }
        }
        if (!hit) {
            parts.push(char);
            i += 1;
        }
    }
    return parts.join("");
}

const isoCache = new Map<string, number>();

const dropIsoCache = () => {
    isoCache.clear();
};

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) dropIsoCache();
    });
}

export function parseISO(str: string): Date {
    const cached = isoCache.get(str);
    if (cached !== undefined) return new Date(cached);
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(str);
    if (!m) return new Date(NaN);
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hours = m[4] === undefined ? 0 : Number(m[4]);
    const minutes = m[5] === undefined ? 0 : Number(m[5]);
    const seconds = m[6] === undefined ? 0 : Number(m[6]);
    if (month < 1 || month > 12 || day < 1 || hours > 23 || minutes > 59 || seconds > 59) return new Date(NaN);
    const date = m[8]
        ? new Date(`${m[1]}-${m[2]}-${m[3]}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}${m[7] ?? ""}${m[8]}`)
        : new Date(year, month - 1, day, hours, minutes, seconds, 0);
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return new Date(NaN);
    const ms = date.getTime();
    if (isoCache.size >= MAX_ISO_CACHE) dropIsoCache();
    isoCache.set(str, ms);
    return new Date(ms);
}

export const isValid = (value: Date | number | string | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    return !Number.isNaN(toMs(value));
};

export const startOfDay = (value: Date | number | string): Date => {
    const d = toDate(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

export const endOfDay = (value: Date | number | string): Date => {
    const d = toDate(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

export const startOfHour = (value: Date | number | string): Date => {
    const d = toDate(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
};

export const addDays = (value: Date | number | string, amount: number): Date => {
    const d = toDate(value);
    d.setDate(d.getDate() + amount);
    return d;
};

export const subDays = (value: Date | number | string, amount: number): Date => addDays(value, -amount);

export const addWeeks = (value: Date | number | string, amount: number): Date => addDays(value, amount * 7);

export const subWeeks = (value: Date | number | string, amount: number): Date => addDays(value, -amount * 7);

export const addMonths = (value: Date | number | string, amount: number): Date => {
    const d = toDate(value);
    const wanted = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + amount);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(wanted, last));
    return d;
};

export const subMonths = (value: Date | number | string, amount: number): Date => addMonths(value, -amount);

export const addHours = (value: Date | number | string, amount: number): Date => new Date(toMs(value) + amount * MS_HOUR);

export const addMinutes = (value: Date | number | string, amount: number): Date => new Date(toMs(value) + amount * MS_MINUTE);

export const startOfWeek = (value: Date | number | string, options?: { weekStartsOn?: number }): Date => {
    const d = startOfDay(value);
    const startsOn = options?.weekStartsOn ?? 0;
    return addDays(d, -((d.getDay() - startsOn + 7) % 7));
};

export const endOfWeek = (value: Date | number | string, options?: { weekStartsOn?: number }): Date =>
    endOfDay(addDays(startOfWeek(value, options), 6));

export const startOfMonth = (value: Date | number | string): Date => {
    const d = toDate(value);
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

export const endOfMonth = (value: Date | number | string): Date => {
    const d = toDate(value);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

export const eachDayOfInterval = (interval: Interval): Date[] => {
    const out: Date[] = [];
    let cursor = startOfDay(interval.start);
    const last = startOfDay(interval.end).getTime();
    while (cursor.getTime() <= last) {
        out.push(cursor);
        cursor = addDays(cursor, 1);
    }
    return out;
};

const sameParts = (a: Date | number | string, b: Date | number | string, parts: number): boolean => {
    const x = toDate(a);
    const y = toDate(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && (parts < 3 || x.getDate() === y.getDate());
};

export const isSameDay = (a: Date | number | string, b: Date | number | string): boolean => sameParts(a, b, 3);

export const isSameMonth = (a: Date | number | string, b: Date | number | string): boolean => sameParts(a, b, 2);

export const isToday = (value: Date | number | string): boolean => isSameDay(value, new Date());

export const isTomorrow = (value: Date | number | string): boolean => isSameDay(value, addDays(new Date(), 1));

export const isYesterday = (value: Date | number | string): boolean => isSameDay(value, addDays(new Date(), -1));

export const isBefore = (a: Date | number | string, b: Date | number | string): boolean => toMs(a) < toMs(b);

export const isAfter = (a: Date | number | string, b: Date | number | string): boolean => toMs(a) > toMs(b);

export const isEqual = (a: Date | number | string, b: Date | number | string): boolean => toMs(a) === toMs(b);

export const isWithinInterval = (value: Date | number | string, interval: Interval): boolean => {
    const t = toMs(value);
    const s = toMs(interval.start);
    const e = toMs(interval.end);
    return t >= Math.min(s, e) && t <= Math.max(s, e);
};

export const isWeekend = (value: Date | number | string): boolean => {
    const day = toDate(value).getDay();
    return day === 0 || day === 6;
};

export const isSunday = (value: Date | number | string): boolean => toDate(value).getDay() === 0;

export const isSaturday = (value: Date | number | string): boolean => toDate(value).getDay() === 6;

export const differenceInMinutes = (a: Date | number | string, b: Date | number | string): number =>
    Math.trunc((toMs(a) - toMs(b)) / MS_MINUTE);

export const differenceInHours = (a: Date | number | string, b: Date | number | string): number =>
    Math.trunc((toMs(a) - toMs(b)) / MS_HOUR);

export const differenceInCalendarDays = (a: Date | number | string, b: Date | number | string): number =>
    Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_DAY);

export const min = (values: Array<Date | number | string>): Date => {
    let best = Infinity;
    for (const v of values) {
        const t = toMs(v);
        if (t < best) best = t;
    }
    return new Date(best);
};

export const max = (values: Array<Date | number | string>): Date => {
    let best = -Infinity;
    for (const v of values) {
        const t = toMs(v);
        if (t > best) best = t;
    }
    return new Date(best);
};

export const getDay = (value: Date | number | string): number => toDate(value).getDay();

export const getHours = (value: Date | number | string): number => toDate(value).getHours();

export const getMinutes = (value: Date | number | string): number => toDate(value).getMinutes();

export const getSeconds = (value: Date | number | string): number => toDate(value).getSeconds();

export const getDate = (value: Date | number | string): number => toDate(value).getDate();

export const getMonth = (value: Date | number | string): number => toDate(value).getMonth();

export const getYear = (value: Date | number | string): number => toDate(value).getFullYear();

export const setHours = (value: Date | number | string, hours: number, minutes?: number, seconds?: number): Date => {
    const d = toDate(value);
    d.setHours(hours, minutes ?? d.getMinutes(), seconds ?? d.getSeconds(), 0);
    return d;
};

export const setMinutes = (value: Date | number | string, minutes: number, seconds?: number): Date => {
    const d = toDate(value);
    d.setMinutes(minutes, seconds ?? d.getSeconds(), 0);
    return d;
};

export const setSeconds = (value: Date | number | string, seconds: number): Date => {
    const d = toDate(value);
    d.setSeconds(seconds, 0);
    return d;
};

export const setDay = (value: Date | number | string, day: number, options?: { weekStartsOn?: number }): Date => {
    const startsOn = options?.weekStartsOn ?? 0;
    return addDays(startOfWeek(value, { weekStartsOn: startsOn }), (day - startsOn + 7) % 7);
};

export const toISODate = (value: Date | number | string): string => {
    const d = toDate(value);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toISODateTime = (value: Date | number | string): string => {
    const d = toDate(value);
    return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const DISTANCE_WORDS: Record<string, [string, string, string, string, string]> = {
    "fr-FR": ["moins d\u2019une minute", "environ", "plus de", "plus d\u2019un an", "presque"],
    "en-US": ["less than a minute", "about", "over", "over 1 year", "almost"],
    "es-ES": ["menos de un minuto", "alrededor de", "m\u00e1s de", "m\u00e1s de 1 a\u00f1o", "casi"],
};

const unitFormatCache = new Map<string, Intl.NumberFormat>();

const unitText = (tag: string, unit: Intl.NumberFormatOptions["unit"], n: number): string => {
    const key = `${tag}\u0000${unit}`;
    let f = unitFormatCache.get(key);
    if (f === undefined) {
        f = new Intl.NumberFormat(tag, { style: "unit", unit, unitDisplay: "long" });
        unitFormatCache.set(key, f);
    }
    return f.format(n).replace(/[\u00a0\u202f]/g, " ");
};

const tzOffsetMs = (d: Date): number => -d.getTimezoneOffset() * MS_MINUTE;

const isLastDayOfMonth = (d: Date): boolean =>
    d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const fullMonthsBetween = (later: Date, earlier: Date): number => {
    const months = (later.getFullYear() - earlier.getFullYear()) * 12 + later.getMonth() - earlier.getMonth();
    if (months < 1) return 0;
    const probe = new Date(later.getTime());
    if (probe.getMonth() === 1 && probe.getDate() > 27) probe.setDate(30);
    probe.setMonth(probe.getMonth() - months);
    let notFull = probe.getTime() < earlier.getTime();
    if (isLastDayOfMonth(later) && months === 1) notFull = false;
    return months - (notFull ? 1 : 0);
};

export const formatDistanceToNow = (value: Date | number | string, options?: { locale?: LocaleArg; now?: Date | number }): string => {
    const tag = localeTag(options?.locale);
    const words = DISTANCE_WORDS[tag] ?? DISTANCE_WORDS["en-US"]!;
    const target = toDate(value);
    const base = options?.now === undefined ? new Date() : toDate(options.now);
    const [later, earlier] = target.getTime() > base.getTime() ? [target, base] : [base, target];
    const seconds = Math.trunc((later.getTime() - earlier.getTime()) / 1000);
    const minutes = Math.round((seconds - (tzOffsetMs(earlier) - tzOffsetMs(later)) / 1000) / 60);
    if (minutes < 2) return minutes === 0 ? words[0] : unitText(tag, "minute", minutes);
    if (minutes < 45) return unitText(tag, "minute", minutes);
    if (minutes < 90) return `${words[1]} ${unitText(tag, "hour", 1)}`;
    if (minutes < 1440) return `${words[1]} ${unitText(tag, "hour", Math.round(minutes / 60))}`;
    if (minutes < 2520) return unitText(tag, "day", 1);
    if (minutes < 43200) return unitText(tag, "day", Math.round(minutes / 1440));
    if (minutes < 86400) return `${words[1]} ${unitText(tag, "month", Math.round(minutes / 43200))}`;
    const months = fullMonthsBetween(later, earlier);
    if (months < 12) return unitText(tag, "month", Math.round(minutes / 43200));
    const years = Math.trunc(months / 12);
    const remainder = months % 12;
    if (remainder < 3) return `${words[1]} ${unitText(tag, "year", years)}`;
    if (remainder < 9) return years === 1 ? words[3] : `${words[2]} ${unitText(tag, "year", years)}`;
    return `${words[4]} ${unitText(tag, "year", years + 1)}`;
};

export const getDayPickerLocale = (lang?: string): { code: string } => ({
    code: localeTag(lang),
});
