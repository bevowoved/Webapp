import { Campus } from "./campus";

const WORD_TOKEN = /^[A-Za-zÀ-ÖØ-öø-ÿ]+$/;
const MIN_WORD_LENGTH = 4;

const isWordToken = (token: string): boolean => token.length >= MIN_WORD_LENGTH && WORD_TOKEN.test(token);

const titleCase = (token: string): string => token.charAt(0) + token.slice(1).toLowerCase();

const TAG_LABELS: Record<string, string> = {
    VP: "(Vidéo proj.)",
    "2TAB": "(2 tableaux)",
    TV: "(Télé)",
};

const formatTokens = (tokens: string[]): string =>
    tokens
        .map((token) => TAG_LABELS[token.toUpperCase()] ?? (isWordToken(token) ? titleCase(token) : token))
        .join(" ");

const BUILDING_NAMES: Record<string, string> = {
    ALG_2RNS: "Albert Legrand",
    BORDEAUX_2AML: "Bordeaux",
    IC1: "IC1",
    IC2: "IC2",
    PR_39BV: "Palais Rameau",
};

export const formatBuildingName = (code: string): string => BUILDING_NAMES[code] ?? formatTokens(code.split("_"));

const BUILDING_CAMPUS: Record<string, Campus> = {
    ALG_2RNS: "lille",
    BORDEAUX_2AML: "bordeaux",
    IC1: "lille",
    IC2: "lille",
    PR_39BV: "lille",
};

export const isBuildingOnCampus = (code: string, campus: Campus): boolean => (BUILDING_CAMPUS[code] ?? "lille") === campus;

export function getCommonPrefixTokenCount(roomCodes: string[]): number {
    if (roomCodes.length === 0) return 0;
    const tokenLists = roomCodes.map((code) => code.split("_"));
    const minLength = Math.min(...tokenLists.map((tokens) => tokens.length));
    let count = 0;
    while (count < minLength - 1 && tokenLists.every((tokens) => tokens[count] === tokenLists[0][count])) count++;
    return count;
}

export function formatRoomName(roomCode: string, prefixTokens: number): string {
    const tokens = roomCode.split("_");
    const remaining = tokens.slice(prefixTokens);
    return formatTokens(remaining.length > 0 ? remaining : tokens);
}

const ALL_DAY_RE = /\b(?:toute la journ[ée]e|all day)\b/i;
const DURATION_RE = /\b(?:\d+\s*h\s*\d*|\d+\s*min)\s*max\b/i;
const TIME_RE = /\b(\d{1,2}):(\d{2})\b/;
const FREE_PREFIX_RE = /^(?:libre\s+(?=jusqu['’]à)|free\s+(?=until))/i;
const ENSUITE_DURATION_RE = /(?:r[ée]servable ensuite|then bookable)\s*:\s*((?:\d+\s*h\s*\d*)|(?:\d+\s*min))\s*max/i;

export const isRedundantAllDayDuration = (text: string): boolean => ALL_DAY_RE.test(text);

export const stripRedundantFreeLabel = (text: string, isFree: boolean): string =>
    isFree ? text.replace(FREE_PREFIX_RE, "") : text;

export type HighlightedText = {
    prefix: string;
    highlight: string;
    suffix: string;
};

const sliceMatch = (text: string, match: RegExpExecArray, highlight: string): HighlightedText => ({
    prefix: text.slice(0, match.index),
    highlight,
    suffix: text.slice(match.index + match[0].length),
});

export function splitHighlight(text: string, isEnglish: boolean): HighlightedText | null {
    const allDay = ALL_DAY_RE.exec(text);
    if (allDay) return sliceMatch(text, allDay, allDay[0]);

    const duration = DURATION_RE.exec(text);
    if (duration) return sliceMatch(text, duration, duration[0]);

    const time = TIME_RE.exec(text);
    if (!time) return null;
    return sliceMatch(text, time, isEnglish ? time[0] : `${time[1]}h${time[2]}`);
}

export function formatTimeOfDay(time: string, isEnglish: boolean): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!match) return time;
    return isEnglish ? `${match[1]}:${match[2]}` : `${match[1]}h${match[2]}`;
}

function parseDurationMinutes(raw: string): number | null {
    const trimmed = raw.trim();
    const hourMatch = /^(\d+)\s*h\s*(\d+)?$/i.exec(trimmed);
    if (hourMatch) return parseInt(hourMatch[1], 10) * 60 + (hourMatch[2] ? parseInt(hourMatch[2], 10) : 0);
    const minuteMatch = /^(\d+)\s*min$/i.exec(trimmed);
    return minuteMatch ? parseInt(minuteMatch[1], 10) : null;
}

function parseClockMinutes(raw: string): number | null {
    const match = TIME_RE.exec(raw);
    return match ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10) : null;
}

function formatClockMinutes(totalMinutes: number, isEnglish: boolean): string {
    const dayMinutes = 24 * 60;
    const normalized = ((totalMinutes % dayMinutes) + dayMinutes) % dayMinutes;
    const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
    const mm = String(normalized % 60).padStart(2, "0");
    return isEnglish ? `${hh}:${mm}` : `${hh}h${mm}`;
}

export function computeBookableUntil(libreText: string, dureeText: string, isEnglish: boolean): string | null {
    const durationMatch = ENSUITE_DURATION_RE.exec(dureeText);
    if (!durationMatch) return null;

    const durationMinutes = parseDurationMinutes(durationMatch[1]);
    const startMinutes = parseClockMinutes(libreText);
    if (durationMinutes === null || startMinutes === null) return null;

    return formatClockMinutes(startMinutes + durationMinutes, isEnglish);
}
