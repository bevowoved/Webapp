import * as React from "react";

export type ClassValue =
    | string
    | number
    | null
    | undefined
    | boolean
    | ClassValue[]
    | Record<string, boolean | null | undefined>;

const FONT_SIZES = new Set([
    "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
]);

const FONT_WEIGHTS = new Set([
    "thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black",
]);

const FONT_FAMILIES = new Set(["sans", "serif", "mono"]);

const TEXT_ALIGNS = new Set(["left", "center", "right", "justify", "start", "end"]);

const TEXT_WRAPS = new Set(["wrap", "nowrap", "balance", "pretty"]);

const TEXT_OVERFLOWS = new Set(["ellipsis", "clip"]);

const BORDER_STYLES = new Set(["solid", "dashed", "dotted", "double", "hidden", "none"]);

const SHADOW_SIZES = new Set(["", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "inner", "none"]);

const SIDES = ["t", "r", "b", "l"] as const;
const CORNERS = ["tl", "tr", "br", "bl"] as const;

const LENGTH_RE = /^-?\d|^\[.*(px|rem|em|%|vh|vw|ch|ex|dvh|dvw|svh|lvh|cqw|cqh|pt|pc|in|cm|mm|q)\]$/i;

const isArbitrary = (value: string) => value.startsWith("[") || value.startsWith("(");

const looksLikeLength = (value: string) => LENGTH_RE.test(value);

type Parsed = {
    modifiers: string;
    family: string;
};

const splitModifiers = (token: string): { modifiers: string; base: string } => {
    let depth = 0;
    let lastColon = -1;
    for (let i = 0; i < token.length; i += 1) {
        const c = token[i];
        if (c === "[" || c === "(") depth += 1;
        else if (c === "]" || c === ")") depth -= 1;
        else if (c === ":" && depth === 0) lastColon = i;
    }
    if (lastColon === -1) return { modifiers: "", base: token };
    return { modifiers: token.slice(0, lastColon), base: token.slice(lastColon + 1) };
};

const isImportant = (base: string): boolean => base.startsWith("!") || base.endsWith("!");

const stripImportant = (base: string): string => {
    let out = base;
    if (out.startsWith("!")) out = out.slice(1);
    if (out.endsWith("!")) out = out.slice(0, -1);
    return out;
};

const boxFamily = (prefix: string, value: string): { family: string; slot: string } | null => {
    if (value === "") return { family: `${prefix}-all`, slot: "all" };
    for (const side of SIDES) {
        if (value === side) return { family: `${prefix}-${side}`, slot: side };
        if (value.startsWith(`${side}-`)) return { family: `${prefix}-${side}`, slot: side };
    }
    if (value === "x") return { family: `${prefix}-x`, slot: "x" };
    if (value === "y") return { family: `${prefix}-y`, slot: "y" };
    if (value === "s") return { family: `${prefix}-s`, slot: "s" };
    if (value === "e") return { family: `${prefix}-e`, slot: "e" };
    if (value.startsWith("x-")) return { family: `${prefix}-x`, slot: "x" };
    if (value.startsWith("y-")) return { family: `${prefix}-y`, slot: "y" };
    if (value.startsWith("s-")) return { family: `${prefix}-s`, slot: "s" };
    if (value.startsWith("e-")) return { family: `${prefix}-e`, slot: "e" };
    return { family: `${prefix}-all`, slot: "all" };
};

const EXACT_FAMILY: Record<string, string> = Object.fromEntries(
    (
        [
            ["display", "flex grid block inline hidden contents inline-flex inline-grid inline-block inline-table table table-row table-cell flow-root list-item"],
            ["position", "static fixed absolute relative sticky"],
            ["sr", "sr-only not-sr-only"],
            ["text-overflow", "truncate text-ellipsis text-clip"],
            ["text-transform", "uppercase lowercase capitalize normal-case"],
            ["font-style", "italic not-italic"],
            ["text-decoration", "underline no-underline line-through overline"],
            ["font-smoothing", "antialiased subpixel-antialiased"],
            ["font-variant-numeric", "tabular-nums proportional-nums ordinal slashed-zero"],
            ["pointer-events", "pointer-events-none pointer-events-auto"],
            ["word-break", "break-words break-normal break-all break-keep"],
        ] as const
    ).flatMap(([family, words]) => words.split(" ").map((word) => [word, family] as const))
);

const EXACT_SLOT: Record<string, string> = { "text-overflow": "overflow", "text-transform": "transform", "font-style": "style", "text-decoration": "decoration", "font-smoothing": "smoothing", "font-variant-numeric": "numeric", "pointer-events": "pe", "word-break": "break" };

const PREFIX_FAMILY: Array<[string, string]> = [
    ["line-clamp-", "line-clamp"],
    ["mix-blend-", "mix-blend"],
    ["will-change-", "will-change"],
    ["grid-cols-", "grid-cols"],
    ["grid-rows-", "grid-rows"],
    ["col-span-", "col-span"],
    ["row-span-", "row-span"],
    ["place-items-", "place-items"],
    ["place-content-", "place-content"],
    ["place-self-", "place-self"],
    ["touch-", "touch-action"],
];

const classify = (baseRaw: string): { family: string; slot: string } => {
    const base = stripImportant(baseRaw);
    const body = base.startsWith("-") ? base.slice(1) : base;
    const dash = body.indexOf("-");
    const head = dash === -1 ? body : body.slice(0, dash);
    const value = dash === -1 ? "" : body.slice(dash + 1);

    if (body.startsWith("[") && body.endsWith("]")) {
        const inner = body.slice(1, -1);
        const colon = inner.indexOf(":");
        return { family: `arb:${colon === -1 ? inner : inner.slice(0, colon)}`, slot: "arb" };
    }

    const exact = EXACT_FAMILY[body];
    if (exact !== undefined) return { family: exact, slot: EXACT_SLOT[exact] ?? exact };

    for (const [prefix, family] of PREFIX_FAMILY) {
        if (body.startsWith(prefix)) return { family, slot: family };
    }
    for (const prefix of ["overscroll-", "scroll-", "snap-"]) {
        if (body.startsWith(prefix)) {
            const axis = value.split("-")[0] ?? "all";
            return { family: `${prefix}${axis}`, slot: prefix.slice(0, -1) };
        }
    }
    if (body.startsWith("object-")) {
        if (body === "object-contain" || body === "object-cover" || body === "object-fill" || body === "object-none" || body === "object-scale-down") {
            return { family: "object-fit", slot: "fit" };
        }
        return { family: "object-position", slot: "position" };
    }
    if (head === "flex") {
        if (value === "row" || value === "row-reverse" || value === "col" || value === "col-reverse") {
            return { family: "flex-direction", slot: "dir" };
        }
        if (value === "wrap" || value === "wrap-reverse" || value === "nowrap") {
            return { family: "flex-wrap", slot: "wrap" };
        }
        return { family: "flex", slot: "flex" };
    }

    if (head === "p" || head === "m")
        return boxFamily(head, value) ?? { family: `${head}-all`, slot: "all" };

    if (head === "px" || head === "py" || head === "mx" || head === "my") {
        return { family: `${head[0]}-${head.slice(1)}`, slot: head.slice(1) };
    }
    if (head === "pt" || head === "pb" || head === "pl" || head === "pr") {
        return { family: `p-${head.slice(1)}`, slot: head.slice(1) };
    }
    if (head === "mt" || head === "mb" || head === "ml" || head === "mr") {
        return { family: `m-${head.slice(1)}`, slot: head.slice(1) };
    }
    if (head === "ps" || head === "pe") return { family: `p-${head.slice(1)}`, slot: head.slice(1) };
    if (head === "ms" || head === "me") return { family: `m-${head.slice(1)}`, slot: head.slice(1) };

    if (head === "gap") {
        if (value === "x" || value.startsWith("x-")) return { family: "gap-x", slot: "x" };
        if (value === "y" || value.startsWith("y-")) return { family: "gap-y", slot: "y" };
        return { family: "gap", slot: "all" };
    }

    if (head === "size") return { family: "size", slot: "size" };
    if (head === "w") return { family: "w", slot: "w" };
    if (head === "h") return { family: "h", slot: "h" };
    if (head === "min" && value.startsWith("w-")) return { family: "min-w", slot: "min-w" };
    if (head === "min" && value.startsWith("h-")) return { family: "min-h", slot: "min-h" };
    if (head === "max" && value.startsWith("w-")) return { family: "max-w", slot: "max-w" };
    if (head === "max" && value.startsWith("h-")) return { family: "max-h", slot: "max-h" };

    if (head === "inset") {
        if (value === "x" || value.startsWith("x-")) return { family: "inset-x", slot: "x" };
        if (value === "y" || value.startsWith("y-")) return { family: "inset-y", slot: "y" };
        return { family: "inset", slot: "all" };
    }
    if (head === "top" || head === "right" || head === "bottom" || head === "left") {
        return { family: head, slot: head };
    }

    if (head === "text") {
        if (FONT_SIZES.has(value)) return { family: "text-size", slot: "size" };
        if (TEXT_ALIGNS.has(value)) return { family: "text-align", slot: "align" };
        if (TEXT_WRAPS.has(value)) return { family: "text-wrap", slot: "wrap" };
        if (TEXT_OVERFLOWS.has(value)) return { family: "text-overflow", slot: "overflow" };
        if (isArbitrary(value) && looksLikeLength(value)) return { family: "text-size", slot: "size" };
        return { family: "text-color", slot: "color" };
    }

    if (head === "font") {
        if (FONT_WEIGHTS.has(value)) return { family: "font-weight", slot: "weight" };
        if (FONT_FAMILIES.has(value)) return { family: "font-family", slot: "family" };
        return { family: `font-unique-${value}`, slot: "unique" };
    }

    if (head === "leading") return { family: "leading", slot: "leading" };
    if (head === "tracking") return { family: "tracking", slot: "tracking" };

    if (head === "border") {
        if (value === "") return { family: "border-w", slot: "all" };
        for (const side of SIDES) {
            if (value === side) return { family: `border-w-${side}`, slot: side };
            if (value.startsWith(`${side}-`)) {
                const rest = value.slice(side.length + 1);
                if (BORDER_STYLES.has(rest)) return { family: `border-s-${side}`, slot: `s-${side}` };
                if (looksLikeLength(rest) || /^\d+$/.test(rest)) return { family: `border-w-${side}`, slot: side };
                return { family: `border-c-${side}`, slot: `c-${side}` };
            }
        }
        if (value === "x") return { family: "border-w-x", slot: "x" };
        if (value === "y") return { family: "border-w-y", slot: "y" };
        if (value.startsWith("x-")) return { family: "border-w-x", slot: "x" };
        if (value.startsWith("y-")) return { family: "border-w-y", slot: "y" };
        if (BORDER_STYLES.has(value)) return { family: "border-style", slot: "style" };
        if (/^\d+$/.test(value) || looksLikeLength(value)) return { family: "border-w", slot: "all" };
        return { family: "border-color", slot: "color" };
    }

    if (head === "rounded") {
        if (value === "") return { family: "rounded-all", slot: "all" };
        for (const corner of CORNERS) {
            if (value === corner || value.startsWith(`${corner}-`)) return { family: `rounded-${corner}`, slot: corner };
        }
        for (const side of SIDES) {
            if (value === side || value.startsWith(`${side}-`)) return { family: `rounded-${side}`, slot: side };
        }
        if (value === "none" || value === "full") return { family: "rounded-all", slot: "all" };
        return { family: "rounded-all", slot: "all" };
    }

    if (head === "ring") {
        if (value === "") return { family: "ring-w", slot: "all" };
        if (value === "inset") return { family: "ring-inset", slot: "inset" };
        if (value.startsWith("offset-")) {
            const rest = value.slice(7);
            if (/^\d+$/.test(rest) || looksLikeLength(rest)) return { family: "ring-offset-w", slot: "offset-w" };
            return { family: "ring-offset-color", slot: "offset-c" };
        }
        if (/^\d+$/.test(value) || looksLikeLength(value)) return { family: "ring-w", slot: "all" };
        return { family: "ring-color", slot: "color" };
    }

    if (head === "bg") {
        if (value === "fixed" || value === "local" || value === "scroll") return { family: "bg-attachment", slot: "att" };
        if (value === "auto" || value === "cover" || value === "contain") return { family: "bg-size", slot: "size" };
        if (value === "repeat" || value === "no-repeat" || value.startsWith("repeat-")) return { family: "bg-repeat", slot: "repeat" };
        if (value === "none" || value.startsWith("gradient-") || value.startsWith("linear-") || value.startsWith("radial-") || value.startsWith("conic-") || isArbitrary(value)) {
            return { family: "bg", slot: "image" };
        }
        if (value.startsWith("clip-")) return { family: "bg-clip", slot: "clip" };
        if (value.startsWith("origin-")) return { family: "bg-origin", slot: "origin" };
        if (value.startsWith("blend-")) return { family: "bg-blend", slot: "blend" };
        if (/^(bottom|center|left|right|top)$/.test(value) || /^(left|right|top|bottom)-(top|bottom|left|right|center)$/.test(value)) {
            return { family: "bg-position", slot: "position" };
        }
        return { family: "bg", slot: "color" };
    }

    if (head === "shadow") {
        if (SHADOW_SIZES.has(value)) return { family: "shadow", slot: "shadow" };
        if (isArbitrary(value)) return { family: "shadow", slot: "shadow" };
        return { family: "shadow-color", slot: "shadow-color" };
    }

    if (head === "overflow") {
        if (value === "x" || value.startsWith("x-")) return { family: "overflow-x", slot: "x" };
        if (value === "y" || value.startsWith("y-")) return { family: "overflow-y", slot: "y" };
        return { family: "overflow", slot: "all" };
    }

    if (head === "outline") {
        if (value === "" || /^\d+$/.test(value) || looksLikeLength(value)) return { family: "outline-w", slot: "w" };
        if (value === "none" || value === "hidden" || value === "dashed" || value === "dotted" || value === "double" || value === "solid") {
            return { family: "outline-style", slot: "style" };
        }
        if (value.startsWith("offset-")) return { family: "outline-offset", slot: "offset" };
        return { family: "outline-color", slot: "color" };
    }

    if (head === "transition") return { family: "transition", slot: "transition" };
    if (head === "duration") return { family: "duration", slot: "duration" };
    if (head === "delay") return { family: "delay", slot: "delay" };
    if (head === "ease") return { family: "ease", slot: "ease" };
    if (head === "animate") return { family: "animate", slot: "animate" };

    if (head === "translate" && (value.startsWith("x-") || value === "x")) return { family: "translate-x", slot: "x" };
    if (head === "translate" && (value.startsWith("y-") || value === "y")) return { family: "translate-y", slot: "y" };
    if (head === "scale" && (value.startsWith("x-") || value === "x")) return { family: "scale-x", slot: "x" };
    if (head === "scale" && (value.startsWith("y-") || value === "y")) return { family: "scale-y", slot: "y" };
    if (head === "scale") return { family: "scale", slot: "scale" };
    if (head === "rotate") return { family: "rotate", slot: "rotate" };
    if (head === "skew" && value.startsWith("x-")) return { family: "skew-x", slot: "x" };
    if (head === "skew" && value.startsWith("y-")) return { family: "skew-y", slot: "y" };

    if (head === "z") return { family: "z", slot: "z" };
    if (head === "opacity") return { family: "opacity", slot: "opacity" };
    if (head === "grid-cols") return { family: "grid-cols", slot: "cols" };
    if (head === "grid-rows") return { family: "grid-rows", slot: "rows" };
    if (head === "col-span") return { family: "col-span", slot: "span" };
    if (head === "row-span") return { family: "row-span", slot: "span" };

    if (head === "items") return { family: "items", slot: "items" };
    if (head === "justify") return { family: "justify", slot: "justify" };
    if (head === "content") return { family: "align-content", slot: "content" };
    if (head === "self") return { family: "self", slot: "self" };
    if (head === "place-items") return { family: "place-items", slot: "place" };
    if (head === "place-content") return { family: "place-content", slot: "place" };

    if (head === "select") return { family: "select", slot: "select" };
    if (head === "cursor") return { family: "cursor", slot: "cursor" };
    if (head === "whitespace") return { family: "whitespace", slot: "whitespace" };
    if (head === "break") {
        if (value === "words" || value === "normal" || value === "all" || value === "keep") {
            return { family: "word-break", slot: "break" };
        }
        return { family: `break-unique-${value}`, slot: "unique" };
    }
    if (head === "pointer-events") return { family: "pointer-events", slot: "pe" };
    if (head === "resize") return { family: "resize", slot: "resize" };
    if (head === "object") {
        if (value === "contain" || value === "cover" || value === "fill" || value === "none" || value === "scale-down") {
            return { family: "object-fit", slot: "fit" };
        }
        return { family: "object-position", slot: "position" };
    }
    if (head === "aspect") return { family: "aspect", slot: "aspect" };
    if (head === "columns") return { family: "columns", slot: "columns" };
    if (head === "basis") return { family: "basis", slot: "basis" };
    if (head === "grow") return { family: "grow", slot: "grow" };
    if (head === "shrink") return { family: "shrink", slot: "shrink" };
    if (head === "order") return { family: "order", slot: "order" };
    if (head === "isolate" || head === "isolation") return { family: "isolation", slot: "isolation" };
    if (head === "mix-blend") return { family: "mix-blend", slot: "blend" };
    if (head === "fill") return { family: "fill", slot: "fill" };
    if (head === "stroke") {
        if (/^\d+$/.test(value) || looksLikeLength(value)) return { family: "stroke-w", slot: "w" };
        return { family: "stroke", slot: "stroke" };
    }
    if (head === "divide") return { family: `divide-${value.split("-")[0] ?? "x"}`, slot: value.split("-")[0] ?? "x" };
    if (head === "space") {
        if (value.startsWith("x-") || value === "x") return { family: "space-x", slot: "x" };
        if (value.startsWith("y-") || value === "y") return { family: "space-y", slot: "y" };
        return { family: "space", slot: "all" };
    }
    if (head === "will-change") return { family: "will-change", slot: "will" };
    if (head === "origin") return { family: "transform-origin", slot: "origin" };
    if (head === "backdrop") return { family: `backdrop-${value.split("-")[0] ?? "x"}`, slot: value.split("-")[0] ?? "x" };
    if (head === "filter" || head === "blur" || head === "brightness" || head === "contrast" || head === "grayscale" || head === "invert" || head === "saturate" || head === "sepia") {
        return { family: head, slot: head };
    }

    return { family: "", slot: "unique" };
};

const MAX_PARSE_CACHE = 8192;

const parseCache = new Map<string, Parsed>();

const parse = (raw: string): Parsed => {
    const hit = parseCache.get(raw);
    if (hit !== undefined) return hit;
    const { modifiers, base } = splitModifiers(raw);
    const important = isImportant(base) ? "!" : "";
    const parsed: Parsed = { modifiers: important ? `${modifiers}\u0000!` : modifiers, family: classify(base).family };
    if (parseCache.size >= MAX_PARSE_CACHE) {
        const oldest = parseCache.keys().next();
        if (!oldest.done) parseCache.delete(oldest.value);
    }
    parseCache.set(raw, parsed);
    return parsed;
};

const BOX_REMOVALS: Record<string, string[]> = {
    "p-all": ["p-all", "p-x", "p-y", "p-t", "p-r", "p-b", "p-l", "p-s", "p-e"],
    "p-x": ["p-x", "p-l", "p-r", "p-s", "p-e"],
    "p-y": ["p-y", "p-t", "p-b"],
    "m-all": ["m-all", "m-x", "m-y", "m-t", "m-r", "m-b", "m-l", "m-s", "m-e"],
    "m-x": ["m-x", "m-l", "m-r", "m-s", "m-e"],
    "m-y": ["m-y", "m-t", "m-b"],
    gap: ["gap", "gap-x", "gap-y"],
    inset: ["inset", "inset-x", "inset-y", "top", "right", "bottom", "left"],
    "inset-x": ["inset-x", "left", "right"],
    "inset-y": ["inset-y", "top", "bottom"],
    size: ["size", "w", "h"],
    "border-w": ["border-w", "border-w-x", "border-w-y", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
    "border-w-x": ["border-w-x", "border-w-l", "border-w-r"],
    "border-w-y": ["border-w-y", "border-w-t", "border-w-b"],
    "rounded-all": ["rounded-all", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
    "rounded-t": ["rounded-t", "rounded-tl", "rounded-tr"],
    "rounded-r": ["rounded-r", "rounded-tr", "rounded-br"],
    "rounded-b": ["rounded-b", "rounded-br", "rounded-bl"],
    "rounded-l": ["rounded-l", "rounded-tl", "rounded-bl"],
    overflow: ["overflow", "overflow-x", "overflow-y"],
    "text-size": ["text-size", "leading"],
    flex: ["flex", "grow", "shrink", "basis"],
};

const REMOVALS = new Map<string, readonly string[]>(Object.entries(BOX_REMOVALS));

const addRemovals = (family: string, families: Set<string>): void => {
    const hit = REMOVALS.get(family);
    if (hit === undefined) {
        families.add(family);
        return;
    }
    for (const target of hit) families.add(target);
};

export function cn(...inputs: ClassValue[]): string {
    const tokens: string[] = [];
    for (const input of inputs) flatten(input, tokens);
    if (tokens.length < 2) return tokens.join(" ");

    const seen = new Map<string, Set<string>>();
    const kept: string[] = [];

    for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const token = tokens[i]!;
        const { modifiers, family } = parse(token);
        if (family === "") {
            kept.push(token);
            continue;
        }
        let families = seen.get(modifiers);
        if (families === undefined) {
            families = new Set();
            seen.set(modifiers, families);
        }
        if (families.has(family)) continue;
        kept.push(token);
        addRemovals(family, families);
    }

    return kept.reverse().join(" ");
}

const flatten = (input: ClassValue, out: string[]): void => {
    if (!input) return;
    if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) return;
        let start = 0;
        for (let i = 0; i <= trimmed.length; i += 1) {
            const c = i === trimmed.length ? " " : trimmed[i];
            if (c === " " || c === "\t" || c === "\n") {
                if (i > start) out.push(trimmed.slice(start, i));
                start = i + 1;
            }
        }
        return;
    }
    if (typeof input === "number") {
        out.push(String(input));
        return;
    }
    if (Array.isArray(input)) {
        for (const item of input) flatten(item, out);
        return;
    }
    if (typeof input === "object") {
        for (const key of Object.keys(input)) if (input[key]) out.push(key);
    }
};

export type VariantConfig = Record<string, Record<string, string>>;

export type VariantSelection<V extends VariantConfig> = {
    [K in keyof V]?: keyof V[K] | null | undefined;
};

export type VariantProps<T extends (...args: never[]) => unknown> = Omit<
    NonNullable<Parameters<T>[0]>,
    "class" | "className"
>;

export function cva<V extends VariantConfig>(
    base: string,
    config?: { variants?: V; defaultVariants?: VariantSelection<V> }
) {
    const variants = config?.variants;
    const defaults = config?.defaultVariants;

    return (props?: VariantSelection<V> & { class?: ClassValue; className?: ClassValue }): string => {
        const parts: string[] = [base];
        if (variants) {
            for (const name of Object.keys(variants) as Array<keyof V>) {
                const raw = props?.[name];
                const chosen = raw === null ? null : (raw ?? defaults?.[name]);
                if (chosen === null || chosen === undefined) continue;
                const value = variants[name][chosen as keyof (typeof variants)[typeof name]];
                if (value) parts.push(value);
            }
        }
        if (props?.class) parts.push(String(props.class));
        if (props?.className) parts.push(String(props.className));
        return parts.join(" ");
    };
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
    children?: React.ReactNode;
    asChild?: boolean;
    ref?: React.Ref<HTMLElement>;
};

const composeRefs = (a: unknown, b: unknown): React.Ref<HTMLElement> | undefined => {
    if (!a) return b as React.Ref<HTMLElement> | undefined;
    if (!b) return a as React.Ref<HTMLElement>;
    return (node: HTMLElement | null) => {
        for (const r of [a, b] as Array<React.Ref<HTMLElement>>) {
            if (typeof r === "function") r(node);
            else (r as React.MutableRefObject<HTMLElement | null>).current = node;
        }
    };
};

export function Slot({ children, ref: forwardedRef, ...slotProps }: SlotProps) {
    if (!React.isValidElement(children)) return null;
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props as Record<string, unknown>;
    const override: Record<string, unknown> = { ...childProps };

    for (const name in childProps) {
        const slotValue = slotProps[name as keyof typeof slotProps];
        const childValue = childProps[name];
        if (/^on[A-Z]/.test(name)) {
            if (slotValue && childValue) {
                override[name] = (...args: unknown[]) => {
                    const result = (childValue as (...a: unknown[]) => unknown)(...args);
                    (slotValue as (...a: unknown[]) => void)(...args);
                    return result;
                };
            } else if (slotValue) {
                override[name] = slotValue;
            }
        } else if (name === "style") {
            override[name] = { ...(slotValue as object), ...(childValue as object) };
        } else if (name === "className") {
            override[name] = cn(childValue as ClassValue, slotValue as ClassValue);
        }
    }

    const merged: Record<string, unknown> = { ...slotProps, ...override };
    if (child.type !== React.Fragment) merged.ref = composeRefs(forwardedRef, childProps.ref);
    return React.cloneElement(child, merged);
}
