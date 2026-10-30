import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PreparedLesson } from "@/types/home";
import { MessageEntry } from "@/types/data";
import { JuniaStatus } from "@/lib/api/junia-status";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import {
    ChevronDown,
    Clock,
    Info,
    MapPin,
    ServerCrash,
    SquareArrowOutDownRightIcon,
    WifiOff,
    type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    formatElapsed,
    formatLessonLocation,
    formatLessonType,
} from "@/lib/utils/home";
import { useTranslation } from "react-i18next";
import { useCampus, WIFI_CAMPUS } from "@/lib/utils/campus";
import { EASE, EASE_EXIT, fadeIn, staggerGroup } from "@/lib/motion";

const MotionCard = motion.create(Card);
const MotionAlert = motion.create(Alert);

const containerVariants = staggerGroup;
const itemVariants = fadeIn;

export const SectionHeader = ({ title }: { title: string }) => (
    <motion.h2
        className="mb-4 text-2xl font-bold text-mauria-purple dark:text-white"
        variants={itemVariants}
    >
        {title}
    </motion.h2>
);

const LessonCard = ({
    lesson,
    keyPrefix,
    onClick,
}: {
    lesson: PreparedLesson;
    keyPrefix: string;
    onClick: (lesson: PreparedLesson) => () => void;
}) => {
    const location = formatLessonLocation(lesson.location);
    return (
        <MotionCard
            key={`${lesson.courseTitle}-${lesson.time}-${keyPrefix}`}
            className="mb-4 cursor-pointer border-none bg-white p-4 shadow-md transition-transform duration-150 hover:-translate-y-0.5 dark:bg-mauria-card"
            variants={itemVariants}
            onClick={onClick(lesson)}
        >
            <div className="space-y-2">
                <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-balance leading-tight pr-2">
                        {lesson.courseTitle}
                    </h4>
                    <Badge className="px-2 py-1 rounded-md text-xs font-medium bg-mauria-accent/20 text-black dark:text-white whitespace-nowrap">
                        {formatLessonType(lesson.type)}
                    </Badge>
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] text-sm text-muted-foreground ">
                    <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{lesson.time}</span>
                    </div>
                    {location && (
                        <div className="flex items-center gap-1 ml-4">
                            <MapPin className="h-4 w-4" />
                            <span>{location}</span>
                        </div>
                    )}
                    <div className="mb-0 col-start-3 flex items-center justify-end">
                        <SquareArrowOutDownRightIcon className="text-muted-foreground/50 h-3 w-3" />
                    </div>
                </div>
            </div>
        </MotionCard>
    );
};

export const LessonsSection = ({
    title,
    lessons,
    keyPrefix,
    onClick,
}: {
    title: string;
    lessons: PreparedLesson[];
    keyPrefix: string;
    onClick: (lesson: PreparedLesson) => () => void;
}) => (
    <motion.section className="mb-8" variants={containerVariants}>
        <SectionHeader title={title} />
        {lessons.map((lesson) => (
            <LessonCard
                key={`${lesson.courseTitle}-${lesson.time}`}
                lesson={lesson}
                keyPrefix={keyPrefix}
                onClick={onClick}
            />
        ))}
    </motion.section>
);

export const EmptyState = () => {
    const { t } = useTranslation();

    return (
        <motion.section className="mb-8" variants={containerVariants}>
            <SectionHeader title={t("homePage.nextClasses")} />
            <motion.div variants={itemVariants}>
                <Alert className="mb-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>
                        {t("homePage.nextClassesEmptyState")}
                    </AlertTitle>
                </Alert>
            </motion.div>
        </motion.section>
    );
};

export const WelcomeHeader = ({ firstName }: { firstName: string }) => {
    const { t } = useTranslation();
    const title = t("homePage.title").trim();
    const greeting = [title, firstName].filter(Boolean).join(" ");

    return (
        <motion.h2
            className="mt-4 mb-6 text-3xl font-bold text-mauria-purple dark:text-white"
            variants={fadeIn}
        >
            {greeting}
            {greeting.endsWith("!") ? "" : " !"}
        </motion.h2>
    );
};

const MESSAGE_DURATION = 8;

/**
 * Row and button classes for the important-message page indicators.
 *
 * The button used to be `h-3` (12 CSS px) with a 4px bar inside it, which is
 * half of the 24px minimum target size WCAG 2.5.8 asks for — and this is a
 * thumb-reached control in a mobile-first app. The button is now `h-6` (24px)
 * while the visible bar stays 4px, and the row pulls the extra 12px back with
 * `-my-1.5` so nothing around it moves.
 */
export const messageDotRowClass = "-mx-2 -mb-2 -my-1.5 mt-3 flex items-center gap-1.5";
export const messageDotClass = "group flex h-6 flex-1 cursor-pointer items-center";

const Segment = ({
    active,
    autoplay,
    fillActive,
}: {
    active: boolean;
    autoplay: boolean;
    fillActive: boolean;
}) => {
    const scaleX = useMotionValue(0);
    const frozen = scaleX.get();
    const filling = active && autoplay && fillActive;

    return (
        <span className="block h-1 w-full overflow-hidden rounded-full bg-black/15 dark:bg-white/20">
            <motion.span
                className="block h-full origin-left rounded-full bg-mauria-purple dark:bg-white"
                style={{ scaleX }}
                initial={false}
                animate={{
                    scaleX: active
                        ? autoplay
                            ? filling
                                ? 1
                                : 0
                            : 1
                        : frozen,
                    opacity: active ? 1 : 0,
                }}
                transition={
                    active && autoplay
                        ? {
                              scaleX: filling
                                  ? {
                                        duration: MESSAGE_DURATION,
                                        ease: "linear",
                                    }
                                  : { duration: 0 },
                              opacity: { duration: 0 },
                          }
                        : {
                              scaleX: { duration: 0 },
                              opacity: active
                                  ? { duration: 1.0, ease: EASE }
                                  : { duration: 0.6, ease: EASE_EXIT },
                          }
                }
            />
        </span>
    );
};

export const ImportantMessage = ({
    messages = [],
}: {
    messages?: MessageEntry[];
}) => {
    const { t } = useTranslation();
    const [rawIndex, setIndex] = useState(0);
    const [autoplay, setAutoplay] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState<number | null>(null);

    useEffect(() => {
        const node = contentRef.current;
        if (!node) return;

        const observer = new ResizeObserver(([entry]) => {
            if (entry) setContentHeight(entry.contentRect.height);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const count = messages.length;
    const index = count > 0 && rawIndex > count - 1 ? 0 : rawIndex;

    useEffect(() => {
        if (!autoplay || count <= 1) return;
        const timer = setTimeout(() => {
            setIndex((i) => (i + 1) % count);
        }, MESSAGE_DURATION * 1000);
        return () => clearTimeout(timer);
    }, [autoplay, count, index]);

    const [fillActive, setFillActive] = useState(false);
    useEffect(() => {
        if (!autoplay || count <= 1) {
            const reset = requestAnimationFrame(() => setFillActive(false));
            return () => cancelAnimationFrame(reset);
        }
        const id = requestAnimationFrame(() => setFillActive(true));
        return () => cancelAnimationFrame(id);
    }, [index, autoplay, count]);

    const current = messages[Math.min(index, Math.max(count - 1, 0))];
    const goTo = (target: number) => {
        setIndex(target);
        setAutoplay(false);
    };

    return (
        <motion.div
            variants={fadeIn}
            className="mb-8 rounded-lg bg-white dark:bg-mauria-alert oled:bg-black"
        >
            <MotionAlert className="overflow-hidden border-none bg-mauria-accent/20 dark:bg-mauria-alert">
                <motion.div
                    className="overflow-hidden"
                    initial={false}
                    animate={{ height: contentHeight ?? "auto" }}
                    transition={{ duration: 0.35, ease: EASE }}
                >
                    <div ref={contentRef}>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={index}
                                variants={fadeIn}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                            >
                                <AlertTitle className="font-bold text-black dark:text-white">
                                    {current?.title ||
                                        t("homePage.noImportantMessageTitle")}
                                </AlertTitle>
                                <AlertDescription className="text-black/80 dark:text-white/90">
                                    {current?.message ||
                                        t("homePage.noImportantMessageBody")}
                                </AlertDescription>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>

                {count > 1 && (
                    <div className={messageDotRowClass}>
                        {messages.map((entry, i) => {
                            const active = i === index;

                            return (
                                <button
                                    key={`${i}-${entry.title}`}
                                    type="button"
                                    aria-label={t("homePage.goToMessage", {
                                        index: i + 1,
                                    })}
                                    aria-current={active}
                                    onClick={() => goTo(i)}
                                    className={messageDotClass}
                                >
                                    <Segment
                                        active={active}
                                        autoplay={autoplay}
                                        fillActive={fillActive}
                                    />
                                </button>
                            );
                        })}
                    </div>
                )}
            </MotionAlert>
        </motion.div>
    );
};

const JuniaWarning = ({
    Icon,
    title,
    body,
    since,
}: {
    Icon: LucideIcon;
    title: string;
    body: string;
    since: string | null;
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            variants={fadeIn}
            className="rounded-lg bg-white dark:bg-mauria-alert oled:bg-black"
        >
            <Alert className="border-none bg-amber-500/20 dark:bg-amber-500/15">
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-foreground" />
                        <AlertTitle className="mb-0 font-bold text-black dark:text-white">
                            {title}
                        </AlertTitle>
                    </div>
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 text-black/60 transition-transform duration-200 dark:text-white/60 ${expanded ? "rotate-180" : ""}`}
                    />
                </button>
                <AnimatePresence initial={false}>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="overflow-hidden"
                        >
                            <AlertDescription className="pt-2 pl-6 text-black/80 dark:text-white/90">
                                {body}
                                {since && (
                                    <span className="mt-1 block font-medium">
                                        {t("homePage.downSince", {
                                            duration: formatElapsed(since),
                                        })}
                                    </span>
                                )}
                            </AlertDescription>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Alert>
        </motion.div>
    );
};

export const JuniaStatusWarning = ({
    status,
}: {
    status?: JuniaStatus | null;
}) => {
    const { t } = useTranslation();
    const campus = useCampus();

    const warnings = [
        status?.aurionDown && {
            key: "aurion",
            Icon: ServerCrash,
            title: t("homePage.aurionDownTitle"),
            body: t("homePage.aurionDownBody"),
            since: status.aurionSince,
        },
        status?.wifiDown &&
            campus === WIFI_CAMPUS && {
                key: "wifi",
                Icon: WifiOff,
                title: t("homePage.wifiDownTitle"),
                body: t("homePage.wifiDownBody"),
                since: status.wifiSince,
            },
    ].filter((warning) => !!warning);

    if (warnings.length === 0) return null;

    return (
        <div className="-mt-4 mb-8 space-y-4">
            {warnings.map(({ key, ...warning }) => (
                <JuniaWarning key={key} {...warning} />
            ))}
        </div>
    );
};
