import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
    animate,
    AnimatePresence,
    motion,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from "framer-motion";
import { useTranslation } from "react-i18next";
import {
    Atom,
    Brain,
    ChevronsRight,
    Cpu,
    Dumbbell,
    FolderKanban,
    Languages,
    PlayingCardsFan,
    ShieldCheck,
    Sparkles,
    Waves,
    Wrench,
    type LucideIcon,
} from "lucide-react";
import type { TFunction } from "i18next";

import type { Grade } from "@/types/aurion";
import { GRADE_SCALE, getGradeBadgeInfoFromCode, parseGradeValue } from "@/lib/utils/grades";
import { triggerHapticPattern } from "@/lib/utils/sfx";
import { Card } from "@/components/ui/card";
import { fadeInIndexed } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { hashSeed, mulberry32, CORNERS } from "../use-grade-reveal";

const MAX_CARDS_PER_PACK = 6;

type Phase = "pack" | "tearing" | "cards" | "summary";

const shuffle = <T,>(items: T[], random: () => number): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
        const swap = Math.floor(random() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
};

function useCardTilt(disabled: boolean) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = ref.current;
        if (disabled || !node) return;

        const apply = (px: number, py: number, strength: number) => {
            const fromCenter = Math.min(
                Math.sqrt((px - 50) ** 2 + (py - 50) ** 2) / 50,
                1
            );
            const bgX = 37 + (px / 100) * (63 - 37);
            const bgY = 33 + (py / 100) * (67 - 33);
            node.style.setProperty("--pointer-x", `${px}%`);
            node.style.setProperty("--pointer-y", `${py}%`);
            node.style.setProperty("--pointer-from-center", String(fromCenter));
            node.style.setProperty("--pointer-from-top", String(py / 100));
            node.style.setProperty("--pointer-from-left", String(px / 100));
            node.style.setProperty("--background-x", `${bgX}%`);
            node.style.setProperty("--background-y", `${bgY}%`);
            node.style.setProperty("--card-opacity", String(strength));
            node.style.transform = `rotateY(${(px - 50) / 3.5}deg) rotateX(${
                (50 - py) / 3.5
            }deg)`;
        };

        const reset = () => {
            node.style.setProperty("--pointer-x", "50%");
            node.style.setProperty("--pointer-y", "50%");
            node.style.setProperty("--pointer-from-center", "0");
            node.style.setProperty("--pointer-from-top", "0.5");
            node.style.setProperty("--pointer-from-left", "0.5");
            node.style.setProperty("--background-x", "50%");
            node.style.setProperty("--background-y", "50%");
            node.style.setProperty("--card-opacity", "0");
            node.style.transform = "rotateY(0deg) rotateX(0deg)";
        };

        const IDLE_STRENGTH = 0.8;
        let idling = false;
        let idleFrame = 0;
        const idleLoop = (now: number) => {
            const time = now / 1000;
            apply(
                50 + 28 * Math.sin(time * 0.9),
                50 + 22 * Math.sin(time * 1.4 + 1),
                IDLE_STRENGTH
            );
            idleFrame = requestAnimationFrame(idleLoop);
        };
        const stopIdle = () => {
            idling = false;
            cancelAnimationFrame(idleFrame);
        };

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            apply(35, 30, IDLE_STRENGTH);
        } else {
            idling = true;
            idleFrame = requestAnimationFrame(idleLoop);
        }

        const onMove = (event: PointerEvent) => {
            if (idling) stopIdle();
            const rect = node.getBoundingClientRect();
            const relX = (event.clientX - rect.left) / rect.width;
            const relY = (event.clientY - rect.top) / rect.height;
            const offX = Math.max(0, -relX, relX - 1);
            const offY = Math.max(0, -relY, relY - 1);
            const dist = Math.sqrt(offX * offX + offY * offY);
            const strength = 1 / (1 + dist * dist * 3);
            const px = 50 + (relX * 100 - 50) * strength;
            const py = 50 + (relY * 100 - 50) * strength;
            apply(px, py, strength);
        };

        const LIMIT_G = 16;
        const LIMIT_B = 18;
        let baseSet = false;
        let baseGamma = 0;
        let baseBeta = 0;
        let gotOrient = false;

        const onOrient = (event: DeviceOrientationEvent) => {
            if (event.gamma == null || event.beta == null) return;
            if (!gotOrient) {
                gotOrient = true;

                window.removeEventListener("pointermove", onMove);
            }
            if (!baseSet) {
                baseSet = true;
                baseGamma = event.gamma;
                baseBeta = event.beta;
                return;
            }
            const g = Math.max(
                -LIMIT_G,
                Math.min(LIMIT_G, event.gamma - baseGamma)
            );
            const b = Math.max(
                -LIMIT_B,
                Math.min(LIMIT_B, event.beta - baseBeta)
            );

            if (idling) {
                if (Math.abs(g) < 2 && Math.abs(b) < 2) return;
                stopIdle();
            }
            const px = 50 + (g / LIMIT_G) * 50;
            const py = 50 + (b / LIMIT_B) * 50;
            apply(px, py, 1);
        };

        const addPointer = () => window.addEventListener("pointermove", onMove);
        const removePointer = () =>
            window.removeEventListener("pointermove", onMove);
        const addGyro = () =>
            window.addEventListener("deviceorientation", onOrient, true);
        const removeGyro = () =>
            window.removeEventListener("deviceorientation", onOrient, true);

        const coarse = window.matchMedia("(pointer: coarse)").matches;
        const gyroSupported = "DeviceOrientationEvent" in window;
        const useGyro = coarse && gyroSupported;

        let fallbackTimer: number | undefined;
        let cleanedUp = false;

        if (useGyro) {
            addGyro();

            fallbackTimer = window.setTimeout(() => {
                if (!cleanedUp && !gotOrient) addPointer();
            }, 1200);
        } else {
            addPointer();
        }

        return () => {
            cleanedUp = true;
            window.clearTimeout(fallbackTimer);
            stopIdle();
            removePointer();
            removeGyro();
            reset();
        };
    }, [disabled]);

    return { ref };
}

function requestGyroPermission() {
    const DOE = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (DOE && typeof DOE.requestPermission === "function") {
        DOE.requestPermission().catch(() => {});
    }
}

const vibrate = (pattern: number | number[]) => triggerHapticPattern(pattern);

const STRIP = 13;
const TEAR_TEETH = 22;
const TEAR_DEPTH = 0.9;

const PACK_OUTLINE = (() => {
    const teeth = 28;
    const depth = 1.1;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let k = 0; k <= teeth; k++) {
        const x = (k / teeth) * 100;
        const y = k % 2 === 1 ? depth : 0;
        top.push(`${x}% ${y}%`);
        bottom.unshift(`${x}% ${100 - y}%`);
    }
    return `polygon(${[
        ...top,
        `100% ${STRIP - 1.3}%`,
        `96% ${STRIP}%`,
        `100% ${STRIP + 1.3}%`,
        ...bottom,
        `0% ${STRIP + 1.3}%`,
        `4% ${STRIP}%`,
        `0% ${STRIP - 1.3}%`,
    ].join(", ")})`;
})();

const tearGeometry = (progress: number, direction: number) => {
    const reach = progress * 100;
    const x = (u: number) => (direction > 0 ? u : 100 - u);
    const step = 100 / TEAR_TEETH;
    const jagged: string[] = [];
    for (let k = 0; k * step < reach; k++) {
        const y = STRIP + (k % 2 === 0 ? -TEAR_DEPTH : TEAR_DEPTH);
        jagged.push(`${x(k * step)}% ${y}%`);
    }
    jagged.push(`${x(reach)}% ${STRIP}%`);
    const near = x(0);
    const far = x(100);
    const tip = x(reach);

    return {
        body: `polygon(${[
            ...jagged,
            `${far}% ${STRIP}%`,
            `${far}% 100%`,
            `${near}% 100%`,
        ].join(", ")})`,

        attached: `polygon(${tip}% 0%, ${far}% 0%, ${far}% ${
            STRIP + 0.4
        }%, ${tip}% ${STRIP + 0.4}%)`,
        flap: `polygon(${[
            `${near}% 0%`,
            `${tip}% 0%`,
            ...[...jagged].reverse(),
        ].join(", ")})`,
        openingLeft: `${direction > 0 ? 0 : 100 - reach}%`,
        openingWidth: `${reach}%`,
    };
};

const STAR =
    "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

const PACK_STARS = [
    { left: 14, top: 14, size: 1.1, delay: 0 },
    { left: 78, top: 20, size: 0.8, delay: 0.7 },
    { left: 82, top: 72, size: 1.2, delay: 1.3 },
    { left: 18, top: 78, size: 0.7, delay: 1.9 },
];

const LOGO_SHADOW = [
    "0.07em 0 0 #2a75bb",
    "-0.07em 0 0 #2a75bb",
    "0 0.07em 0 #2a75bb",
    "0 -0.07em 0 #2a75bb",
    "0.05em 0.05em 0 #2a75bb",
    "-0.05em -0.05em 0 #2a75bb",
    "0.05em -0.05em 0 #2a75bb",
    "-0.05em 0.05em 0 #2a75bb",
    "0 0.16em 0 #1d3f72",
    "0 0.3em 0.4em rgba(0,0,0,0.55)",
].join(", ");

const CRIMP =
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 0.12em, rgba(0,0,0,0.22) 0.12em 0.3em), linear-gradient(180deg, #f4f4f5, #a1a1aa 55%, #52525b)";

function PackFace({
    accent,
    dark,
    count,
    stripOnly,
}: {
    accent: string;
    dark: string;
    count: number;
    stripOnly?: boolean;
}) {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();

    return (
        <div
            className="absolute inset-0 overflow-hidden"
            style={{
                clipPath: PACK_OUTLINE,
                WebkitClipPath: PACK_OUTLINE,
                background: `radial-gradient(ellipse at 25% 15%, ${accent}, transparent 55%), linear-gradient(160deg, ${accent} 0%, ${dark} 55%, #0b0b14 100%)`,
            }}
        >

            <span
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0 0.35em, transparent 0.35em 0.7em), linear-gradient(125deg, transparent 20%, rgba(252,211,77,0.16) 35%, rgba(103,232,249,0.16) 50%, rgba(192,132,252,0.16) 65%, transparent 80%)",
                }}
            />

            <span
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(90deg, rgba(0,0,0,0.4), transparent 12%, rgba(255,255,255,0.08) 50%, transparent 88%, rgba(0,0,0,0.4))",
                }}
            />

            <span
                className="absolute inset-x-0 top-0 h-[7%]"
                style={{
                    background: CRIMP,
                    boxShadow: "0 0.1em 0.3em rgba(0,0,0,0.45)",
                }}
            />
            <span className="absolute inset-x-0 top-[8%] text-center font-mono text-[0.8em] font-bold uppercase tracking-[0.3em] text-white/75">
                {t("gradesPage.booster.tearHere")}
            </span>
            <span
                className="absolute inset-x-[6%] border-t-[0.12em] border-dashed border-white/60"
                style={{ top: `${STRIP}%` }}
            />

            {!stripOnly && (
                <>

                    <div className="absolute inset-x-0 top-[16.5%] flex flex-col items-center gap-[0.2em]">
                        <span
                            className="whitespace-nowrap text-[1.7em] font-black italic leading-none text-[#ffcb05]"
                            style={{
                                textShadow: LOGO_SHADOW,
                                transform: "rotate(-4deg)",
                            }}
                        >
                            {t("gradesPage.booster.packName")}
                        </span>
                    </div>

                    <div
                        className="absolute inset-x-[8%] top-[29%] bottom-[27%] overflow-hidden rounded-[0.8em]"
                        style={{
                            background: `radial-gradient(circle at 50% 45%, #fff 0%, ${accent} 32%, ${dark} 78%)`,
                            boxShadow:
                                "inset 0 0 0 0.14em rgba(255,255,255,0.55), inset 0 0 1.4em rgba(0,0,0,0.55)",
                        }}
                    >
                        <motion.span
                            className="absolute left-1/2 top-1/2 aspect-square w-[220%]"
                            style={{
                                x: "-50%",
                                y: "-50%",
                                background:
                                    "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.2) 0deg 5deg, transparent 5deg 15deg)",
                            }}
                            animate={
                                reducedMotion ? undefined : { rotate: 360 }
                            }
                            transition={{
                                duration: 40,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        />
                        <span
                            className="absolute left-1/2 top-1/2 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-full"
                            style={{
                                background:
                                    "linear-gradient(180deg, #ef4444 0 46%, #09090b 46% 54%, #f8fafc 54%)",
                                boxShadow: `0 0 0 0.2em #09090b, 0 0 2.2em ${accent}, 0 0 4em #ffffff88, inset -0.5em -0.4em 0.8em rgba(0,0,0,0.35)`,
                            }}
                        >
                            <span className="absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_0.2em_#09090b]" />
                        </span>
                        {PACK_STARS.map((star, index) => (
                            <motion.span
                                key={index}
                                className="absolute bg-white"
                                style={{
                                    left: `${star.left}%`,
                                    top: `${star.top}%`,
                                    width: `${star.size}em`,
                                    height: `${star.size}em`,
                                    clipPath: STAR,
                                    WebkitClipPath: STAR,
                                }}
                                animate={
                                    reducedMotion
                                        ? undefined
                                        : {
                                              opacity: [0.2, 1, 0.2],
                                              scale: [0.6, 1, 0.6],
                                          }
                                }
                                transition={{
                                    duration: 2.4,
                                    delay: star.delay,
                                    repeat: Infinity,
                                }}
                            />
                        ))}
                    </div>

                    <div className="absolute inset-x-0 top-[74%] flex flex-col items-center gap-[0.5em]">
                        <span className="w-full border-y border-white/20 bg-black/45 py-[0.25em] text-center font-mono text-[0.95em] font-bold uppercase tracking-[0.25em] text-white">
                            {t("gradesPage.booster.setName")}
                        </span>
                        <span className="rounded-full bg-[#ffcb05] px-[0.8em] py-[0.1em] text-[1em] font-black uppercase tracking-wider text-zinc-950 shadow-[0_0.15em_0.4em_rgba(0,0,0,0.5)]">
                            {t("gradesPage.booster.remainingShort", { count })}
                        </span>
                    </div>

                    <span
                        className="absolute inset-x-0 bottom-0 h-[7%]"
                        style={{
                            background: CRIMP,
                            boxShadow: "0 -0.1em 0.3em rgba(0,0,0,0.45)",
                        }}
                    />
                </>
            )}

            <span className="poke-pack-sheen absolute inset-0" />

            <span
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(farthest-corner circle at var(--pointer-x, 50%) var(--pointer-y, 50%), rgba(255,255,255,0.4), rgba(255,255,255,0.08) 35%, transparent 60%)",
                    opacity: "var(--card-opacity, 0)",
                }}
            />
        </div>
    );
}

function BoosterPack({
    accent,
    dark,
    count,
    tearing,
    onOpen,
}: {
    accent: string;
    dark: string;
    count: number;
    tearing: boolean;
    onOpen: () => void;
}) {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();
    const width = Math.min(230, Math.round(window.innerWidth * 0.6));

    const progress = useMotionValue(0);
    const direction = useMotionValue(1);
    const [started, setStarted] = useState(false);

    const { ref: tiltRef } = useCardTilt(started || tearing);
    const directionLocked = useRef(false);
    const panned = useRef(false);
    const opened = useRef(false);
    const lastTick = useRef(0);

    const tear = useTransform([progress, direction], ([p, d]: number[]) =>
        tearGeometry(p, d)
    );
    const bodyClip = useTransform(tear, (geometry) => geometry.body);
    const attachedClip = useTransform(tear, (geometry) => geometry.attached);
    const flapClip = useTransform(tear, (geometry) => geometry.flap);
    const openingLeft = useTransform(tear, (geometry) => geometry.openingLeft);
    const openingWidth = useTransform(
        tear,
        (geometry) => geometry.openingWidth
    );
    const openingOpacity = useTransform(progress, [0, 0.05], [0, 1]);

    const flapRotate = useTransform(
        [progress, direction],
        ([p, d]: number[]) => d * p * 22
    );
    const flapOriginX = useTransform(
        [progress, direction],
        ([p, d]: number[]) => (d > 0 ? p : 1 - p)
    );
    const flapY = useTransform(progress, (p) => p * -6);

    const open = useCallback(() => {
        if (opened.current) return;
        opened.current = true;
        onOpen();
    }, [onOpen]);

    const tearBy = (amount: number) => {
        const current = progress.get();
        const next = Math.min(1, current + amount);
        if (next <= current) return;
        progress.set(next);

        const tick = Math.floor(next * 14);
        if (tick !== lastTick.current) {
            lastTick.current = tick;
            vibrate(6);
        }
        if (next >= 1) open();
    };

    const tearAll = async () => {
        if (opened.current) return;
        directionLocked.current = true;
        setStarted(true);
        if (reducedMotion) {
            progress.set(1);
            open();
            return;
        }
        await animate(progress, 1, {
            duration: 0.15 + 0.35 * (1 - progress.get()),
            ease: "easeIn",
        });
        open();
    };

    const flyDirection = direction.get();

    return (
        <motion.div
            className="relative"
            initial={{ scale: 0.85, opacity: 0, rotate: -3 }}
            animate={
                tearing
                    ? reducedMotion
                        ? { scale: 0.9, opacity: 0, rotate: 0 }
                        : {
                              scale: [1, 1.05, 1.08, 0.86],
                              opacity: [1, 1, 1, 0],
                              rotate: [0, -1.5, 1, -2],
                          }
                    : { scale: 1, opacity: 1, rotate: 0 }
            }
            transition={{
                duration: tearing ? 0.85 : 0.45,
                times: tearing && !reducedMotion ? [0, 0.3, 0.6, 1] : undefined,
                ease: "easeInOut",
            }}
        >

            <span
                className="pointer-events-none absolute inset-[-12%] rounded-full opacity-40 blur-3xl"
                style={{ background: accent }}
            />

            <div style={{ perspective: 1000 }}>
                <div
                    ref={tiltRef}
                    className="transition-transform duration-200 ease-out"
                >
                    <motion.button
                        type="button"
                        aria-label={t("gradesPage.booster.swipeToTear")}
                        className={`relative block touch-none select-none outline-none ${
                            started || tearing ? "" : "poke-pack-float"
                        }`}
                        style={{
                            width,
                            aspectRatio: "63 / 110",
                            fontSize: width / 20,
                        }}
                        disabled={tearing}
                        onPointerDown={() => {
                            panned.current = false;
                        }}
                        onClick={() => {

                            if (panned.current) return;
                            requestGyroPermission();
                            tearAll();
                        }}
                        onPanStart={() => {
                            panned.current = true;
                        }}
                        onPan={(_, info) => {
                            if (opened.current) return;
                            if (!directionLocked.current) {
                                if (Math.abs(info.offset.x) < 6) return;
                                directionLocked.current = true;
                                direction.set(Math.sign(info.offset.x));
                                setStarted(true);
                            }
                            tearBy(
                                (direction.get() * info.delta.x) /
                                    (width * 0.85)
                            );
                        }}
                        onPanEnd={() => {

                            requestGyroPermission();
                            if (!opened.current && progress.get() >= 0.8)
                                tearAll();
                        }}
                    >

                        <span className="absolute inset-y-0 -inset-x-10" />

                        <span className="pointer-events-none absolute inset-x-[8%] -bottom-[4%] h-[6%] rounded-full bg-black/60 blur-md" />

                        <motion.div
                            className="absolute inset-0"
                            style={{
                                clipPath: bodyClip,
                                WebkitClipPath: bodyClip,
                            }}
                        >
                            <PackFace
                                accent={accent}
                                dark={dark}
                                count={count}
                            />
                        </motion.div>

                        <motion.span
                            className="pointer-events-none absolute h-[3em] -translate-y-full"
                            style={{
                                top: `${STRIP}%`,
                                left: openingLeft,
                                width: openingWidth,
                                opacity: openingOpacity,
                                background: `linear-gradient(0deg, ${accent}cc, ${accent}33 50%, transparent)`,
                            }}
                        />

                        <motion.div
                            className="pointer-events-none absolute inset-0"
                            style={{
                                clipPath: attachedClip,
                                WebkitClipPath: attachedClip,
                            }}
                        >
                            <PackFace
                                accent={accent}
                                dark={dark}
                                count={count}
                                stripOnly
                            />
                        </motion.div>

                        <motion.div
                            className="pointer-events-none absolute inset-0"
                            animate={
                                tearing && !reducedMotion
                                    ? {
                                          x: flyDirection * 90,
                                          y: -240,
                                          rotate: flyDirection * 40,
                                          opacity: 0,
                                      }
                                    : undefined
                            }
                            transition={{ duration: 0.55, ease: "easeIn" }}
                        >
                            <motion.div
                                className="absolute inset-0"
                                style={{
                                    clipPath: flapClip,
                                    WebkitClipPath: flapClip,
                                    rotate: flapRotate,
                                    y: flapY,
                                    originX: flapOriginX,
                                    originY: STRIP / 100,
                                }}
                            >
                                <PackFace
                                    accent={accent}
                                    dark={dark}
                                    count={count}
                                    stripOnly
                                />
                            </motion.div>
                        </motion.div>

                        <motion.span
                            className="pointer-events-none absolute h-[2px] -translate-y-1/2 rounded-full bg-white"
                            style={{
                                top: `${STRIP}%`,
                                left: openingLeft,
                                width: openingWidth,
                                opacity: openingOpacity,
                                boxShadow: `0 0 8px 2px ${accent}`,
                            }}
                        />

                        {!started && !tearing && !reducedMotion && (
                            <motion.span
                                className="pointer-events-none absolute h-[0.5em] w-[3em] -translate-y-1/2 rounded-full"
                                style={{
                                    top: `${STRIP}%`,
                                    background:
                                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.9))",
                                    boxShadow: `0 0 10px 2px ${accent}`,
                                }}
                                initial={{ left: "2%", opacity: 0 }}
                                animate={{
                                    left: ["2%", "82%"],
                                    opacity: [0, 1, 1, 0],
                                }}
                                transition={{
                                    duration: 1.3,
                                    repeat: Infinity,
                                    repeatDelay: 0.6,
                                    ease: "easeInOut",
                                }}
                            />
                        )}

                        <motion.span
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full"
                            style={{
                                top: `${STRIP}%`,
                                width: "130%",
                                height: "14rem",
                                background: `radial-gradient(ellipse 50% 70% at 50% 100%, ${accent}cc, ${accent}55 35%, transparent 70%)`,
                                transformOrigin: "bottom center",
                            }}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={
                                tearing
                                    ? {
                                          scaleY: [0, 1, 1.15, 0.9],
                                          opacity: [0, 1, 0.7, 0],
                                      }
                                    : { scaleY: 0, opacity: 0 }
                            }
                            transition={{
                                duration: 0.85,
                                times: [0, 0.3, 0.55, 1],
                                ease: "easeOut",
                            }}
                        />
                    </motion.button>
                </div>
            </div>

            <motion.p
                className="absolute left-1/2 top-full mt-6 w-[85vw] max-w-sm -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-widest text-white/60"
                animate={{ opacity: started || tearing ? 0 : 1 }}
            >
                {t("gradesPage.booster.swipeToTear")}
            </motion.p>
        </motion.div>
    );
}

const STILL_HOLO = {
    "--pointer-x": "35%",
    "--pointer-y": "30%",
    "--pointer-from-center": "0.4",
    "--pointer-from-top": "0.3",
    "--pointer-from-left": "0.35",
    "--background-x": "46%",
    "--background-y": "43%",
    "--card-opacity": "0.8",
} as CSSProperties;

const stageWidth = () => Math.min(300, Math.round(window.innerWidth * 0.72));

const MAX_PILE = 4;

const pileOffset = (depth: number) => ({
    x: depth * 9,
    y: -depth * 7,
    rotate: depth * 2.5,
});

const CARD_EXIT = 0.25;

function CardPile({ remaining, first }: { remaining: number; first: number }) {
    const width = stageWidth();
    const shown = Math.min(remaining, MAX_PILE);

    return (
        <AnimatePresence>
            {Array.from({ length: shown }, (_, offset) => {
                const depth = offset + 1;
                return (
                    <motion.div
                        key={first + offset}
                        className="pointer-events-none absolute left-0 top-0"
                        style={{ zIndex: -depth }}
                        initial={{ opacity: 0, ...pileOffset(depth + 1) }}
                        animate={{
                            opacity: 1 - depth * 0.12,
                            ...pileOffset(depth),
                        }}

                        exit={{
                            opacity: 0,
                            transition: { duration: 0, delay: CARD_EXIT },
                        }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                    >
                        <CardBack width={width} />
                    </motion.div>
                );
            })}
        </AnimatePresence>
    );
}

function CardStage({
    card,
    faceUp,
    onTap,
}: {
    card: BoosterCard;
    faceUp: boolean;
    onTap: () => void;
}) {
    const reducedMotion = useReducedMotion();
    const { ref: tiltRef } = useCardTilt(!faceUp);
    const width = stageWidth();

    return (
        <div className="relative" style={{ perspective: 1200 }} onClick={onTap}>
            <div
                ref={tiltRef}
                className="transition-transform duration-200 ease-out"
                style={{ transformStyle: "preserve-3d" }}
            >
                <motion.div
                    className="relative"
                    style={{ transformStyle: "preserve-3d", width }}
                    initial={{ rotateY: 180 }}
                    animate={{
                        rotateY: faceUp ? 0 : 180,

                        scale:
                            faceUp && !reducedMotion
                                ? [1, 1 + 0.025 * (tierOf(card) + 1), 1]
                                : 1,
                    }}
                    transition={{
                        rotateY: {
                            duration: reducedMotion ? 0 : 0.65,
                            ease: [0.2, 0.8, 0.2, 1],
                        },
                        scale: { duration: 0.6, times: [0, 0.35, 1] },
                    }}
                >
                    <div
                        style={{
                            backfaceVisibility: "hidden",
                            opacity: faceUp ? 1 : 0,
                            pointerEvents: faceUp ? "auto" : "none",
                        }}
                    >
                        <PokemonCard card={card} width={width} />
                    </div>
                    <div
                        className="absolute inset-0"
                        style={{
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                            opacity: faceUp ? 0 : 1,
                            pointerEvents: faceUp ? "none" : "auto",
                        }}
                    >
                        <CardBack width={width} />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

const WAITING_GLOW =
    "conic-gradient(from 0deg, #fcd34d, #67e8f9, #c084fc, #fcd34d)";

function WaitingGlow() {
    return (

        <motion.span
            className="pointer-events-none absolute inset-[-10%]"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <motion.span
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: WAITING_GLOW }}
                animate={{
                    opacity: [0.3, 0.6, 0.3],
                    rotate: 360,
                    scale: [1, 1.06, 1],
                }}
                transition={{
                    opacity: { duration: 2, repeat: Infinity },
                    scale: { duration: 2, repeat: Infinity },
                    rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                }}
            />
        </motion.span>
    );
}

const EMBER_COLORS = ["#fcd34d", "#67e8f9", "#c084fc"];

function WaitingEmbers() {
    const embers = useMemo(() => {
        const random = mulberry32(hashSeed("booster-embers"));
        return Array.from({ length: 16 }, (_, index) => ({
            left: -8 + random() * 116,
            top: 55 + random() * 50,
            rise: 120 + random() * 160,
            drift: (random() - 0.5) * 40,
            size: 2 + random() * 4,
            duration: 1.8 + random() * 1.6,
            delay: random() * 2.5,
            color: EMBER_COLORS[index % EMBER_COLORS.length],
        }));
    }, []);

    return (
        <motion.div
            className="pointer-events-none absolute inset-0"
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
            {embers.map((ember, index) => (
                <motion.span
                    key={index}
                    className="absolute rounded-full bg-white"
                    style={{
                        left: `${ember.left}%`,
                        top: `${ember.top}%`,
                        width: ember.size,
                        height: ember.size,
                        boxShadow: `0 0 6px 2px ${ember.color}`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{
                        y: [0, -ember.rise],
                        x: [0, ember.drift],
                        opacity: [0, 1, 0.8, 0],
                        scale: [0.4, 1, 0.6],
                    }}
                    transition={{
                        duration: ember.duration,
                        delay: ember.delay,
                        repeat: Infinity,
                        ease: "easeOut",
                    }}
                />
            ))}
        </motion.div>
    );
}

const tierOf = (card: BoosterCard): number =>
    CARD_TREATMENTS.indexOf(card.treatment);

const RAINBOW = ["#f87171", "#fbbf24", "#4ade80", "#38bdf8", "#c084fc"];

function RevealBurst({ card }: { card: BoosterCard }) {
    const tier = tierOf(card);
    const accent = card.subject.accent;
    const rainbow = card.treatment === "sir";

    const sparks = useMemo(() => {
        const random = mulberry32(hashSeed(card.seed, tier, "reveal-burst"));
        const count = 6 + tier * 4;
        return Array.from({ length: count }, (_, index) => ({
            angle: (index / count) * Math.PI * 2 + random() * 0.5,
            distance: 110 + tier * 22 + random() * 60,
            size: 3 + random() * (3 + tier),
            delay: 0.12 + random() * 0.15,
            color: rainbow ? RAINBOW[index % RAINBOW.length] : accent,
        }));
    }, [tier, accent, rainbow, card.seed]);

    return (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

            <motion.span
                className="absolute inset-0 rounded-[1.2rem]"
                style={{
                    border: `${2 + tier}px solid ${accent}`,
                    boxShadow: `0 0 ${12 + tier * 6}px ${accent}, inset 0 0 ${
                        12 + tier * 6
                    }px ${accent}`,
                }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1.25 + tier * 0.08, opacity: [0, 1, 0] }}
                transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            />

            {sparks.map((spark, index) => (
                <motion.span
                    key={index}
                    className="absolute rounded-full bg-white"
                    style={{
                        width: spark.size,
                        height: spark.size,
                        boxShadow: `0 0 8px 2px ${spark.color}`,
                    }}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                    animate={{
                        x: Math.cos(spark.angle) * spark.distance,
                        y: Math.sin(spark.angle) * spark.distance,
                        opacity: [0, 1, 1, 0],
                        scale: [0.3, 1, 0.8, 0],
                    }}
                    transition={{
                        duration: 0.8 + tier * 0.05,
                        times: [0, 0.2, 0.6, 1],
                        delay: spark.delay,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
}

function RevealRays({ card }: { card: BoosterCard }) {
    const tier = tierOf(card);
    const colors = card.treatment === "sir" ? RAINBOW : [card.subject.accent];
    const rays = colors
        .map((color) => `${color}aa 0deg 8deg, transparent 8deg 24deg`)
        .join(", ");
    const mask = "radial-gradient(circle, black 15%, transparent 60%)";

    return (
        <motion.span
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[260%] rounded-full"
            style={{
                x: "-50%",
                y: "-50%",
                background: `repeating-conic-gradient(from 0deg, ${rays})`,
                maskImage: mask,
                WebkitMaskImage: mask,
            }}
            initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{
                opacity: [0, 0.5 + tier * 0.08, 0.35],
                rotate: 90,
                scale: 1,
            }}
            transition={{
                opacity: { duration: 0.9, delay: 0.1, times: [0, 0.3, 1] },
                scale: { duration: 0.6, delay: 0.1, ease: "easeOut" },
                rotate: { duration: 12, ease: "linear" },
            }}
        />
    );
}

function Booster({
    unopened,
    onClose,
}: {
    unopened: Grade[];
    onClose: (opened: Grade[]) => void;
}) {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();
    const [phase, setPhase] = useState<Phase>("pack");
    const [index, setIndex] = useState(0);
    const [faceUp, setFaceUp] = useState(false);
    const tearTimeout = useRef<number>(undefined);

    useEffect(() => () => window.clearTimeout(tearTimeout.current), []);

    const tearPack = () => {
        setPhase("tearing");
        vibrate([8, 30, 16]);
        tearTimeout.current = window.setTimeout(
            () => setPhase("cards"),
            reducedMotion ? 0 : 850
        );
    };

    const [packSeed] = useState(() =>
        hashSeed("booster-pack", unopened.length, unopened[0]?.date ?? "", unopened[0]?.code ?? "")
    );

    const deck = useMemo<BoosterCard[]>(() => {
        if (unopened.length === 0) return [];

        const random = mulberry32(packSeed);
        const pulls = Math.min(MAX_CARDS_PER_PACK, unopened.length);
        const chase = shuffle(unopened, random).slice(0, pulls);

        return chase.map((grade) => buildBoosterCard(grade, true));
    }, [unopened, packSeed]);

    const newCards = useMemo(() => deck.filter((card) => card.isNew), [deck]);
    const card = deck[index];

    const close = useCallback(
        () => onClose(newCards.map((entry) => entry.grade)),
        [newCards, onClose]
    );

    useEffect(() => {
        if (deck.length === 0) close();
    }, [deck.length, close]);

    const tapCard = () => {
        if (!faceUp) {
            setFaceUp(true);
            if (
                card &&
                typeof navigator !== "undefined" &&
                "vibrate" in navigator
            ) {
                const tier = tierOf(card);
                triggerHapticPattern(
                    tier >= 4 ? [12, 40, 24, 40, 60] : [12, 40, 12 + tier * 6]
                );
            }
            return;
        }

        if (index + 1 >= deck.length) {
            setPhase("summary");
            return;
        }
        setIndex(index + 1);
        setFaceUp(false);
    };

    return (
        <motion.div
            className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden px-6"
            style={{
                paddingTop: "var(--safe-area-top)",
                paddingBottom: "var(--safe-area-bottom)",
                backgroundColor: "#07070c",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
        >
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        "repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.03) 0deg 3deg, transparent 3deg 14deg), radial-gradient(ellipse at 50% 40%, #1b1030 0%, #07070c 70%)",
                }}
            />

            {(phase === "pack" || phase === "tearing") && (
                <BoosterPack
                    accent={newCards[0]?.subject.accent ?? "#6366f1"}
                    dark={newCards[0]?.subject.dark ?? "#312e81"}
                    count={deck.length}
                    tearing={phase === "tearing"}
                    onOpen={tearPack}
                />
            )}

            <AnimatePresence>
                {phase === "tearing" && !reducedMotion && (
                    <motion.span
                        key="flash"
                        className="pointer-events-none absolute inset-0 bg-white"
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: [0, 0, 0.75, 0.35, 0],
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 0.85,
                            times: [0, 0.3, 0.5, 0.7, 1],
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === "cards" &&
                    faceUp &&
                    card &&
                    isFullArt(card.treatment) &&
                    !reducedMotion && (
                        <motion.span
                            key={`full-art-flash-${index}`}
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: `radial-gradient(circle at 50% 45%, #fff 0%, ${card.subject.accent} 40%, transparent 75%)`,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{
                                opacity: [
                                    0,
                                    card.treatment === "sir" ? 0.85 : 0.6,
                                    0,
                                ],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.7,
                                delay: 0.1,
                                times: [0, 0.25, 1],
                            }}
                        />
                    )}
            </AnimatePresence>

            {phase === "cards" && card && (
                <div className="relative flex w-full flex-col items-center gap-4">
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
                        {t("gradesPage.booster.counter", {
                            current: index + 1,
                            total: deck.length,
                        })}
                    </p>

                    <div
                        className="relative isolate"
                        style={{ width: stageWidth(), aspectRatio: "63 / 88" }}
                    >
                        <CardPile
                            remaining={deck.length - index - 1}
                            first={index + 1}
                        />

                        {faceUp && tierOf(card) >= 3 && !reducedMotion && (
                            <RevealRays key={`rays-${index}`} card={card} />
                        )}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={index}

                                initial={pileOffset(1)}
                                animate={{ x: 0, y: 0, rotate: 0 }}
                                exit={{
                                    opacity: 0,
                                    x: -120,
                                    rotate: -8,
                                    transition: { duration: CARD_EXIT },
                                }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                                className="relative"
                            >

                                <AnimatePresence>
                                    {!faceUp && !reducedMotion && (
                                        <WaitingGlow key="glow" />
                                    )}
                                </AnimatePresence>
                                <CardStage
                                    card={card}
                                    faceUp={faceUp}
                                    onTap={tapCard}
                                />
                                <AnimatePresence>
                                    {!faceUp && !reducedMotion && (
                                        <WaitingEmbers key="embers" />
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </AnimatePresence>

                        {faceUp && !reducedMotion && (
                            <RevealBurst key={`burst-${index}`} card={card} />
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${index}-${faceUp}`}
                            className="flex min-h-[3rem] flex-col items-center justify-center gap-1"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.25,
                                delay: faceUp ? 0.4 : 0,
                            }}
                        >
                            {faceUp ? (
                                <>
                                    <span
                                        className="rounded-sm px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.2em]"
                                        style={{
                                            backgroundColor: card.isNew
                                                ? `${card.subject.accent}33`
                                                : "rgba(255,255,255,0.08)",
                                            color: card.isNew
                                                ? "#fff"
                                                : "rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        {card.isNew
                                            ? t(
                                                  `gradesPage.booster.treatments.${card.treatment}`
                                              )
                                            : t("gradesPage.booster.duplicate")}
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                                        {t("gradesPage.booster.tapToNext")}
                                    </span>
                                </>
                            ) : (
                                <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">
                                    {t("gradesPage.booster.tapToFlip")}
                                </span>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {phase === "summary" && (
                <motion.div
                    className="relative flex w-full max-w-lg flex-col items-center gap-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                >
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">
                        {t("gradesPage.booster.summaryTitle")}
                    </p>
                    <div className="grid grid-cols-[repeat(2,8rem)] items-start justify-center gap-x-6 gap-y-4 sm:grid-cols-[repeat(3,8rem)]">
                        {newCards.map((entry, position) => (
                            <motion.div
                                key={position}
                                className="flex w-32 flex-col items-center gap-2 justify-self-center last:odd:col-span-2 sm:last:odd:col-span-1"
                                initial={{ opacity: 0, y: 20, rotate: -4 }}
                                animate={{ opacity: 1, y: 0, rotate: 0 }}
                                transition={{
                                    duration: 0.35,
                                    delay: position * 0.12,
                                }}
                            >
                                <div style={STILL_HOLO}>
                                    <PokemonCard card={entry} width={128} />
                                </div>
                                <span
                                    className="w-full truncate text-center font-mono text-[10px] uppercase leading-tight tracking-widest"
                                    style={{
                                        color: isFullArt(entry.treatment)
                                            ? entry.subject.accent
                                            : "rgba(255,255,255,0.55)",
                                    }}
                                >
                                    {cardTitle(entry, t)}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                    <Button
                        className="rounded-sm bg-amber-400 px-6 font-bold uppercase tracking-wider text-zinc-950 hover:bg-amber-300"
                        onClick={close}
                    >
                        {t("gradesPage.caseOpening.continue")}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
}

export function BoosterOverlay({
    open,
    unopened,
    onClose,
}: {
    open: boolean;
    unopened: Grade[];
    onClose: (opened: Grade[]) => void;
}) {
    return createPortal(
        <AnimatePresence>
            {open && (
                <Booster key="booster" unopened={unopened} onClose={onClose} />
            )}
        </AnimatePresence>,
        document.body
    );
}

const CARD_TREATMENTS = ["common", "uncommon", "holo", "ex", "ar", "sir"] as const;

type CardTreatment = (typeof CARD_TREATMENTS)[number];

const UNKNOWN_SUBJECT = "gradesPage.booster.unknownSubject";

const cardTitle = (card: BoosterCard, t: TFunction): string =>
    card.subjectLabelKey === UNKNOWN_SUBJECT ? card.grade.name : t(card.subjectLabelKey);

const isFullArt = (treatment: CardTreatment): boolean =>
    treatment === "ar" || treatment === "sir";

type SubjectCard = {
    id: string;
    icon: LucideIcon;
    typeKey: string;
    weaknessKey: string;
    resistanceKey: string;

    accent: string;
    light: string;
    dark: string;
};

const TYPE = "gradesPage.booster.types";

const subjectCard = (
    id: string,
    icon: LucideIcon,
    type: string,
    weakness: string,
    resistance: string,
    accent: string,
    light: string,
    dark: string
): SubjectCard => ({
    id,
    icon,
    typeKey: `${TYPE}.${type}`,
    weaknessKey: `${TYPE}.${weakness}`,
    resistanceKey: `${TYPE}.${resistance}`,
    accent,
    light,
    dark,
});

const FALLBACK_SUBJECT: SubjectCard = subjectCard("unknown", Sparkles, "colorless", "fighting", "psychic", "#9ca3af", "#e5e7eb", "#4b5563");

const SUBJECT_CARDS: Record<string, SubjectCard> = Object.fromEntries(
    [
        subjectCard("maths", Brain, "psychic", "darkness", "fighting", "#a855f7", "#e9d5ff", "#6b21a8"),
        subjectCard("physics", Atom, "lightning", "fighting", "metal", "#f59e0b", "#fde68a", "#b45309"),
        subjectCard("computerScience", Cpu, "metal", "fire", "grass", "#06b6d4", "#a5f3fc", "#0e7490"),
        subjectCard("english", Waves, "water", "lightning", "metal", "#3b82f6", "#bfdbfe", "#1d4ed8"),
        subjectCard("sii", Wrench, "fighting", "psychic", "darkness", "#ea580c", "#fed7aa", "#9a3412"),
        subjectCard("fhs", Sparkles, "fairy", "metal", "darkness", "#ec4899", "#fbcfe8", "#9d174d"),
        subjectCard("eps", Dumbbell, "grass", "fire", "water", "#22c55e", "#bbf7d0", "#15803d"),
        subjectCard("lv2", Languages, "dragon", "dragon", "fairy", "#6366f1", "#c7d2fe", "#3730a3"),
        subjectCard("tipe", FolderKanban, "colorless", "fighting", "psychic", "#64748b", "#e2e8f0", "#334155"),
        subjectCard("pix", ShieldCheck, "darkness", "grass", "psychic", "#71717a", "#d4d4d8", "#27272a"),
    ].map((card) => [card.id, card])
);

type BoosterAttack = {
    nameKey: string;
    cost: number;
    damage: number;
};

type BoosterCard = {
    grade: Grade;
    isNew: boolean;
    treatment: CardTreatment;
    subject: SubjectCard;
    subjectLabelKey: string;
    value: number | null;
    hp: number;
    attacks: BoosterAttack[];
    retreat: number;
    number: string;
    seed: number;
};

const ATTACK_POOL_SIZE = 6;

const gradeSeed = (grade: Grade): number => hashSeed(grade.date, grade.code, grade.name);

const subjectIdFromLabelKey = (labelKey: string | null | undefined): string =>
    labelKey?.split(".").pop() ?? "unknown";

const TREATMENT_TIERS: { min: number; treatment: CardTreatment }[] = [
    { min: 0, treatment: "common" },
    { min: 10, treatment: "uncommon" },
    { min: 12, treatment: "holo" },
    { min: 14, treatment: "ex" },
    { min: 16, treatment: "ar" },
    { min: 18, treatment: "sir" },
];

const getTreatmentForGrade = (value: number | null, isNew: boolean): CardTreatment => {
    const grade = value ?? 0;
    if (!isNew) return grade >= 14 ? "uncommon" : "common";
    let treatment: CardTreatment = "common";
    for (const tier of TREATMENT_TIERS) if (grade >= tier.min) treatment = tier.treatment;
    return treatment;
};

function buildBoosterCard(grade: Grade, isNew: boolean): BoosterCard {
    const seed = gradeSeed(grade);
    const value = parseGradeValue(grade.grade);
    const labelKey = grade.code?.trim() ? getGradeBadgeInfoFromCode(grade.code)?.labelKey || null : null;
    const subjectId = subjectIdFromLabelKey(labelKey);
    const subject = SUBJECT_CARDS[subjectId] ?? FALLBACK_SUBJECT;
    const coefficient = Number.parseFloat((grade.coefficient || "1").replace(",", "."));
    const safeCoefficient = Number.isNaN(coefficient) ? 1 : coefficient;
    const random = mulberry32(seed ^ 0x9e3779b9);
    const pick = () => Math.floor(random() * ATTACK_POOL_SIZE);

    return {
        grade,
        isNew,
        treatment: getTreatmentForGrade(value, isNew),
        subject,
        subjectLabelKey: labelKey ?? UNKNOWN_SUBJECT,
        value,
        hp: Math.max(30, Math.round(value ?? 3) * 10),
        attacks: [
            {
                nameKey: `gradesPage.booster.subjects.${subject.id}.light.${pick()}`,
                cost: 1,
                damage: Math.max(10, Math.round(((value ?? 0) * 2) / 5) * 5),
            },
            {
                nameKey: `gradesPage.booster.subjects.${subject.id}.heavy.${pick()}`,
                cost: safeCoefficient >= 5 ? 3 : 2,
                damage: Math.max(20, Math.round((value ?? 0) / 2) * 10),
            },
        ],
        retreat: Math.min(3, Math.max(1, Math.round(safeCoefficient / 3))),
        number: `${String((seed % 250) + 1).padStart(3, "0")}/250`,
        seed,
    };
}

const RARITY_SYMBOL: Record<CardTreatment, string> = {
    common: "●",
    uncommon: "◆",
    holo: "★",
    ex: "★",
    ar: "★★",
    sir: "★★★",
};

const EnergyDot = ({ color }: { color: string }) => (
    <span
        className="inline-block size-[0.75em] rounded-full"
        style={{
            background: `radial-gradient(circle at 34% 30%, #ffffff, ${color} 62%, rgba(0,0,0,0.35))`,
            boxShadow: "inset 0 0 0 0.05em rgba(0,0,0,0.35)",
        }}
    />
);

function CardArt({ card, full }: { card: BoosterCard; full?: boolean }) {
    const Icon = card.subject.icon;
    const random = mulberry32(card.seed);
    const blobs = Array.from({ length: 5 }, () => ({
        x: random() * 100,
        y: random() * 100,
        size: 20 + random() * 45,
    }));

    return (
        <div
            className="absolute inset-0 overflow-hidden"
            style={{
                background: `radial-gradient(circle at 50% 22%, ${card.subject.light}, ${card.subject.accent} 45%, ${card.subject.dark} 100%)`,
            }}
        >
            {blobs.map((blob, index) => (
                <span
                    key={index}
                    className="absolute rounded-full opacity-30 blur-[0.4em]"
                    style={{
                        left: `${blob.x}%`,
                        top: `${blob.y}%`,
                        width: `${blob.size}%`,
                        height: `${blob.size}%`,
                        background:
                            index % 2 === 0
                                ? card.subject.light
                                : card.subject.dark,
                    }}
                />
            ))}

            <span
                className="absolute inset-0 opacity-25"
                style={{
                    backgroundImage:
                        "repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,0.7) 0deg 2deg, transparent 2deg 12deg)",
                }}
            />

            <Icon
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25"
                style={{ width: full ? "62%" : "58%", height: "auto" }}
            />

            <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[0.5em]"
                style={{
                    width: full ? "70%" : "78%",
                    height: full ? "50%" : "62%",
                    background: `radial-gradient(ellipse, rgba(0,0,0,0.45), transparent 70%)`,
                }}
            />
            <span className="absolute inset-0 flex items-center justify-center">
                <span
                    className="flex items-baseline font-black leading-none text-white"
                    style={{
                        textShadow: "0 0.04em 0.08em rgba(0,0,0,0.85)",
                        WebkitTextStroke: "0.03em rgba(0,0,0,0.4)",
                    }}
                >
                    <span style={{ fontSize: full ? "4.6em" : "3.1em" }}>
                        {card.grade.grade}
                    </span>
                    <span
                        className="opacity-80"
                        style={{ fontSize: full ? "1.5em" : "1em" }}
                    >
                        {`/${GRADE_SCALE}`}
                    </span>
                </span>
            </span>
        </div>
    );
}

function AttackRow({
    card,
    attack,
}: {
    card: BoosterCard;
    attack: BoosterCard["attacks"][number];
}) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center gap-[0.35em]">
            <span className="flex shrink-0 gap-[0.1em]">
                {Array.from({ length: attack.cost }, (_, index) => (
                    <EnergyDot key={index} color={card.subject.accent} />
                ))}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">
                {t(attack.nameKey)}
            </span>
            <span className="shrink-0 font-black">{attack.damage}</span>
        </div>
    );
}

function PokemonCard({
    card,
    width,
}: {
    card: BoosterCard;
    width: number;
}) {
    const { t } = useTranslation();
    const full = isFullArt(card.treatment);
    const gold = card.treatment === "sir";
    const isEx = card.treatment === "ex";
    const name = cardTitle(card, t);

    const frame = gold
        ? "linear-gradient(150deg, #fde68a, #d4a017 35%, #fff3c4 55%, #b8860b 80%)"
        : isEx
          ? "linear-gradient(150deg, #f3e2a9, #cfa640 45%, #f7edc4)"
          : "linear-gradient(150deg, #f7e07a, #e8c33c 45%, #f9ecae)";

    return (
        <div
            className={`poke-card relative overflow-hidden rounded-[0.9em] ${
                card.treatment === "common" ? "" : "poke-holo-host"
            }`}
            style={{
                width,
                aspectRatio: "63 / 88",
                fontSize: width / 20,
                background: frame,
                boxShadow:
                    "0 0.5em 1.4em rgba(0,0,0,0.45), inset 0 0 0 0.06em rgba(0,0,0,0.35)",
            }}
        >
            {full && <CardArt card={card} full />}

            <div
                className="absolute inset-[0.42em] flex flex-col overflow-hidden rounded-[0.55em]"
                style={
                    full
                        ? { background: "transparent" }
                        : {
                              background: `linear-gradient(165deg, ${card.subject.light}, ${card.subject.accent})`,
                              boxShadow: "inset 0 0 0 0.05em rgba(0,0,0,0.25)",
                          }
                }
            >

                <div
                    className={`flex items-center gap-[0.3em] px-[0.4em] py-[0.25em] ${
                        full ? "rounded-[0.3em] bg-black/50" : ""
                    }`}
                    style={full ? { margin: "0.3em" } : undefined}
                >
                    <div className="min-w-0 flex-1">
                        <p
                            className={`truncate text-[0.62em] font-bold uppercase tracking-wider ${
                                full ? "text-white/70" : "text-black/60"
                            }`}
                        >
                            {t("gradesPage.booster.stage")}
                        </p>
                        <p
                            className={`flex items-baseline gap-[0.2em] truncate text-[1.05em] font-black leading-tight ${
                                full ? "text-white" : "text-zinc-900"
                            }`}
                        >
                            <span className="min-w-0 truncate">{name}</span>
                            {isEx && (
                                <span className="shrink-0 text-[0.85em] font-black italic text-amber-700">
                                    {t("gradesPage.booster.ex")}
                                </span>
                            )}
                        </p>
                    </div>
                    <span
                        className={`shrink-0 font-black leading-none ${
                            full ? "text-white" : "text-zinc-900"
                        }`}
                    >
                        <span className="text-[0.6em] align-top">
                            {t("gradesPage.booster.hp")}
                        </span>
                        <span className="text-[1.15em]">{card.hp}</span>
                    </span>
                    <EnergyDot color={card.subject.accent} />
                </div>

                {!full && (
                    <>
                        <div
                            className="relative mx-[0.3em] overflow-hidden rounded-[0.15em]"
                            style={{
                                aspectRatio: "4 / 3",
                                boxShadow:
                                    "0 0 0 0.09em #d4b13c, 0 0 0 0.14em rgba(0,0,0,0.35)",
                            }}
                        >
                            <CardArt card={card} />
                        </div>
                        <p className="mx-[0.3em] mt-[0.25em] truncate rounded-[0.1em] bg-black/25 px-[0.3em] py-[0.1em] text-[0.58em] font-medium text-white">
                            {t("gradesPage.booster.speciesLine", {
                                species: t(
                                    `gradesPage.booster.subjects.${card.subject.id}.species`
                                ),
                                evaluation: card.grade.name,
                            })}
                        </p>
                    </>
                )}

                <div
                    className={`mx-[0.3em] mt-[0.3em] flex flex-col gap-[0.3em] rounded-[0.2em] px-[0.35em] py-[0.3em] text-[0.72em] ${
                        full
                            ? "bg-black/60 text-white"
                            : "flex-1 justify-center bg-[#f7f1e0] text-zinc-900"
                    }`}
                    style={full ? { margin: "auto 0.3em 0.3em" } : undefined}
                >
                    {card.attacks.map((attack, index) => (
                        <AttackRow key={index} card={card} attack={attack} />
                    ))}

                    <div
                        className={`mt-[0.15em] flex items-center justify-between gap-[0.3em] border-t pt-[0.2em] text-[0.72em] ${
                            full ? "border-white/25" : "border-black/20"
                        }`}
                    >
                        <span className="truncate">
                            {t("gradesPage.booster.weakness")}{" "}
                            <span className="font-bold">
                                {t("gradesPage.booster.weaknessValue", {
                                    type: t(card.subject.weaknessKey),
                                })}
                            </span>
                        </span>
                        <span className="truncate">
                            {t("gradesPage.booster.resistance")}{" "}
                            <span className="font-bold">
                                {t("gradesPage.booster.resistanceValue", {
                                    type: t(card.subject.resistanceKey),
                                })}
                            </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-[0.15em]">
                            {t("gradesPage.booster.retreat")}
                            {Array.from(
                                { length: card.retreat },
                                (_, index) => (
                                    <EnergyDot key={index} color="#d4d4d8" />
                                )
                            )}
                        </span>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-[0.3em] px-[0.45em] pb-[0.25em] pt-[0.2em] text-[0.5em] ${
                        full ? "text-white/80" : "text-black/70"
                    }`}
                >
                    <span className="truncate italic">
                        {t("gradesPage.booster.illustrator")}
                    </span>
                    <span className="shrink-0 font-mono font-bold tracking-tight">
                        {card.number} {RARITY_SYMBOL[card.treatment]}
                    </span>
                </div>
            </div>

            {card.treatment !== "common" && (
                <>
                    <span
                        className={`poke-shine pointer-events-none absolute inset-0 rounded-[0.9em] ${
                            gold ? "poke-shine-gold" : ""
                        }`}
                        style={{
                            opacity:
                                card.treatment === "uncommon"
                                    ? 0.25
                                    : card.treatment === "holo"
                                      ? 0.5
                                      : 0.75,
                        }}
                    />
                    <span className="poke-glare pointer-events-none absolute inset-0 rounded-[0.9em]" />
                </>
            )}
        </div>
    );
}

function CardBack({ width }: { width: number }) {
    const { t } = useTranslation();

    return (
        <div
            className="relative"
            style={
                {
                    width,
                    fontSize: width / 20,
                } as CSSProperties
            }
        >
            <div
                className="relative overflow-hidden rounded-[0.9em]"
                style={{
                    aspectRatio: "63 / 88",
                    background:
                        "linear-gradient(160deg, #1e3a8a 0%, #172554 45%, #0f172a 100%)",
                    boxShadow:
                        "0 0.5em 1.4em rgba(0,0,0,0.5), inset 0 0 0 0.06em rgba(255,255,255,0.15)",
                }}
            >
                <span
                    className="absolute inset-[0.4em] rounded-[0.6em]"
                    style={{
                        background:
                            "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 0.3em, transparent 0.3em 0.6em)",
                        boxShadow: "inset 0 0 0 0.08em rgba(250,204,21,0.55)",
                    }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.4em]">
                    <span
                        className="relative flex size-[4.2em] items-center justify-center rounded-full"
                        style={{
                            background:
                                "conic-gradient(from 210deg, #f8fafc 0deg 180deg, #ef4444 180deg 360deg)",
                            boxShadow:
                                "0 0 0 0.18em #0f172a, 0 0.2em 0.6em rgba(0,0,0,0.6)",
                        }}
                    >
                        <span className="size-[1.5em] rounded-full bg-white shadow-[0_0_0_0.16em_#0f172a]" />
                    </span>
                    <span className="text-[0.9em] font-black uppercase tracking-[0.35em] text-amber-300">
                        {t("gradesPage.booster.cardBack")}
                    </span>
                </div>
            </div>
        </div>
    );
}

const MotionCard = motion.create(Card);

const POKE_CORNER = "border-amber-200/70";
const POKE_CORNER_EMPTY = "border-zinc-600/70";
const POKE_ICON = "text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.9)]";
const POKE_CTA =
    "bg-gradient-to-b from-amber-200 to-amber-400 text-indigo-950 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_2px_6px_rgba(0,0,0,0.45)]";
const POKE_DATE =
    "bg-black/40 text-amber-100 shadow-[0_0_0_1px_rgba(252,211,77,0.25)_inset]";

export function BoosterEntryCard({
    count,
    onOpen,
}: {
    count: number;
    onOpen: () => void;
}) {
    const { t } = useTranslation();
    const empty = count === 0;
    const packs = Math.ceil(count / MAX_CARDS_PER_PACK);

    return (
        <MotionCard
            layout
            variants={fadeInIndexed}
            custom={0}
            initial="hidden"
            animate="show"
            exit="exit"
            className={`reveal-card relative border-none bg-white p-4 shadow-md dark:bg-mauria-card h-full overflow-visible ${
                empty
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
            }`}
            onClick={empty ? undefined : onOpen}
        >
            <div
                className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${
                    empty ? "poke-entry-empty" : "poke-entry-foil"
                }`}
            >
                {CORNERS.map((c) => (
                    <span
                        key={c}
                        className={`absolute size-2.5 ${c} ${empty ? POKE_CORNER_EMPTY : POKE_CORNER}`}
                    />
                ))}
            </div>
            <div className="relative flex items-center">
                <div className="mr-4 w-20 items-center justify-center text-center">
                    <PlayingCardsFan
                        className={
                            empty
                                ? "mx-auto size-8 text-zinc-400"
                                : `reveal-icon mx-auto size-8 ${POKE_ICON}`
                        }
                    />
                    {!empty && (
                        <div className="font-mono text-sm font-bold leading-5 tracking-[0.2em] text-amber-200">
                            {t("gradesPage.booster.packCount", {
                                count: packs,
                            })}
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex-1 min-w-0 truncate text-lg font-medium text-white">
                        {t(
                            empty
                                ? "gradesPage.booster.empty"
                                : "gradesPage.booster.openPack"
                        )}
                    </div>
                    <div className="flex h-5 items-center justify-between gap-2 text-sm text-zinc-500">
                        {empty ? (
                            <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-wide text-zinc-400">
                                {t("gradesPage.booster.emptyHint")}
                            </span>
                        ) : (
                            <>
                                <span
                                    className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[10px] font-extrabold uppercase leading-none tracking-wide ${POKE_CTA}`}
                                >
                                    <ChevronsRight className="size-3 shrink-0 animate-pulse" />
                                    {t("gradesPage.booster.tapToOpen")}
                                </span>
                                <p
                                    className={`inline-flex h-5 min-w-0 shrink items-center truncate rounded-full px-2 font-mono text-[11px] font-semibold uppercase leading-none tracking-wide ${POKE_DATE}`}
                                >
                                    <span className="truncate sm:hidden">
                                        {t("gradesPage.booster.remainingShort", { count })}
                                    </span>
                                    <span className="hidden truncate sm:inline">
                                        {t("gradesPage.booster.remaining", { count })}
                                    </span>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </MotionCard>
    );
}

